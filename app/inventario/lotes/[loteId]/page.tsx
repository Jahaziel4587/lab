"use client";
import Link from "next/link";
import { useParams } from "next/navigation";
import InventoryShell, { useInventory } from "@/app/components/inventario/InventoryShell";
export default function LotPage() {
  const { loteId } = useParams<{ loteId: string }>(); const { components, loading, error } = useInventory(); const c = components.find(x => x.lots.some(l => l.id === loteId));
  return <InventoryShell>{error ? <p>{error}</p> : loading ? <p>Cargando…</p> : c ? <Link className="text-emerald-300 underline" href={`/inventario/components/${c.id}`}>Ver lotes y movimientos de {c.code}</Link> : <p>Lote no encontrado.</p>}</InventoryShell>;
}
