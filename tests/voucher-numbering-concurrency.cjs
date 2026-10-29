const fs = require('node:fs'), ts = require('typescript'), assert = require('node:assert/strict');
function load(file, imports = {}) { const m = { exports: {} }; new Function('require', 'module', 'exports', ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText)(n => n in imports ? imports[n] : require(n), m, m.exports); return m.exports; }
const math = load('lib/inventario/voucher-numbering.ts');
const records = new Map(), versions = new Map(); let retries = 0;
const clone = v => v === undefined ? v : JSON.parse(JSON.stringify(v));
function ref(path) { return { path, id: path.split('/').at(-1), get: async () => ({ id: path.split('/').at(-1), exists: records.has(path), data: () => clone(records.get(path)) }) }; }
function collection(name, filters = []) { return { id: name, doc: id => ref(`${name}/${id}`), where: (key, op, value) => collection(name, [...filters, [key, op, value]]), get: async () => ({ docs: [...records.keys()].filter(path => path.startsWith(name + '/') && filters.every(([key, op, value]) => op === '>=' ? records.get(path)[key] >= value : records.get(path)[key] <= value)).map(path => ({ id: path.split('/').at(-1), data: () => clone(records.get(path)) })) }) }; }
const db = { collection };
const server = load('lib/inventario/voucher-numbering-server.ts', { '@/lib/firebaseAdmin': { adminDB: db }, './voucher-numbering': math });
async function transaction(fn) {
  for (let attempt = 0; attempt < 50; attempt++) {
    const reads = new Map(), writes = []; let writing = false;
    const t = { get: async r => { assert(!writing, 'Read after write'); if (r.path) reads.set(r.path, versions.get(r.path) || 0); return r.get(); }, set: (r, v) => { writing = true; writes.push([r.path, clone(v)]); } };
    const result = await fn(t);
    if ([...reads].some(([path, version]) => (versions.get(path) || 0) !== version)) { retries++; continue; }
    for (const [path, value] of writes) { records.set(path, value); versions.set(path, (versions.get(path) || 0) + 1); }
    return result;
  }
  throw new Error('Too many retries');
}
(async () => {
  const vouchers = collection('inventario_vales');
  records.set('inventario_vales/historical1', { title: 'VL.B1.4426-A', createdAt: '2026-10-27T10:00:00Z' });
  records.set('inventario_vales/historical2', { title: 'VL.B1.4426-B', createdAt: '2026-10-27T11:00:00Z' });
  await Promise.all(Array.from({ length: 8 }, (_, i) => transaction(async t => {
    const state = await server.prepareNumbering(t, vouchers, 'B1', '2026-10-29T18:00:00Z');
    state.ledger.entries.push({ id: `new${i}` }); t.set(state.ref, state.ledger);
  })));
  const ledger = records.get('inventario_vales_numbering/2026-44');
  assert.equal(ledger.entries.length, 10); assert(retries > 0, 'Exercised optimistic transaction conflicts');
  const titles = Object.values(math.numberingSuggestions(ledger));
  assert.equal(new Set(titles).size, 8); assert.equal(titles[0], 'VL.B1.4426-C'); assert.equal(titles.at(-1), 'VL.B1.4426-J');
  assert.equal(ledger.entries[0].confirmedTitle, 'VL.B1.4426-A');
  const b2 = await transaction(async t => { const state = await server.prepareNumbering(t, collection('inventario_b2_vales'), 'B2', '2026-10-29T18:00:00Z'); state.ledger.entries.push({ id: 'plant' }); t.set(state.ref, state.ledger); return math.numberingSuggestions(state.ledger).plant; });
  assert.equal(b2, 'VL.B2.4426-A');
  console.log('Numbering transactions: simultaneous creation/retries, legacy IDs, no duplicate suggestions and independent B1/B2 ledgers passed.');
})().catch(error => { console.error(error); process.exitCode = 1; });
