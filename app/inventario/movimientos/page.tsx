"use client";
import Link from "next/link";
import { useState } from "react";
import InventoryShell, { useInventory, inputClass, panelClass } from "@/app/components/inventario/InventoryShell";
import MovementCart from "@/app/components/inventario/MovementCart";
import { locationName } from "@/lib/inventario/catalogs";
export default function MovementsPage() {
  const { components, vouchers, loading, error, reload } = useInventory(); const [search, setSearch] = useState("");
  return <InventoryShell><h1 className="text-3xl font-semibold">Movimientos y vales</h1>{error && <p role="alert">{error}</p>}{loading ? <p>Cargando…</p> : <><MovementCart components={components} onSaved={() => void reload()} /><section className={`${panelClass} space-y-4`}><h2 className="text-xl">Vales recientes (últimos 300)</h2><input className={inputClass} aria-label="Filtrar vales" placeholder="Buscar folio, proyecto, componente, lote o fecha" value={search} onChange={e => setSearch(e.target.value)} />{vouchers.filter(v => JSON.stringify(v).toLowerCase().includes(search.toLowerCase())).map(v => <Link className="block rounded-xl border border-white/15 p-3 hover:border-emerald-400" key={v.id} href={`/inventario/vales/${v.id}`}><strong>{v.kind.toUpperCase()} · {v.id.slice(-8)}</strong><p className="text-sm text-white/70">{new Date(v.createdAt).toLocaleString("es-MX")} · {locationName(v.origin)} → {locationName(v.destination)}</p><p>{v.lines.map(l => `${l.code} (${l.quantity} ${l.unit})`).join(", ")}</p></Link>)}</section></>}</InventoryShell>;
}
