import { randomInt, randomUUID } from 'node:crypto';
import { gzipSync, gunzipSync } from 'node:zlib';

const maxBytes = 8 * 1024 * 1024;
const versionName = /^SKOS_V_\d{17}_[a-f0-9]{8}$/;
const required = ['orgs', 'skus', 'reports', 'itemSales', 'dds'];

function snapshot(value) {
  if (value?.schema !== 1 || !required.every(key => Array.isArray(value.data?.[key]))) {
    throw Object.assign(new Error('Invalid snapshot'), {status:400});
  }
  const {cloud, tab, ...data} = value.data;
  return {schema:1, data, folderNames:value.folderNames || {}};
}

export function makeStore(sheets, indexSheetId) {
  async function version(title) {
    if (!versionName.test(title)) return null;
    const range = "'" + title + "'!A1:C";
    const head = await sheets.values(range + '1');
    const [id, date, count] = head?.[0] || [];
    if (!id || !Number.isInteger(count) || count < 1 || count > 999) return null;
    const rows = await sheets.values(range + (count + 1));
    if (rows?.length !== count + 1 || rows[0]?.[0] !== id) throw new Error('Incomplete version');
    const compressed = Buffer.concat(rows.slice(1).map(([chunk])=>Buffer.from(chunk,'base64')));
    return {id,date,title,snapshot:snapshot(JSON.parse(gunzipSync(compressed,{maxOutputLength:maxBytes})))};
  }
  return {
    async latest() {
      const [[id,date,,title] = []] = await sheets.values("'CLOUD_DB'!D1:G1");
      if (!id) return null;
      if (!versionName.test(title)) throw new Error('Latest version must be migrated');
      return {id,date,title};
    },
    version,
    async history() {
      const result = await sheets.metadata();
      return (result.sheets || []).map(sheet=>sheet.properties.title)
        .filter(title=>versionName.test(title)).sort().reverse();
    },
    async publish(value) {
      const payload = snapshot(value);
      const compressed = gzipSync(JSON.stringify(payload));
      const rows = [];
      for (let i = 0; i < compressed.length; i += 24576) rows.push([compressed.subarray(i,i+24576).toString('base64')]);
      const id = randomUUID(), date = new Date().toISOString();
      const title = 'SKOS_V_' + date.replace(/\D/g,'') + '_' + id.slice(0,8);
      const sheetId = randomInt(1, 2 ** 31);
      const cells = list => ({values:list.map(x=>({userEnteredValue:typeof x === 'number'
        ? {numberValue:x} : {stringValue:x}}))});
      await sheets.batch([
        {addSheet:{properties:{sheetId,title,gridProperties:{rowCount:rows.length+1,columnCount:3}}}},
        {updateCells:{start:{sheetId,rowIndex:0,columnIndex:0},rows:[[id,date,rows.length],...rows].map(cells),fields:'userEnteredValue'}},
        {updateCells:{start:{sheetId:indexSheetId,rowIndex:0,columnIndex:3},rows:[cells([id,date,rows.length,title])],fields:'userEnteredValue'}}
      ]);
      return {id,date,title};
    }
  };
}

export function makeHandler({verify, store, origin, owners, viewers}) {
  return async (req,res) => {
    res.setHeader('Cache-Control','no-store');
    res.setHeader('Vary','Origin');
    if (req.headers.origin === origin) res.setHeader('Access-Control-Allow-Origin',origin);
    const send = (status,body) => {
      res.writeHead(status,{'Content-Type':'application/json; charset=utf-8'});
      res.end(JSON.stringify(body));
    };
    if (req.method === 'OPTIONS') {
      if (req.headers.origin !== origin) return send(403,{error:'origin'});
      res.writeHead(204,{'Access-Control-Allow-Methods':'GET, POST, OPTIONS','Access-Control-Allow-Headers':'Authorization, Content-Type'});
      return res.end();
    }
    const auth = req.headers.authorization?.match(/^Bearer ([^\s]+)$/i);
    if (!auth) return send(401,{error:'login_required'});
    let user;
    try { user = await verify(auth[1]); }
    catch { return send(401,{error:'invalid_session'}); }
    const role = owners.has(user.uid) ? 'owner' : viewers.has(user.uid) ? 'viewer' : '';
    if (!role) return send(403,{error:'access_denied'});
    const path = req.url.split('?')[0];
    try {
      if (req.method === 'GET' && path === '/session') return send(200,{role});
      if (req.method === 'GET' && path === '/latest') return send(200,await store.latest());
      if (req.method === 'GET' && path.startsWith('/version/')) {
        const title = path.slice('/version/'.length);
        const version = await store.version(title);
        return send(version ? 200 : 404,version || {error:'not_found'});
      }
      if (req.method === 'GET' && path === '/history') return send(200,await store.history());
      if (req.method === 'POST' && path === '/publish') {
        if (role !== 'owner') return send(403,{error:'read_only'});
        if (Number(req.headers['content-length']) > maxBytes) return send(413,{error:'too_large'});
        let length = 0;
        const chunks = [];
        for await (const chunk of req) {
          length += chunk.length;
          if (length > maxBytes) return send(413,{error:'too_large'});
          chunks.push(chunk);
        }
        let value;
        try { value = JSON.parse(Buffer.concat(chunks)); }
        catch { return send(400,{error:'invalid_json'}); }
        return send(201,await store.publish(value));
      }
      return send(404,{error:'not_found'});
    } catch (error) {
      return send(error.status === 400 ? 400 : 502,{error:error.status === 400 ? 'invalid_snapshot' : 'cloud_unavailable'});
    }
  };
}
