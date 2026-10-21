import { requiredQuantity, type RecipeLine } from "./calculate";
import { WAREHOUSES } from "../inventario/catalogs";
import { lotAvailableForProject } from "../inventario/selection";
import type { InventoryComponent } from "../inventario/types";
import type { InventorySite } from "../inventario/sites";
export type PdoLine = RecipeLine & { code: string; name: string; unit: string };
export type LotChoice = { lotId: string; origin: string };
export type PdoDetails = {
  orderType: string; outputType: string; partNumber: string; productName: string; lotNumber: string; customerPo: string;
  orderDate: string; dueDate: string; completionDate: string; outputQuantity: string; wiRevision: string; wiDescription: string;
  productionManager: string; productionApprovalDate: string; qualityRepresentative: string; qualityApprovalDate: string; sourceFile: string;
};
export type ProductionPdo = {
  id: string; recipeId: string; site: InventorySite; projectId: string; projectName: string; wiId: string; wiTitle: string;
  pdo: string; totalUnits: number; requestedUnits: number; recipeVersion: number; lines: PdoLine[];
  lots: Record<string, LotChoice>; details: PdoDetails; createdAt: string; createdBy: string;
};
export type ProductionRequest = {
  id: string; pdoId?: string; site: InventorySite; pdo: string; units: number; projectName: string; wiTitle: string;
  recipeVersion: number; createdAt: string; status?: string; fulfilledAt?: string; voucherIds?: string[];
  lines: (PdoLine & { base: number; extra: number; total: number; lotId?: string; lot?: string; origin?: string })[];
};
export function pdoUnits(value: unknown) {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 1 || value > 1e9) throw new Error("La cantidad debe ser un entero entre 1 y 1,000,000,000.");
  return value;
}
export function cleanPdoDetails(value: Partial<PdoDetails> = {}): PdoDetails {
  const result = {} as PdoDetails;
  for (const field of ["orderType", "outputType", "partNumber", "productName", "lotNumber", "customerPo", "orderDate", "dueDate", "completionDate", "outputQuantity", "wiRevision", "wiDescription", "productionManager", "productionApprovalDate", "qualityRepresentative", "qualityApprovalDate", "sourceFile"] as const) {
    const raw = value[field] ?? "";
    if (typeof raw !== "string" || raw.length > 1000) throw new Error("Información de PDO inválida.");
    result[field] = raw.trim();
  }
  for (const field of ["orderDate", "dueDate", "completionDate", "productionApprovalDate", "qualityApprovalDate"] as const) {
    const date = result[field];
    if (date && (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(Date.parse(date)) || new Date(date).toISOString().slice(0, 10) !== date)) throw new Error("Fecha de PDO inválida.");
  }
  if (result.outputQuantity && (!/^\d+$/.test(result.outputQuantity) || Number(result.outputQuantity) > 1e9)) throw new Error("Cantidad de salida inválida.");
  return result;
}
export function pendingMaterial(requests: ProductionRequest[], componentId: string, lotId: string, origin: string, excludeId = "") {
  return requests.filter(r => r.id !== excludeId && r.pdoId && r.status === "pending" && !r.voucherIds?.length)
    .reduce((sum, r) => sum + r.lines.filter(l => l.componentId === componentId && l.lotId === lotId && l.origin === origin).reduce((n, l) => n + l.total, 0), 0);
}
export function capacityForStock(line: PdoLine, stock: number) {
  if (!Number.isFinite(stock) || stock <= 0) return 0;
  // Binary search uses the exact same rounding and scrap rule as a withdrawal.
  let low = 0, high = Math.min(1e9, Math.floor(stock / line.perUnit));
  while (low < high) {
    const mid = Math.ceil((low + high) / 2);
    let fits = false;
    try { fits = requiredQuantity(line.perUnit, mid, line.extraPercent, line.unit).total <= stock + 1e-9; } catch { fits = false; }
    if (fits) low = mid; else high = mid - 1;
  }
  return low;
}
export function productionCapacity(lines: PdoLine[], components: InventoryComponent[], project: string, today: string, requests: ProductionRequest[], choices: Record<string, LotChoice> = {}) {
  const rows = lines.map(line => {
    const component = components.find(c => c.id === line.componentId), choice = choices[line.componentId];
    const options = (component?.unit === line.unit ? component.lots : []).flatMap(lot => {
      if ((lot.expiry && lot.expiry < today) || !lotAvailableForProject(lot, project)) return [];
      return WAREHOUSES.filter(w => w.usable).flatMap(w => {
        const stock = lot.stock[w.id] || 0;
        if (stock <= 0) return [];
        const pending = pendingMaterial(requests, line.componentId, lot.id, w.id);
        const available = Math.max(0, Math.round((stock - pending) * 1e6) / 1e6);
        return [{ lotId: lot.id, lot: lot.name, origin: w.id, expiry: lot.expiry, stock, pending, available, capacity: capacityForStock(line, available) }];
      });
    }).sort((a, b) => b.capacity - a.capacity || (a.expiry || "9999").localeCompare(b.expiry || "9999") || a.lotId.localeCompare(b.lotId));
    const selected = choice ? options.find(o => o.lotId === choice.lotId && o.origin === choice.origin) : options[0];
    return { ...line, options, selected, capacity: selected?.capacity || 0, missing: !component, unitChanged: !!component && component.unit !== line.unit };
  });
  return { rows, units: rows.length ? Math.min(...rows.map(r => r.capacity)) : 0 };
}
export function requestProgress(pdo: ProductionPdo, requests: ProductionRequest[]) {
  const own = requests.filter(r => r.pdoId === pdo.id && r.status !== "cancelled");
  return { requested: own.reduce((n, r) => n + r.units, 0), withdrawn: own.filter(r => r.voucherIds?.length || r.status === "fulfilled").reduce((n, r) => n + r.units, 0) };
}
