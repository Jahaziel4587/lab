import type { InventoryComponent, Lot } from "./types";
export type KivLot = { componentId: string; code: string; name: string; project: string; unit: string; lot: Lot; quantity: number; empty: boolean; expired: boolean };
export function kivLots(components: InventoryComponent[], today: string): KivLot[] {
  return components.flatMap(component => component.lots.flatMap(lot => {
    const quantity = Object.values(lot.stock).reduce((total, value) => total + value, 0);
    const empty = quantity <= 0, expired = !!lot.expiry && lot.expiry < today;
    return empty || expired ? [{ componentId: component.id, code: component.code, name: component.name, project: component.project, unit: component.unit, lot, quantity, empty, expired }] : [];
  })).sort((a, b) => Number(b.expired) - Number(a.expired) || (a.lot.expiry || "9999-12-31").localeCompare(b.lot.expiry || "9999-12-31") || a.code.localeCompare(b.code) || a.lot.name.localeCompare(b.lot.name));
}
