const fs = require('node:fs'), path = require('node:path'), ts = require('typescript'), assert = require('node:assert/strict');
let records = new Map(), uid = 'planner', counter = 0;
const clone = x => x === undefined ? undefined : JSON.parse(JSON.stringify(x));
const snapshot = p => ({ id: p.split('/').at(-1), ref: doc(p), exists: records.has(p), data: () => clone(records.get(p)) });
function doc(p) { return { path: p, id: p.split('/').at(-1), get: async () => snapshot(p) }; }
function collection(name, filters = []) { return { doc: id => doc(name + '/' + (id || 'generated' + ++counter)), where: (field, op, value) => collection(name, [...filters, [field, op, value]]), get: async () => { const docs = [...records.keys()].filter(p => p.startsWith(name + '/') && !p.slice(name.length + 1).includes('/')).map(snapshot).filter(d => filters.every(([f, op, v]) => op === 'array-contains' ? d.data()[f]?.includes(v) : d.data()[f] === v)); return { docs, empty: !docs.length }; } }; }
const db = { collection, getAll: async (...refs) => Promise.all(refs.map(r => r.get())), runTransaction: async fn => {
  const writes = []; let writing = false;
  const read = r => { assert(!writing, 'Firestore reads must precede writes'); return r.get(); };
  const result = await fn({ get: read, getAll: (...refs) => Promise.all(refs.map(read)), create: (r, d) => { writing = true; writes.push(['create', r.path, clone(d)]); }, update: (r, d) => { writing = true; writes.push(['update', r.path, clone(d)]); }, set: (r, d) => { writing = true; writes.push(['set', r.path, clone(d)]); } });
  for (const [op, p, d] of writes) { if (op === 'create') assert(!records.has(p), 'Duplicate create'); if (op === 'update') assert(records.has(p), 'Missing update'); records.set(p, op === 'update' ? { ...records.get(p), ...d } : d); }
  return result;
} };
const stubs = {
  'next/server': { after: () => {}, NextResponse: { json: (data, o) => ({ status: o?.status || 200, data }) } },
  '@/lib/firebaseAdmin': { adminDB: db, adminAuth: { verifyIdToken: async () => ({ uid, email: uid + '@example.com' }) } },
  '@/lib/operacional/server': { identify: async () => ({ uid }), projectCatalog: async () => [{ label: '001.Project' }] },
  '@/lib/pushNotifications': { sendPushToEmails: async () => {} },
  '@/lib/inventario/storage-server': { warehouseRecipients: async () => ['warehouse@example.com'], pushStorageAlerts: async () => {} },
  'firebase-admin/firestore': { FieldValue: { serverTimestamp: () => 'timestamp' } },
};
const cache = new Map();
function load(file) {
  file = path.resolve(file); if (cache.has(file)) return cache.get(file).exports;
  const m = { exports: {} }; cache.set(file, m);
  const source = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true } }).outputText;
  new Function('require', 'module', 'exports', source)(n => {
    if (n in stubs) return stubs[n];
    if (n.startsWith('@/') || n.startsWith('.')) { const p = n.startsWith('@/') ? path.resolve(n.slice(2)) : path.resolve(path.dirname(file), n); return load([p, p + '.ts', p + '.js'].find(p => fs.existsSync(p) && fs.statSync(p).isFile())); }
    return require(n);
  }, m, m.exports); return m.exports;
}
const math = load('lib/production/pdo.ts'), keys = load('lib/production/key.ts'), api = load('app/api/production/pdos/route.ts'), inventory = load('app/api/inventario/route.ts'), importer = load('lib/production/pdo-import.ts');
const screw = { componentId: 'screw00000000001', code: '001.301', name: 'Screws', unit: 'pz', perUnit: 10, extraPercent: 0 };
const housing = { componentId: 'housing00000001', code: '001.302', name: 'Housings', unit: 'pz', perUnit: 5, extraPercent: 0 };
const lot = (id, q, extras = {}) => ({ id, name: id, stock: { aprobado: q }, expiry: '', notes: '', createdAt: '2026-01-01', ...extras });
const components = [{ ...screw, id: screw.componentId, lots: [lot('screw-lot-000001', 40)] }, { ...housing, id: housing.componentId, lots: [lot('housing-lot-0001', 10), lot('housing-lot-0002', 5)] }];
const capacity = (lines = [screw, housing], cs = components, requests = [], choices = {}) => math.productionCapacity(lines, cs, '001.Project', '2026-10-20', requests, choices);
assert.equal(capacity().units, 2, 'Cannot combine the two housing lots to make three');
assert.equal(capacity().rows[0].capacity, 4); assert.equal(capacity().rows[1].capacity, 2);
assert.equal(capacity(undefined, undefined, [], { [housing.componentId]: { lotId: 'housing-lot-0002', origin: 'aprobado' } }).units, 1);
assert.equal(math.capacityForStock({ ...housing, extraPercent: 10 }, 10), 1, 'Scrap and piece rounding constrain capacity');
assert.equal(math.capacityForStock({ ...housing, unit: 'ml', perUnit: .3 }, .9), 3);
const excluded = [{ ...components[1], lots: [lot('expired', 1000, { expiry: '2000-01-01' }), lot('reserved', 1000, { reservedProject: '002.Other' }), lot('held', 1000, { stock: { pendiente: 1000 } }), lot('own', 5, { reservedProject: '001.Project' })] }];
assert.equal(capacity([housing], excluded).units, 1);
assert.equal(capacity([housing], [{ ...excluded[0], unit: 'ml' }]).units, 0);
for (const invalid of [0, -1, 1.1, Infinity, '1', NaN]) assert.throws(() => math.pdoUnits(invalid));
assert.throws(() => math.cleanPdoDetails({ dueDate: '2026-02-30' }));
const recipeId = keys.productionRecipeKey('B1', 'project1', 'WI.001.05');
const base = { site: 'B1', projectId: 'project1', wiId: 'WI.001.05' };
function seed() {
  records = new Map(); counter = 0; uid = 'planner';
  components.forEach(c => records.set('inventario_componentes/' + c.id, clone(c)));
  records.set('production_recipes/' + recipeId, { ...base, projectName: '001.Project', wiTitle: 'WI.001.05 Assembly', version: 1, lines: [screw, housing] });
  records.set('users/warehouse', { warehouseSites: ['B1'] });
}
async function post(body, target = api) { return target.POST({ json: async () => clone(body), headers: { get: () => 'Bearer test' }, nextUrl: { searchParams: new URLSearchParams({ site: body.site || 'B1' }) }, url: 'https://example.test/api/production/pdos' }); }
const choices = { [screw.componentId]: { lotId: 'screw-lot-000001', origin: 'aprobado' }, [housing.componentId]: { lotId: 'housing-lot-0001', origin: 'aprobado' } };
const create = { ...base, action: 'create', pdo: 'PDO-1000', totalUnits: 1000, details: {}, operationId: 'pdo-00000000001' };
const request = { ...base, action: 'request', pdoId: create.operationId, units: 2, choices, operationId: 'request-00000001' };
const fulfill = r => ({ action: 'movement', site: 'B1', kind: 'salida', operationId: r.operationId, requestId: r.operationId, project: '001.Project', notes: 'PDO test', lines: [screw, housing].map(l => ({ componentId: l.componentId, quantity: l.perUnit * r.units, ...r.choices[l.componentId], destination: 'externo:produccion' })) });
(async () => {
  const originalError = console.error; console.error = () => {};
  try {
    seed(); assert.equal((await post(create)).status, 200); assert.equal((await post(create)).status, 200);
    assert.equal((await post({ ...create, totalUnits: 99 })).status, 400, 'Retry with different body rejected');
    assert.equal((await post({ ...create, operationId: 'pdo-00000000002' })).status, 400, 'Duplicate PDO number');
    assert.equal((await post({ ...create, site: 'B2', operationId: 'pdo-00000000003' })).status, 400, 'No recipe/stock from another site');
    assert.equal((await post({ ...request, units: 3 })).status, 400);
    assert.equal((await post(request)).status, 200); assert.equal((await post(request)).status, 200);
    const listing = await api.GET({ headers: { get: () => 'Bearer test' }, nextUrl: { searchParams: new URLSearchParams(base) } });
    assert.equal(listing.status, 200); assert.equal(listing.data.pdos.length, 1); assert.equal(listing.data.requests.length, 1); assert.equal(listing.data.pending.length, 1);
    assert.equal(listing.data.requests[0].pdoId, create.operationId);
    assert.equal(records.get('production_pdos/' + create.operationId).requestedUnits, 2);
    assert.equal(records.get('inventario_componentes/' + screw.componentId).lots[0].stock.aprobado, 40, 'Request does not deduct stock');
    assert.equal(capacity(undefined, undefined, [...records].filter(([p]) => p.startsWith('production_orders/')).map(([p,r]) => ({ ...r, id: p.split('/').at(-1) }))).units, 1, 'Pending request excluded; only alternate housing lot remains');
    assert.equal((await post({ ...request, operationId: 'request-00000002', units: 1 })).status, 400, 'Pending stock cannot be promised twice');
    assert.equal((await post({ ...request, operationId: 'request-00000002', units: 1, choices: { ...choices, [housing.componentId]: { lotId: 'housing-lot-0002', origin: 'aprobado' } } })).status, 400, 'PDO lot change blocked');
    assert.equal((await post(fulfill(request), inventory)).status, 403, 'Planner cannot fulfill');
    uid = 'warehouse'; const wrongLot = fulfill(request); wrongLot.lines[1].lotId = 'housing-lot-0002';
    assert.equal((await post(wrongLot, inventory)).status, 400, 'Warehouse cannot change the PDO lot');
    const stock = records.get('inventario_componentes/' + housing.componentId).lots[0]; stock.stock.aprobado = 9;
    assert.equal((await post(fulfill(request), inventory)).status, 400, 'Stock rechecked at warehouse confirmation'); stock.stock.aprobado = 10;
    assert.equal((await post(fulfill(request), inventory)).status, 200);
    assert.equal((await post(fulfill(request), inventory)).status, 200, 'Idempotent confirmation');
    assert.equal(records.get('production_orders/' + request.operationId).status, 'fulfilled');
    assert.equal(records.get('inventario_componentes/' + screw.componentId).lots[0].stock.aprobado, 20);
    const voucher = [...records].find(([p]) => p.startsWith('inventario_vales/'))[1];
    assert.equal(voucher.pdoId, create.operationId); assert.equal(voucher.productionRequestId, request.operationId); assert.equal(voucher.lines[1].lotId, 'housing-lot-0001');
    uid = 'planner'; assert.equal((await post({ ...base, action: 'cancel', requestId: request.operationId })).status, 400, 'Cannot cancel actual withdrawal');
    // Second PDO uses the same screw lot and a different housing lot.
    const second = { ...create, pdo: 'PDO-1001', totalUnits: 1, operationId: 'pdo-00000000002' }; assert.equal((await post(second)).status, 200);
    const secondRequest = { ...request, pdoId: second.operationId, units: 1, operationId: 'request-00000002', choices: { ...choices, [housing.componentId]: { lotId: 'housing-lot-0002', origin: 'aprobado' } } };
    assert.equal((await post(secondRequest)).status, 200); assert.equal((await post({ ...secondRequest, operationId: 'request-00000003' })).status, 400, 'Total PDO limit');
    assert.equal((await post({ ...base, action: 'cancel', requestId: secondRequest.operationId })).status, 200);
    assert.equal(records.get('production_pdos/' + second.operationId).requestedUnits, 0);
    uid = 'warehouse'; assert.equal((await post(fulfill(secondRequest), inventory)).status, 400, 'Cancelled request cannot withdraw');
    uid = 'planner'; assert.equal((await post({ ...secondRequest, operationId: 'request-00000003' })).status, 200, 'Cancellation restores pending units');
    // Twenty partial requests of 50, frozen recipe, cumulative pending stock and parent total.
    seed(); records.get('inventario_componentes/' + screw.componentId).lots[0].stock.aprobado = 10000; records.get('inventario_componentes/' + housing.componentId).lots[0].stock.aprobado = 5000;
    await post(create); records.get('production_recipes/' + recipeId).lines[0].perUnit = 999;
    for (let i = 0; i < 20; i++) { const result = await post({ ...request, units: 50, operationId: 'request-batch-' + String(i).padStart(3, '0') }); assert.equal(result.status, 200, result.data.error); }
    assert.equal(records.get('production_pdos/' + create.operationId).requestedUnits, 1000);
    assert.equal(records.get('production_orders/request-batch-000').lines[0].total, 500, 'Recipe snapshot remains unchanged');
    assert.equal((await post({ ...request, units: 1, operationId: 'request-batch-over' })).status, 400);
    assert.equal([...records.keys()].filter(p => p.startsWith('notifications/')).length, 20, 'One notification per request, none for retries');
    const xml = '<w:document><w:tr><w:tc><w:p><w:r><w:t>Cantidad Requerida</w:t></w:r></w:p></w:tc><w:tc><w:p><w:r><w:t>1,000</w:t></w:r></w:p></w:tc><w:tc><w:p><w:r><w:t>Número de Parte</w:t></w:r></w:p></w:tc><w:tc><w:p><w:r><w:t>001.101</w:t></w:r></w:p></w:tc></w:tr></w:document>';
    const imported = importer.importPdoXml(xml, base.wiId); assert.equal(imported.totalUnits, '1000'); assert.equal(imported.details.partNumber, '001.101'); assert.throws(() => importer.importPdoXml('<w:document/>', ''));
    console.log('PDO workflow passed: limiting lots, scrap/rounding, expiry/project exclusions, site isolation, 20 partial requests, total cap, immutable recipe/lots, pending availability, retry/cancellation, warehouse permissions, exact-lot fulfillment, voucher trace and DOCX import.');
  } finally { console.error = originalError; }
})().catch(e => { console.error(e); process.exitCode = 1; });
