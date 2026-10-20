import type { Voucher, VoucherLine, MovementKind } from "./types";
import type { InventorySite } from "./sites";
export function inventoryRequesterName(profile: Record<string, unknown> | undefined, fallback = "") {
  const fullName = [profile?.nombre, profile?.apellido].filter(value => typeof value === "string" && value.trim()).join(" ").trim();
  const candidates = [fullName, profile?.displayName, profile?.name, profile?.username, profile?.nombreUsuario, fallback];
  return candidates.find((value): value is string => typeof value === "string" && !!value.trim() && !value.includes("@"))?.trim() || "Usuario";
}
export type InventoryMovementRequest = {
  id: string; status: string; kind: MovementKind; project: string; notes: string; requestedBy: string; createdAt: string;
  originOther?: string; destinationOther?: string;
  lines: (VoucherLine & { origin: string; destination: string })[]; voucherIds: string[];
};
export function requestVoucherPreviews(request: InventoryMovementRequest, site: InventorySite, actor: string, date: string): Voucher[] {
  const groups = new Map<string, Voucher>();
  for (const line of request.lines) {
    const key = JSON.stringify([line.origin, line.destination]);
    const voucher = groups.get(key) || { id: "Pendiente de generar", site, operationId: request.id, kind: request.kind, origin: line.origin, destination: line.destination, createdAt: date, actor, actorUid: "", requestedBy: "", receivedBy: "", project: request.project, notes: request.notes, originOther: request.originOther || "", destinationOther: request.destinationOther || "", lines: [] };
    voucher.lines.push(line); groups.set(key, voucher);
  }
  return [...groups.values()];
}
