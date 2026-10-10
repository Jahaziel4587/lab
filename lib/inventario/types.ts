import type { InventorySite } from "./sites";
export type ArticleType = "100" | "200" | "300" | "400" | "MTS";
export type Lot = { id: string; name: string; expiry: string; supplier: string; notes: string; createdAt: string; stock: Record<string, number> };
export type InventoryComponent = { id: string; site?: InventorySite; code: string; name: string; project: string; type: ArticleType; unit: string; lots: Lot[]; createdAt: string };
export type MovementKind = "salida" | "entrada" | "traslado";
export type CartLine = { componentId: string; quantity: number; origin: string; destination: string; lotId?: string };
export type VoucherLine = { componentId: string; code: string; name: string; project: string; unit: string; lot: string; lotId: string; expiry: string; quantity: number; comments: string };
export type Voucher = { id: string; site?: InventorySite; operationId: string; kind: MovementKind; origin: string; destination: string; createdAt: string; actor: string; actorUid: string; requestedBy: string; receivedBy: string; project: string; notes: string; lines: VoucherLine[] };
