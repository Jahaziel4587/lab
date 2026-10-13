import type { InventoryComponent } from "./types";
import { WAREHOUSES } from "./catalogs";
import { mexicoToday } from "./selection";
export function availableRecipeQuantity(component: InventoryComponent, today = mexicoToday()) {
  return component.lots.filter(l => !l.expiry || l.expiry >= today).reduce((total, lot) => total + WAREHOUSES.filter(w => w.usable).reduce((sum,w) => sum + (lot.stock[w.id] || 0),0),0);
}
function normalize(value: string) { return value.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/\s+/g," ").trim(); }
export function filterRecipeMaterials(components: InventoryComponent[], query: string) {
  const terms = normalize(query).split(" ").filter(Boolean);
  return components.filter(c => terms.every(term => normalize(`${c.code} ${c.name} ${c.unit}`).includes(term))).sort((a,b) => a.code.localeCompare(b.code));
}
