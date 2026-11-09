const fs = require("node:fs"), ts = require("typescript"), assert = require("node:assert/strict");
function load(path, imports = {}) {
  const m = { exports: {} };
  new Function("require", "module", "exports", ts.transpileModule(fs.readFileSync(path, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText)(name => imports[name] ?? require(name), m, m.exports);
  return m.exports;
}
const forecast = load("lib/inventario/recipe-stock-forecast.ts", { "./catalogs": load("lib/inventario/catalogs.ts") });
const { forecastRecipeStock } = forecast;
const today = "2026-11-09", componentId = "component1";
const recipe = { active: true, startDate: today, intervalDays: 7, lines: [{ componentId, quantity: 5 }] };
const component = { id: componentId, code: "MTS-001", name: "Material", unit: "pz", lots: [{ stock: { aprobado: 10 } }] };
const check = (lots, recipes = [recipe]) => forecastRecipeStock([{ ...component, lots }], recipes, today);
assert.deepEqual(check(component.lots).map(({date,shortfall}) => [date,shortfall]), [["2026-11-23",0]]);
assert.equal(check([{ stock: { aprobado: 11 } }]).length, 0);
assert.deepEqual(check([{ stock: { aprobado: 8, cuarentena: 100 } }, { stock: { aprobado: 50 }, reservedProject: "Proyecto" }]).map(({date,shortfall}) => [date,shortfall]), [["2026-11-23",2]]);
assert.equal(check(component.lots, [recipe, { ...recipe, lines: [{ componentId, quantity: 6 }] }])[0].date, "2026-11-16");
assert.equal(check([{ stock: { aprobado: 5 }, expiry: "2026-11-16" }, { stock: { aprobado: 6 } }]).length, 0, "Uses the earliest expiry first");
assert.equal(check([{ stock: { aprobado: 20 }, expiry: "2026-11-15" }])[0].shortfall, 5);
assert.equal(check([], [{ ...recipe, active: false }, { ...recipe, startDate: "2026-11-24" }]).length, 0);
console.log("Recipe forecast: 14-day horizon, cumulative demand, paused/future recipes and eligible inventory passed.");

let materials = [component], notices = [], pushes = 0;
const states = new Map();
const docs = data => ({ docs: data.map((value, i) => ({ id: value.id ?? String(i), data: () => value })) });
const db = {
  collection(name) {
    if (name === "inventario_componentes") return { get: async () => docs(materials) };
    if (name === "inventario_componentes_fixed_recipes") return { where: () => ({ get: async () => docs([recipe]) }) };
    if (name === "notifications") return { doc: () => ({}) };
    if (name.startsWith("inventario_b2_")) return { where: () => ({ get: async () => docs([]) }), get: async () => docs([]) };
    assert.equal(name,"inventario_componentes_recipe_stock_alerts");
    return { where: () => ({ get: async () => ({ docs: [...states].filter(([,s])=>s.active).map(([id])=>({ id, ref:{update:async fields=>states.set(id,{...states.get(id),...fields})} })) }) }), doc: id => id };
  },
  runTransaction: async fn => fn({
    get: async id => ({data:()=>states.get(id)}),
    set: (id, value) => states.set(id, value),
    create: (_ref, value) => notices.push(value),
  }),
};
const {GET} = load("app/api/inventario/recipe-stock-alerts/route.ts", {
  "firebase-admin/firestore":{FieldValue:{serverTimestamp:()=>"now"}},
  "@/lib/firebaseAdmin":{adminDB:db},
  "@/lib/pushNotifications":{sendPushToEmails:async()=>{pushes++;}},
  "@/lib/inventario/recipe-stock-forecast":forecast,
  "@/lib/inventario/selection":{mexicoToday:()=>today},
  "@/lib/inventario/sites":load("lib/inventario/sites.ts"),
  "@/lib/inventario/storage-server":{warehouseRecipients:async site=>site==="B1"?["warehouse@example.com"]:[]},
});
(async()=>{
  process.env.CRON_SECRET="test-secret";
  const call = token => GET(new Request("https://example.com/api/inventario/recipe-stock-alerts", {headers:token?{Authorization:"Bearer "+token}:{}}));
  assert.equal((await call()).status,401);
  assert.equal((await call("bad-secret")).status,401);
  assert.equal((await call("test-secret")).status,200);
  assert.equal(notices.length,1);assert.equal(pushes,1);
  assert.match(notices[0].mensaje,/23\/11\/2026/);
  assert.equal(notices[0].userEmail,"warehouse@example.com");
  await call("test-secret");assert.equal(notices.length,1);
  materials=[{...component,lots:[{stock:{aprobado:25}}]}];
  await call("test-secret");assert.equal(states.get(componentId).active,false);
  materials=[component];
  await call("test-secret");assert.equal(notices.length,2);
  console.log("Scheduled recipe alerts: authentication, notification, deduplication and reactivation passed.");
})().catch(error=>{console.error(error);process.exitCode=1;});
