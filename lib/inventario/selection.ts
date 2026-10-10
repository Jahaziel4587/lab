import type { Lot } from "./types";
export function selectLot(lots: Lot[], origin: string, quantity: number, today: string, lotId?: string): Lot | undefined {
  return lots.filter(l => (!lotId || l.id === lotId) && (l.stock[origin] || 0) >= quantity && (!l.expiry || l.expiry >= today))
    .sort((a, b) => (a.expiry || "9999-12-31").localeCompare(b.expiry || "9999-12-31") || a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id))[0];
}
export function mexicoToday() { return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Mexico_City", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date()); }
