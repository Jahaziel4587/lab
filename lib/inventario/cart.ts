import type { CartLine, InventoryComponent, MovementKind } from "./types";
export function validateCart(lines: CartLine[], components?: InventoryComponent[], kind?: MovementKind, today?: string) {
  if (!Array.isArray(lines) || !lines.length || lines.length > 50) throw new Error("Agrega entre 1 y 50 partidas al carrito.");
  const first = lines[0], totals = new Map<string,number>();
  for (const line of lines) {
    if (!line.lotId || line.origin !== first.origin || line.destination !== first.destination) throw new Error("El carrito debe tener lotes seleccionados y un único origen y destino.");
    if (!Number.isFinite(line.quantity) || line.quantity <= 0) throw new Error("Indica cantidades mayores que cero.");
    const key = `${line.componentId}:${line.lotId}`, total = (totals.get(key) || 0) + line.quantity; totals.set(key,total);
    if (components) {
      const c = components.find(c=>c.id===line.componentId), lot = c?.lots.find(l=>l.id===line.lotId);
      if (!c || !lot) throw new Error("Selecciona un componente y lote existentes.");
      if (c.unit === "pz" && !Number.isInteger(line.quantity)) throw new Error("Las piezas deben ser cantidades enteras.");
      if (kind === "salida" && lot.expiry && today && lot.expiry < today) throw new Error(`${c.code}: el lote está vencido.`);
      if (kind !== "entrada" && (lot.stock[line.origin] || 0) < total) throw new Error(`${c.code} · ${lot.name}: cantidad insuficiente para el total del carrito.`);
    }
  }
}
