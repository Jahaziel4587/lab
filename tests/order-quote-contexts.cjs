const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const source = fs.readFileSync('lib/order-quote-contexts.ts', 'utf8');
const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
const reads = [];
const collections = {
  'pedidos/p1/ejecuciones': [{ id: 'e2', data: () => ({ fechaEntregaReal: '2026-11-01' }) }, { id: 'e3', data: () => ({}) }],
  'pedidos/p1/quote_live/live/lines': [{ data: () => ({ subtotalMXN: 100 }) }],
  'pedidos/p1/ejecuciones/e2/quote_live/live/lines': [{ data: () => ({ subtotalMXN: 50 }) }],
  'pedidos/p1/ejecuciones/e3/quote_live/live/lines': [{ data: () => ({ displayTotal: 25 }) }],
};
const moduleExports = {};
vm.runInNewContext(code, { exports: moduleExports, require: (name) => name === 'firebase/firestore' ? {
  collection: (_db, ...parts) => parts.join('/'),
  getDocs: async (path) => { reads.push(path); if (!collections[path]) throw Error(path); return { docs: collections[path] }; },
} : { db: {} } });
(async () => {
  const contexts = await moduleExports.loadOrderQuoteContexts('p1', { fechaEntregaReal: '2026-10-01' });
  assert.deepEqual(Array.from(contexts, c => moduleExports.quoteSubtotal(c.lines)), [100, 50, 25]);
  assert.equal(contexts.reduce((sum, c) => sum + moduleExports.quoteSubtotal(c.lines), 0), 175);
  assert.equal(contexts.filter(c => c.data.fechaEntregaReal?.startsWith('2026-11')).reduce((sum, c) => sum + moduleExports.quoteSubtotal(c.lines), 0), 50);
  assert.equal(reads.length, 4);
  console.log('order quote contexts: ok');
})().catch(error => { console.error(error); process.exitCode = 1; });
