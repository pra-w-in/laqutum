const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { spawnSync } = require('node:child_process');
const bank = require('../content-bank.json');
const root = require('node:path').resolve(__dirname, '..');
function load(context, file) { vm.runInContext(fs.readFileSync(root + '/' + file, 'utf8'), context); }

test('all application scripts parse', () => {
 const files = [...fs.readdirSync(root).filter(f => f.endsWith('.js') && !f.endsWith('.min.js')),
  ...fs.readdirSync(root + '/engine').filter(f => f.endsWith('.js')).map(f => 'engine/' + f)];
 for (const file of files) assert.equal(spawnSync(process.execPath, ['--check', root + '/' + file]).status, 0, file);
});
test('HTML entry points reference existing scripts without duplicate loading', () => {
 for (const file of ['index.html', 'engine/test-harness.html']) {
  const sources = [...fs.readFileSync(root + '/' + file, 'utf8').matchAll(/<script src="([^"]+)"/g)].map(m => m[1]);
  assert.equal(new Set(sources).size, sources.length, file);
  for (const src of sources) assert.ok(fs.existsSync(require('node:path').resolve(root, require('node:path').dirname(file), src.split('?')[0])), src);
 }
});
test('every content reference resolves and every question has a valid answer', () => {
 const ids = new Set(bank.entries.map(e => e.id));
 assert.equal(ids.size, bank.entries.length);
 function walk(value) {
  if (!value || typeof value !== 'object') return;
  for (const [k, v] of Object.entries(value)) {
   if (['next', 'then', 'explanation_id'].includes(k) && typeof v === 'string' && v !== 'CONTINUE') assert.ok(ids.has(v), v);
   if (typeof v === 'object') walk(v);
  }
 }
 bank.entries.forEach(walk);
 for (const q of bank.entries.filter(e => e.type === 'question')) {
  assert.ok(Array.isArray(q.options) && Number.isInteger(q.correct_index) && q.correct_index >= 0 && q.correct_index < q.options.length, q.id);
 }
});
test('learning engine initializes and keeps all twelve diagnostic patterns', async () => {
 const B = require('../engine/content-loader');
 const C = require('../engine/confidence-tracker');
 const S = require('../engine/selection-engine');
 await B.init(root + '/content-bank.json'); C.init(); S.init();
 assert.equal(B.getQuestionsForDiagnostic().length, 12);
 assert.ok(S.getNextItem({}).entry.id);
});
test('invalid remote content falls back to bundled content', async () => {
 const requests = [];
 const context = vm.createContext({ console, URL, AbortSignal, window: {}, document: { baseURI: 'https://app.test/' }, CONTENT_BANK_URL: 'https://remote.test/bank.json',
  fetch: async url => { requests.push(url); return { ok: true, json: async () => requests.length === 1 ? { entries: [], stats: {} } : bank }; } });
 load(context, 'engine/content-loader.js');
 await context.window.ContentBank.init();
 assert.equal(requests[1], 'https://app.test/content-bank.json');
 assert.equal(context.window.ContentBank.getStats().totalEntries, bank.entries.length);
});
test('account caches isolate legacy data, hydrate cloud progress, and retain failed writes', async () => {
 const stored = new Map([['laqtum_mistake_notebook', '[{"id":"legacy"}]']]);
 let user = { id: 'alice' }; let fail = false; const writes = [];
 const context = vm.createContext({ console, AuthManager: { getCurrentUserSync: () => user },
  localStorage: { getItem: k => stored.get(k) ?? null, setItem: (k,v) => stored.set(k,v) },
  window: { supabaseClient: { from: () => ({ update: value => ({ eq: async (_, id) => { writes.push({ id, value }); return { error: fail ? new Error('offline') : null }; } }) }) } } });
 load(context, 'engine/user-storage.js');
 const S = vm.runInContext('UserStorage', context);
 assert.equal(S.read('laqtum_mistake_notebook', null), null);
 S.hydrate('alice', { mistake_notebook: [{ id: 'cloud-alice' }] });
 assert.equal(S.read('laqtum_mistake_notebook', [])[0].id, 'cloud-alice');
 user = { id: 'bob' }; S.hydrate('bob', { mistake_notebook: [] });
 assert.equal(S.read('laqtum_mistake_notebook', []).length, 0);
 fail = true; S.write('laqtum_mistake_notebook', [{ id: 'offline-bob' }]);
 await S.sync('laqtum_mistake_notebook', [{ id: 'offline-bob' }], 'mistake_notebook');
 assert.equal(S.read('laqtum_mistake_notebook:pending', false), true);
 user = { id: 'alice' }; S.hydrate('alice', { mistake_notebook: [{ id: 'cloud-alice' }] });
 assert.equal(S.read('laqtum_mistake_notebook', [])[0].id, 'cloud-alice');
 assert.equal(writes[0].id, 'bob');
 fail = false; user = { id: 'bob' }; S.hydrate('bob', { mistake_notebook: [] });
 await new Promise(resolve => setImmediate(resolve));
 assert.equal(S.read('laqtum_mistake_notebook', [])[0].id, 'offline-bob');
 assert.equal(S.read('laqtum_mistake_notebook:pending', true), false);
 S.write('quota-test', 'old');
 context.localStorage.setItem = () => { throw new Error('Storage quota'); };
 S.write('quota-test', 'new');
 assert.equal(S.read('quota-test', null), 'new');
});
