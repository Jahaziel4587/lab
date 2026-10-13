import type { CartLine, InventoryComponent, MovementKind } from "./types";
export function cartLotAvailability(component: InventoryComponent, lotId: string, lines: CartLine[], origin: string, kind: MovementKind, today: string) {
  const lot = component.lots.find(l=>l.id===lotId);
  if (!lot) return { available: 0, selectable: false, expired: false };
  const expired = !!lot.expiry && lot.expiry < today;
  const alreadyAdded = lines.filter(l=>l.componentId===component.id&&l.lotId===lotId&&l.origin===origin).reduce((sum,l)=>sum+l.quantity,0);
  const available = kind === "entrada" ? Object.values(lot.stock).reduce((sum,q)=>sum+q,0) : Math.max(0,Math.round(((lot.stock[origin]||0)-alreadyAdded)*1e6)/1e6);
  return { available, expired, selectable: kind === "entrada" || (available > 0 && !(kind === "salida" && expired)) };
}
export function validateCart(lines: CartLine[], components?: InventoryComponent[], kind?: MovementKind, today?: string) {
  if (!Array.isArray(lines) || !lines.length || lines.length > 50) throw new Error("Agrega entre 1 y 50 partidas al carrito.");
  const first = lines[0], totals = new Map<string,number>();
  for (const line of lines) {
    if (!line.lotId || line.origin !== first.origin || line.destination !== first.destination) throw new Error("El carrito debe tener lotes seleccionados y un único origen y destino.");
    if (!Number.isFinite(line.quantity) || line.quantity <= 0) throw new Error("Indica cantidades mayores que cero.");
    const key = `${line.componentId}:${line.lotId}`, total = Math.round(((totals.get(key) || 0) + line.quantity) * 1e6) / 1e6; totals.set(key,total);
    if (components) {
      const c = components.find(c=>c.id===line.componentId), lot = c?.lots.find(l=>l.id===line.lotId);
      if (!c || !lot) throw new Error("Selecciona un componente y lote existentes.");
      if (c.unit === "pz" && !Number.isInteger(line.quantity)) throw new Error("Las piezas deben ser cantidades enteras.");
      if (kind === "salida" && lot.expiry && today && lot.expiry < today) throw new Error(`${c.code}: el lote está vencido.`);
      if (kind !== "entrada" && (lot.stock[line.origin] || 0) < total) throw new Error(`${c.code} · ${lot.name}: cantidad insuficiente para el total del carrito.`);
    }
  }
}
