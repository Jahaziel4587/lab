"use client";
import Link from "next/link";
import { Boxes, QrCode, ArrowLeftRight, Plus, X } from "lucide-react";
import { useParams } from "next/navigation";
import { useState } from "react";
import InventoryShell, { useInventory, panelClass, buttonClass } from "@/app/components/inventario/InventoryShell";
import LotForm from "@/app/components/inventario/LotForm";
import LotQrLabel from "@/app/components/inventario/LotQrLabel";
import MovementCart from "@/app/components/inventario/MovementCart";
import { locationName, TYPES } from "@/lib/inventario/catalogs";
export default function ComponentPage() {
  const { componenteId } = useParams<{ componenteId: string }>(); const { components, loading, error, reload } = useInventory();
  const [active, setActive] = useState("lots");
  const [create, setCreate] = useState(false), [ids, setIds] = useState<string[]>([]); const c = components.find(x => x.id === componenteId);
  return <InventoryShell>{error ? <p role="alert" className="rounded-2xl border border-red-400/20 bg-red-400/5 p-4 text-sm text-red-200">{error}</p> : loading ? <p className="py-12 text-center text-sm text-white/50">Cargando componente…</p> : !c ? <p>Artículo no encontrado.</p> : <>
    <div><p className="mb-2 text-xs font-medium text-emerald-300/80">{c.code} · {TYPES[c.type]}</p><h1 className="break-words text-2xl font-semibold tracking-tight sm:text-3xl">{c.name}</h1><p className="mt-2 text-sm text-white/50">{c.project || "General / MTS"} · Unidad: {c.unit}</p></div>
    <div className="flex flex-col gap-4 lg:flex-row lg:gap-5">
      <aside className="h-max overflow-hidden rounded-2xl border border-white/10 bg-white/[0.035] backdrop-blur-xl lg:sticky lg:top-24 lg:w-64 lg:shrink-0 lg:rounded-3xl">
        <div className="border-b border-white/10 px-4 py-4"><h2 className="text-sm font-semibold text-white/90">Secciones</h2><p className="mt-1 text-xs text-white/45">Abre solamente lo que necesitas consultar.</p></div>
        <div className="grid grid-cols-3 gap-2 p-2 lg:grid-cols-1 lg:p-3">{[{ key: "lots", label: "Lotes y existencias", description: "Cantidades, almacenes y caducidad", Icon: Boxes }, { key: "movement", label: "Movimientos", description: "Retiros, devoluciones y traslados", Icon: ArrowLeftRight }, { key: "qr", label: "Código QR", description: "Descargar o imprimir la etiqueta", Icon: QrCode }].map(({ key, label, description, Icon }) => <button key={key} aria-pressed={active === key} onClick={() => setActive(key)} className={`min-h-14 rounded-xl border px-2.5 py-3 text-left transition lg:rounded-2xl lg:px-4 ${active === key ? "border-emerald-300/40 bg-emerald-400 text-black" : "border-white/10 bg-white/[0.035] text-white/70 hover:bg-white/[0.075] hover:text-white"}`}><span className="flex items-center gap-2 text-[11px] font-semibold sm:text-xs lg:text-sm"><Icon size={15} className="hidden shrink-0 lg:block" />{label}</span><span className={`mt-1 hidden text-[11px] lg:block ${active === key ? "text-black/65" : "text-white/40"}`}>{description}</span></button>)}</div>
      </aside>
      <section className="min-w-0 flex-1 space-y-5">
        <div hidden={active !== "lots"} className="space-y-5"><section className={panelClass}>
          <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-lg font-semibold">Lotes y existencias</h2><p className="mt-1 text-xs text-white/45">Ubicación y cantidades registradas para este artículo.</p></div><button className={buttonClass} onClick={() => setCreate(!create)}>{create ? <X size={15} /> : <Plus size={15} />}{create ? "Cerrar" : "Nuevo lote"}</button></div>
          <div className="mt-5 space-y-3">{!c.lots.length && <p className="rounded-2xl border border-dashed border-white/10 px-4 py-10 text-center text-sm text-white/45">Todavía no hay lotes. Registra el primero para comenzar.</p>}{c.lots.map(l => <div key={l.id} className="rounded-2xl border border-white/10 bg-white/[0.035] p-4 sm:p-5"><div className="flex flex-wrap justify-between gap-2"><strong className="text-sm text-white/90">{l.name}</strong><span className="rounded-full border border-white/10 px-2.5 py-1 text-[11px] text-white/55">Caducidad: {l.expiry || "No aplica"}</span></div><p className="mt-2 text-xs text-white/40">Proveedor: {l.supplier || "N/A"}</p><div className="mt-4 grid gap-2 sm:grid-cols-2">{Object.entries(l.stock).map(([w, q]) => <div key={w} className="rounded-xl border border-white/10 bg-white/[0.025] px-3 py-3"><p className="text-xs text-white/45">{locationName(w)}</p><p className="mt-1 text-sm font-medium tabular-nums text-white/85">{q} {c.unit}</p></div>)}</div>{l.notes && <p className="mt-3 text-xs text-white/55">{l.notes}</p>}</div>)}</div>
        </section>{create && <LotForm component={c} onSaved={v => { setIds(v); setCreate(false); void reload(); }} />}{ids.map(id => <Link key={id} className="block rounded-xl border border-emerald-400/20 bg-emerald-400/5 p-3 text-sm text-emerald-200" href={`/inventario/vales/${id}`}>Imprimir vale de entrada · {id.slice(-8)}</Link>)}</div>
        <div hidden={active !== "movement"}><MovementCart components={components} initialId={c.id} onSaved={() => void reload()} /></div>
        <div hidden={active !== "qr"}><LotQrLabel component={c} /></div>
      </section>
    </div>
  </>}</InventoryShell>;
}
