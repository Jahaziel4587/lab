const assert = require("node:assert/strict");
const fs = require("node:fs");
const ts = require("typescript");
const { createRequire } = require("node:module");
require.extensions[".ts"] = (module, filename) => {
  const { outputText } = ts.transpileModule(fs.readFileSync(filename, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  });
  new Function("require", "exports", "module", outputText)(createRequire(filename), module.exports, module);
};
const { projectCapacity } = require("../lib/production/project-capacity.ts");
const line = (id, perUnit = 1) => ({ componentId: id, code: id, name: id, unit: "pz", perUnit, extraPercent: 0 });
const lot = (name, amount, other = {}) => ({ id: name, name, stock: { aprobado: amount }, ...other });
const component = (id, lots = []) => ({ id, code: id, name: id, unit: "pz", lots });
const step = (id, lines, output) => ({ id, title: id, lines, output });
const run = (steps, cs, target, pending = []) => projectCapacity(steps, cs, "001.Project", "2026-11-09", pending, target);

const first = step("WI.01", [line("raw", 5)], { componentId: "sub", quantity: 2 });
const second = step("WI.02", [line("sub"), line("housing")]);
const stock = [component("raw", [lot("A", 10)]), component("sub", [lot("S", 1)]), component("housing", [lot("H", 100)])];
const available = run([second, first], stock);
assert.equal(available.capacity, 5);
assert.deepEqual(available.plan.rows.map(r => r.executions), [2, 5]);
assert.deepEqual(available.plan.rows[1].materials[0], { code: "sub", name: "sub", unit: "pz", fromStock: 1, fromProduction: 4, missing: 0 });
const goal = run([first, second], stock, 7);
assert.equal(goal.plan.fits, false);
assert.equal(goal.plan.rows[0].materials[0].missing, 5);
assert.equal(goal.plan.rows[1].materials[0].missing, 0);
assert.deepEqual(goal.bottlenecks, [{ wi: "WI.01", code: "raw" }]);

const fiveLots = run([step("WI.01", [line("raw")])], [component("raw", Array.from({ length: 5 }, (_, i) => lot(`L${i}`, 200)))], 1000);
assert.equal(fiveLots.capacity, 1000);
assert.deepEqual(fiveLots.plan.rows[0].batches.map(b => b.units), [200, 200, 200, 200, 200]);
const shared = run([step("WI.01", [line("raw")]), step("WI.02", [line("raw")])], stock, 6);
assert.equal(shared.capacity, 5);
assert.equal(shared.plan.rows[1].materials[0].missing, 2);
const fragmented = run([step("WI.01", [line("raw", 5)])], [component("raw", [lot("A", 4), lot("B", 4)])], 1);
assert.equal(fragmented.capacity, 0);
assert.equal(fragmented.plan.rows[0].materials[0].missing, 5, "Two incomplete lots cannot be combined");
const unavailable = run([step("WI.01", [line("raw")])], [component("raw", [
  lot("expired", 100, { expiry: "2026-01-01" }),
  lot("reserved", 100, { reservedProject: "002.Other" }),
  lot("A", 10),
])], undefined, [{ id: "request", pdoId: "pdo", status: "pending", lines: [{ componentId: "raw", lotId: "A", origin: "aprobado", total: 4 }] }]);
assert.equal(unavailable.capacity, 6);
assert.equal(run([step("WI.01", [])], []).capacity, null);
const cycle = run([step("WI.01", [line("sub")], { componentId: "raw", quantity: 1 }), step("WI.02", [line("raw")], { componentId: "sub", quantity: 1 })], stock);
assert.equal(cycle.capacity, null);
assert.match(cycle.issues[0], /circular/);
console.log("Project capacity: output yield, existing subassemblies, lot splits, shared stock, reservations and invalid routes passed.");

const solder = line("MTS-045");
const cable = step("WI.01", [...first.lines, solder], first.output);
const rework = step("WI.07", []);
assert.equal(run([cable, second, rework], stock, 3).capacity, null);
const simulatedCable = { ...cable, lines: [...first.lines, { ...solder, excluded: true }] };
const simulated = run([simulatedCable, second, { ...rework, excluded: true }], stock, 3);
assert.equal(simulated.capacity, 5);
assert.equal(simulated.standalone[0].output.quantity, 4, "Show potential production independently of the target");
assert.equal(simulated.standalone[1].materials[0].source.quantity, 4);
assert.equal(simulated.plan.rows[1].materials[0].fromProduction, 2);
assert.equal(simulated.plan.rows[0].materials.some(m => m.code === solder.code), false);
assert.equal(simulated.standalone[2].excluded, true);
assert.equal(run([{ ...first, excluded: true }, second], stock).capacity, 1, "Excluded WI contributes no projected output");
assert.equal(run([{ ...first, excluded: true }], stock).capacity, null);
assert.equal(run([{ ...first, lines: first.lines.map(l => ({ ...l, excluded: true })) }], stock).unconstrained, true);
