export type RecipeLine = { componentId: string; perUnit: number; extraPercent: number };
export function requiredQuantity(perUnit: number, units: number, extraPercent: number, unit: string) {
  if (![perUnit, units, extraPercent].every(Number.isFinite) || perUnit <= 0 || units <= 0 || !Number.isInteger(units) || extraPercent < 0 || extraPercent > 1000) throw new Error("Cantidades o porcentaje inválidos.");
  const base = perUnit * units;
  const raw = base * (1 + extraPercent / 100);
  const total = unit === "pz" ? Math.ceil(Number(raw.toFixed(9))) : Math.ceil(Number(raw.toFixed(9)) * 1e6) / 1e6;
  if (!Number.isFinite(total) || total > 1e9) throw new Error("La cantidad calculada excede el límite.");
  return { base, extra: Number((total - base).toFixed(6)), total };
}
