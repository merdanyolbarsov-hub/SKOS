import { createServer } from 'node:http';
import { initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { GoogleAuth } from 'google-auth-library';
import { makeHandler, makeStore } from './api.js';

const { GOOGLE_CLOUD_PROJECT, SKOS_SPREADSHEET_ID, SKOS_INDEX_SHEET_ID, SKOS_OWNER_UID, SKOS_VIEWER_UIDS = '',
  SKOS_ORIGIN = 'https://merdanyolbarsov-hub.github.io', PORT = '8080' } = process.env;
if (!GOOGLE_CLOUD_PROJECT || !SKOS_SPREADSHEET_ID || !SKOS_OWNER_UID ||
    !/^\d+$/.test(SKOS_INDEX_SHEET_ID || '')) throw new Error('Missing SKOS server configuration');

initializeApp({projectId:GOOGLE_CLOUD_PROJECT});
const google = new GoogleAuth({scopes:['https://www.googleapis.com/auth/spreadsheets']});
const base = 'https://sheets.googleapis.com/v4/spreadsheets/' + encodeURIComponent(SKOS_SPREADSHEET_ID);
const get = async (path, data) => {
  const client = await google.getClient();
  return (await client.request({url:base+path,method:data ? 'POST' : 'GET',data,timeout:20000})).data;
};
const store = makeStore({
  values: async range => (await get('/values/' + encodeURIComponent(range) + '?valueRenderOption=UNFORMATTED_VALUE')).values || [],
  metadata: () => get('?fields=sheets(properties(title))'),
  batch: requests => get(':batchUpdate',{requests})
}, Number(SKOS_INDEX_SHEET_ID));

createServer(makeHandler({
  verify: token => getAuth().verifyIdToken(token,true),
  store, origin:SKOS_ORIGIN, owners:new Set([SKOS_OWNER_UID]),
  viewers:new Set(SKOS_VIEWER_UIDS.split(',').map(uid=>uid.trim()).filter(Boolean))
})).listen(Number(PORT),'0.0.0.0');
