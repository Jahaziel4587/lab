const fs = require('fs');
const ts = require('typescript');
const assert = require('node:assert/strict');
const moduleUnderTest = { exports: {} };
const source = ts.transpileModule(fs.readFileSync('lib/inventario/selection.ts', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText;
new Function('module', 'exports', source)(moduleUnderTest, moduleUnderTest.exports);
const { selectLot } = moduleUnderTest.exports;
const lots = [
  { id: 'a', expiry: '2027-01-01', createdAt: '2026-01-01', stock: { aprobado: 20 } },
  { id: 'b', expiry: '2027-02-01', createdAt: '2026-01-01', stock: { aprobado: 100 } },
  { id: 'expired', expiry: '2025-01-01', stock: { aprobado: 1000 } },
];
assert.equal(selectLot(lots, 'aprobado', 10, '2026-10-10').id, 'a');
assert.equal(selectLot(lots, 'aprobado', 50, '2026-10-10').id, 'b');
assert.equal(selectLot(lots, 'aprobado', 10, '2026-10-10', 'b').id, 'b');
assert.equal(selectLot(lots, 'aprobado', 50, '2026-10-10', 'a'), undefined);
assert.equal(selectLot(lots, 'aprobado', 10, '2026-10-10', 'expired'), undefined);
assert.equal(selectLot(lots, 'aprobado', 10, '2026-10-10', 'missing'), undefined);
assert.equal(selectLot(lots, 'rechazado', 10, '2026-10-10', 'b'), undefined);
console.log('Automatic and explicit lot selection passed, including insufficient, expired and missing lots.');
