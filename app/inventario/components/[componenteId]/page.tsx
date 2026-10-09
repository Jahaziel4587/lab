"use client";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import InventoryShell, { useInventory, panelClass, buttonClass } from "@/app/components/inventario/InventoryShell";
import LotForm from "@/app/components/inventario/LotForm";
import LotQrLabel from "@/app/components/inventario/LotQrLabel";
import MovementCart from "@/app/components/inventario/MovementCart";
import { locationName, TYPES } from "@/lib/inventario/catalogs";
export default function ComponentPage() {
  const { componenteId } = useParams<{ componenteId: string }>(); const { components, loading, error, reload } = useInventory();
  const [create, setCreate] = useState(false), [ids, setIds] = useState<string[]>([]); const c = components.find(x => x.id === componenteId);
  return <InventoryShell>{error ? <p role="alert">{error}</p> : loading ? <p>Cargando…</p> : !c ? <p>Artículo no encontrado.</p> : <><h1 className="text-3xl font-semibold">{c.code} · {c.name}</h1><p className="text-white/60">{c.project || "General / MTS"} · {TYPES[c.type]} · Unidad: {c.unit}</p>
    <LotQrLabel component={c} /><section className={panelClass}><div className="flex justify-between gap-3"><h2 className="text-xl font-semibold">Lotes existentes</h2><button className={buttonClass} onClick={() => setCreate(!create)}>{create ? "Cerrar" : "Nuevo lote"}</button></div><div className="mt-4 space-y-3">{!c.lots.length && <p>No hay lotes registrados.</p>}{c.lots.map(l => <div key={l.id} className="rounded-xl border border-white/15 p-3"><strong>{l.name}</strong><p className="text-sm text-white/70">Caducidad / reanálisis: {l.expiry || "No aplica"} · Proveedor: {l.supplier || "N/A"}</p>{Object.entries(l.stock).map(([w, q]) => <p key={w}>{locationName(w)}: <b>{q} {c.unit}</b></p>)}{l.notes && <p className="text-sm">{l.notes}</p>}</div>)}</div></section>
    {create && <LotForm component={c} onSaved={v => { setIds(v); setCreate(false); void reload(); }} />}{ids.map(id => <Link key={id} className="block text-emerald-300 underline" href={`/inventario/vales/${id}`}>Imprimir vale de entrada · {id.slice(-8)}</Link>)}
    <MovementCart components={components} initialId={c.id} onSaved={() => void reload()} />
  </>}</InventoryShell>;
}
