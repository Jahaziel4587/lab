import { WAREHOUSES } from "./catalogs";
import type { FixedRecipe } from "./fixed-recipes";
import type { InventoryComponent } from "./types";

const dayMs = 86_400_000;
export const recipeStockWarningDays = 14;

export function forecastRecipeStock(components: InventoryComponent[], recipes: FixedRecipe[], today: string) {
  const start = Date.parse(today + "T00:00:00Z");
  const demand = new Map<string, Map<string, number>>();
  for (const recipe of recipes) {
    if (!recipe.active || !Number.isInteger(recipe.intervalDays) || recipe.intervalDays < 1) continue;
    const begins = Date.parse(recipe.startDate + "T00:00:00Z");
    // Current balances already reflect today's actual movements. Forecast future dates only.
    for (let offset = 1; offset <= recipeStockWarningDays; offset++) {
      const timestamp = start + offset * dayMs;
      if (!Number.isFinite(begins) || timestamp < begins || ((timestamp - begins) / dayMs) % recipe.intervalDays !== 0) continue;
      const date = new Date(timestamp).toISOString().slice(0, 10);
      for (const line of recipe.lines) {
        if (!Number.isFinite(line.quantity) || line.quantity <= 0) continue;
        const dates = demand.get(line.componentId) ?? new Map<string, number>();
        dates.set(date, (dates.get(date) ?? 0) + line.quantity);
        demand.set(line.componentId, dates);
      }
    }
  }
  return components.flatMap(component => {
    const dates = demand.get(component.id);
    if (!dates) return [];
    // Use only freely available stock, consuming lots that expire first.
    const lots = component.lots
      .filter(lot => !lot.reservedProject && (!lot.expiry || lot.expiry >= today))
      .map(lot => ({
        expiry: lot.expiry || "9999-12-31",
        remaining: WAREHOUSES.reduce((sum, w) => sum + (w.usable ? Math.max(0, lot.stock[w.id] || 0) : 0), 0),
      }))
      .sort((a, b) => a.expiry.localeCompare(b.expiry));
    for (const [date, quantity] of [...dates].sort(([a], [b]) => a.localeCompare(b))) {
      let remainingDemand = quantity;
      let available = 0;
      for (const lot of lots) {
        if (lot.expiry < date) continue;
        available += lot.remaining;
        const used = Math.min(remainingDemand, lot.remaining);
        lot.remaining -= used;
        remainingDemand -= used;
      }
      if (available - quantity < 0.0000005) {
        return [{ componentId: component.id, code: component.code, name: component.name, unit: component.unit, date, shortfall: Math.max(0, Math.round((quantity - available) * 1e6) / 1e6) }];
      }
    }
    return [];
  });
}
