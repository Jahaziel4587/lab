import { requiredQuantity, type RecipeOutput } from "./calculate";
import { capacityForStock, productionCapacity, type PdoLine, type ProductionRequest } from "./pdo";
import type { InventoryComponent } from "../inventario/types";

export type CapacityStep = { id: string; title: string; lines: (PdoLine & { excluded?: boolean; selectionCode?: string })[]; excluded?: boolean; output?: RecipeOutput | null; missing?: boolean; issues?: string[] };
type Lot = { name: string; stock: number; projected: boolean };
const limit = 1e9;
const round = (n: number) => Number(n.toFixed(6));
const quantity = (line: PdoLine, units: number) => requiredQuantity(line.perUnit, units, line.extraPercent, line.unit).total;

export function projectCapacity(steps: CapacityStep[], components: InventoryComponent[], project: string, today: string, pending: ProductionRequest[], target?: number) {
  const configured = steps;
  steps = steps.filter(step => !step.excluded).map(step => ({ ...step, missing: step.missing || !step.lines.length, lines: step.lines.filter(line => !line.excluded) }));
  const issues: string[] = [], owners = new Map<string, CapacityStep>();
  const articles = new Map(components.map(c => [c.id, c]));
  const lines = new Map<string, PdoLine>();
  for (const step of steps) {
    if (step.issues?.length) issues.push(...step.issues.map(issue => `${step.title}: ${issue}`));
    else if (step.missing) issues.push(`${step.title}: falta la receta o un insumo ya no está en inventario.`);
    if (step.output) {
      if (!articles.has(step.output.componentId)) issues.push(`${step.title}: el artículo de salida ya no está en inventario.`);
      if (owners.has(step.output.componentId)) issues.push(`${step.title}: hay más de una WI que produce el mismo artículo. Define una sola ruta de producción.`);
      owners.set(step.output.componentId, step);
    }
    for (const line of step.lines) lines.set(line.componentId, line);
  }

  const visited = new Set<string>(), visiting = new Set<string>(), ordered: CapacityStep[] = [];
  function visit(step: CapacityStep) {
    if (visited.has(step.id)) return;
    if (visiting.has(step.id)) { issues.push(`${step.title}: hay una dependencia circular entre las salidas y los insumos.`); return; }
    visiting.add(step.id);
    for (const line of step.lines) {
      const parent = owners.get(line.componentId);
      if (parent) visit(parent);
    }
    visiting.delete(step.id);
    visited.add(step.id);
    ordered.push(step);
  }
  steps.forEach(visit);
  if (!steps.length) issues.push(configured.length ? "Incluye al menos una WI para calcular la capacidad." : "No se encontraron WI de proceso para este proyecto.");

  const stock = new Map(productionCapacity([...lines.values()], components, project, today, pending).rows.map(row =>
    [row.componentId, row.options.filter(l => l.available > 0).map(l => ({ name: `${l.lot} · ${l.origin}`, stock: l.available, projected: false }))] as const));
  function copyStock() { return new Map([...stock].map(([id, lots]) => [id, lots.map(l => ({ ...l }))])); }
  function pick(line: PdoLine, lots: Lot[] = []) {
    let capacity = 0, lot: Lot | undefined;
    for (const candidate of lots) {
      const units = capacityForStock(line, candidate.stock);
      if (units > capacity || (units === capacity && (!lot || candidate.stock > lot.stock))) { capacity = units; lot = candidate; }
    }
    return { lot, capacity };
  }
  function spend(lot: Lot, amount: number) { lot.stock = Math.max(0, round(lot.stock - amount)); }

  function executionPlan(devices: number, diagnose: boolean) {
    const reserved = copyStock(), pool = copyStock(), counts = new Map<string, number>(), needed = new Map<string, number>();
    // Work backward to size intermediate runs after allocating existing stock once.
    for (const step of [...ordered].reverse()) {
      const id = step.output?.componentId;
      const executions = id && lines.has(id)
        ? Math.ceil((needed.get(id) || 0) / step.output!.quantity)
        : Math.ceil(devices / (step.output?.quantity || 1));
      counts.set(step.id, executions);
      if (executions > limit) return { fits: false, rows: [], overflow: true };
      for (const line of step.lines) {
        if (!owners.has(line.componentId)) continue;
        let remaining = executions;
        while (remaining > 0) {
          const { lot, capacity } = pick(line, reserved.get(line.componentId));
          if (!lot || !capacity) break;
          const n = Math.min(remaining, capacity);
          spend(lot, quantity(line, n));
          remaining -= n;
        }
        if (remaining) needed.set(line.componentId, round((needed.get(line.componentId) || 0) + quantity(line, remaining)));
      }
    }

    let fits = true;
    const rows = [];
    for (const step of ordered) {
      const executions = counts.get(step.id) || 0;
      let remaining = executions;
      const batches: { units: number; lots: string[] }[] = [];
      const materials = new Map(step.lines.map(line => [line.componentId, {
        code: line.code, name: line.name, unit: line.unit, fromStock: 0, fromProduction: 0, missing: 0,
      }]));
      const output = step.output && articles.get(step.output.componentId);
      const generated: Lot[] = [];
      while (remaining > 0) {
        const choices = step.lines.map(line => ({ line, ...pick(line, pool.get(line.componentId)) }));
        const short = choices.some(c => !c.capacity);
        if (short) {
          fits = false;
          if (!diagnose) return { fits, rows: [], overflow: false };
        }
        const units = Math.min(remaining, ...choices.filter(c => c.capacity > 0).map(c => c.capacity));
        const labels: string[] = [];
        for (const { line, lot, capacity } of choices) {
          const row = materials.get(line.componentId)!;
          const required = quantity(line, units), used = capacity ? required : 0;
          if (lot) spend(lot, used);
          if (lot?.projected) row.fromProduction = round(row.fromProduction + used);
          else row.fromStock = round(row.fromStock + used);
          row.missing = round(row.missing + required - used);
          labels.push(`${line.code}: ${used ? lot!.name : "sin lote"}`);
        }
        batches.push({ units, lots: labels });
        if (output && step.output) generated.push({ name: `Salida prevista · ${step.title} · corrida ${batches.length}`, stock: units * step.output.quantity, projected: true });
        remaining -= units;
      }
      if (output) pool.set(output.id, [...(pool.get(output.id) || []), ...generated]);
      rows.push({ id: step.id, title: step.title, executions, batches, materials: [...materials.values()],
        output: output && step.output ? { code: output.code, name: output.name, quantity: executions * step.output.quantity } : null });
    }
    return { fits, rows, overflow: false };
  }

  function standaloneBatches(step: CapacityStep, source = stock) {
    const pool = new Map(step.lines.map(line => [line.componentId, (source.get(line.componentId) || []).map(l => ({ ...l }))]));
    const batches: number[] = [];
    let total = 0;
    while (total < limit) {
      const choices = step.lines.map(line => ({ line, ...pick(line, pool.get(line.componentId)) }));
      const units = Math.min(limit - total, ...choices.map(c => c.capacity));
      if (!units) break;
      for (const { line, lot } of choices) spend(lot!, quantity(line, units));
      batches.push(units);
      total += units;
    }
    return batches;
  }
  const active = new Map(steps.map(step => [step.id, step]));
  const projected = copyStock();
  const outputs = new Map<string, { code: string; name: string; quantity: number | null; wi: string }>();
  for (const step of ordered) {
    if (step.missing || !step.output || step.issues?.length) continue;
    const article = articles.get(step.output.componentId);
    if (!article || owners.get(article.id)?.id !== step.id || step.lines.some(l => owners.has(l.componentId) && !outputs.has(l.componentId) && !owners.get(l.componentId)?.missing)) continue;
    const unconstrained = step.lines.every(l => outputs.get(l.componentId)?.quantity === null);
    const batches = unconstrained ? [limit] : standaloneBatches(step, projected);
    const lots = batches.map(units => ({ stock: units * step.output!.quantity, name: step.title, projected: true }));
    projected.set(article.id, [...(stock.get(article.id) || []), ...lots]);
    outputs.set(article.id, { code: article.code, name: article.name, wi: step.title,
      quantity: unconstrained ? null : lots.reduce((sum, lot) => sum + lot.stock, 0) });
  }
  const standalone = configured.map(step => {
    const included = active.get(step.id);
    return {
      id: step.id, title: step.title, excluded: !!step.excluded, missing: !!step.missing || !step.lines.length,
      batches: included?.lines.length && !step.missing ? standaloneBatches(included) : [],
      unconstrained: !!included && !included.lines.length && !step.missing && !!step.lines.length,
      output: step.output && !step.excluded && owners.get(step.output.componentId)?.id === step.id ? outputs.get(step.output.componentId) : undefined,
      materials: step.lines.map(line => {
        const lots = !line.excluded
          ? (stock.get(line.componentId) || []).map(l => capacityForStock(line, l.stock)).filter(Boolean).sort((a, b) => b - a) : [];
        const source = line.excluded || step.excluded ? undefined : outputs.get(line.componentId);
        return { code: line.code, selectionCode: line.selectionCode || line.code, name: line.name, lots, source };
      }),
    };
  });
  const result = (n: number, diagnose: boolean) => {
    try { return executionPlan(n, diagnose); }
    catch (e) {
      if (e instanceof Error && e.message === "La cantidad calculada excede el límite.") return { fits: false, rows: [], overflow: true };
      throw e;
    }
  };
  const unconstrained = !issues.length && steps.every(step => step.lines.every(l => outputs.get(l.componentId)?.quantity === null));
  let low = 0, high = issues.length || unconstrained ? 0 : limit;
  while (low < high) {
    const mid = Math.ceil((low + high) / 2);
    if (result(mid, false).fits) low = mid;
    else high = mid - 1;
  }
  const goal = target ?? low;
  const plan = issues.length ? null : result(goal, true);
  const bottlenecks = !issues.length && !unconstrained && low < limit
    ? result(low + 1, true).rows.flatMap(r => r.materials.filter(m => m.missing > 0).map(m => ({ wi: r.title, code: m.code }))) : [];
  return { capacity: issues.length || unconstrained ? null : low, unconstrained, goal, plan, issues, standalone, bottlenecks };
}
