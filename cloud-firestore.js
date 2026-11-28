(() => {
  'use strict';
  const chunkSize = 640 * 1024;
  const maxBytes = 8 * 1024 * 1024;
  const versionPattern = /^SKOS_V_\d{17}_[a-f0-9]{8}$/;
  const required = ['orgs', 'skus', 'reports', 'itemSales', 'dds'];

  function validate(value) {
    if (value?.schema !== 1 || !required.every(key => Array.isArray(value.data?.[key]))) {
      throw new Error('Неверный формат базы SKOS.');
    }
    return value;
  }

  async function compress(value) {
    const source = new Blob([JSON.stringify(validate(value))]);
    if (source.size > maxBytes) throw Object.assign(new Error('Снимок слишком велик.'), {status:413});
    const stream = source.stream().pipeThrough(new CompressionStream('gzip'));
    return new Uint8Array(await new Response(stream).arrayBuffer());
  }

  async function expand(blocks) {
    const raw = new Blob(blocks).stream().pipeThrough(new DecompressionStream('gzip'));
    return validate(await new Response(raw).json());
  }

  window.makeSkosFirestore = function (sdk, db, config, currentUid) {
    const pointer = sdk.doc(db, 'skosCloud', 'latest');
    const versions = sdk.collection(db, 'skosVersions');
    const versionRef = title => sdk.doc(versions, title);
    const parts = title => sdk.collection(versionRef(title), 'chunks');
    const dateString = date => date?.toDate().toISOString();

    async function latest() {
      const result = await sdk.getDocFromServer(pointer);
      if (!result.exists()) return null;
      const {title, date} = result.data();
      return {id:title, title, date:dateString(date)};
    }

    return {
      async session() {
        const uid = currentUid();
        const role = uid === config.ownerUid ? 'owner' : uid === config.viewerUid ? 'viewer' : null;
        if (!role) throw Object.assign(new Error('Нет доступа к SKOS.'), {status:403});
        return {role};
      },
      latest,
      watchLatest(onChange) {
        return sdk.onSnapshot(pointer, {includeMetadataChanges:true}, snapshot => {
          if (!snapshot.metadata.fromCache) onChange(snapshot.exists() ? snapshot.data().title : '');
        }, () => {});
      },
      async history() {
        const result = await sdk.getDocsFromServer(sdk.query(versions, sdk.orderBy('date', 'desc')));
        return result.docs.map(doc => doc.id).filter(title => versionPattern.test(title));
      },
      async version(title) {
        if (!versionPattern.test(title)) throw new Error('Неверная версия.');
        const metadata = await sdk.getDocFromServer(versionRef(title));
        if (!metadata.exists()) throw new Error('Версия отсутствует.');
        const {date, chunks} = metadata.data();
        const result = await sdk.getDocsFromServer(parts(title));
        const byId = new Map(result.docs.map(doc => [doc.id, doc.data().bytes]));
        const blocks = Array.from({length:chunks}, (_, i) => byId.get(String(i).padStart(2, '0'))?.toUint8Array());
        if (blocks.some(block => !block) || result.size !== chunks) throw new Error('Версия неполная.');
        return {id:title,title,date:dateString(date),snapshot:await expand(blocks)};
      },
      async publish(value) {
        if (currentUid() !== config.ownerUid) throw Object.assign(new Error('Только чтение.'), {status:403});
        const packed = await compress(value);
        const date = new Date().toISOString();
        const title = 'SKOS_V_' + date.replace(/\D/g, '') + '_' + crypto.randomUUID().slice(0, 8);
        const chunks = Math.ceil(packed.length / chunkSize);
        if (packed.length > 6 * 1024 * 1024) throw Object.assign(new Error('Снимок слишком велик.'), {status:413});
        const batch = sdk.writeBatch(db);
        batch.set(versionRef(title), {date:sdk.serverTimestamp(),chunks});
        for (let i = 0; i < chunks; i++) {
          const bytes = sdk.Bytes.fromUint8Array(packed.subarray(i * chunkSize, (i + 1) * chunkSize));
          batch.set(sdk.doc(parts(title), String(i).padStart(2, '0')), {bytes});
        }
        batch.set(pointer, {title,date:sdk.serverTimestamp()});
        await batch.commit();
        return {id:title,title,date};
      }
    };
  };
})();
