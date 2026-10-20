import type { InventorySite } from "./sites";
export type WarehouseProfile = { warehouseSites?: unknown; isWarehouseHead?: unknown };
export function canMoveInventory(profile: WarehouseProfile | undefined, site: InventorySite) {
  if (!profile || !Array.isArray(profile.warehouseSites)) return false;
  return profile.warehouseSites.includes(site);
}
export function canDeleteEmptyLots(profile: WarehouseProfile | undefined) { return profile?.isWarehouseHead === true; }
export function isEmptyStock(stock: Record<string, number>) {
  return Object.values(stock).every(quantity => Number.isFinite(quantity) && quantity === 0);
}
