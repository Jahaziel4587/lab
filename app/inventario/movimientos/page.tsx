"use client";
import { useInventorySite } from "@/app/components/inventario/InventoryProvider";
import { inventoryHref } from "@/lib/inventario/sites";
import Link from "next/link";
import { ArrowRight, ClipboardList, ArrowLeftRight } from "lucide-react";
import SearchInput from "@/app/calendario/components/SearchInput";
import { useState } from "react";
import InventoryShell, { useInventory, inputClass, panelClass } from "@/app/components/inventario/InventoryShell";
import MovementCart from "@/app/components/inventario/MovementCart";
import { locationName } from "@/lib/inventario/catalogs";
export default function MovementsPage() {
  const { site } = useInventorySite();
  const { components, vouchers, loading, error, reload } = useInventory(); const [search, setSearch] = useState(""); const [active, setActive] = useState("movement");
  const filtered = vouchers.filter(v => JSON.stringify(v).toLowerCase().includes(search.toLowerCase()));
  return <InventoryShell><div><h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Movimientos y vales</h1><p className="mt-2 text-sm text-white/50">Registra movimientos y consulta los vales de material.</p></div>
    {error && <p role="alert" className="rounded-2xl border border-red-400/20 bg-red-400/5 p-4 text-sm text-red-200">{error}</p>}
    {loading ? <p className="py-12 text-center text-sm text-white/50">Cargando…</p> : <div className="flex flex-col gap-4 lg:flex-row lg:gap-5">
      <aside className="h-max overflow-hidden rounded-2xl border border-white/10 bg-white/[0.035] backdrop-blur-xl lg:sticky lg:top-24 lg:w-64 lg:shrink-0 lg:rounded-3xl"><div className="border-b border-white/10 px-4 py-4"><h2 className="text-sm font-semibold text-white/90">Secciones</h2><p className="mt-1 text-xs text-white/45">Abre solamente lo que necesitas consultar.</p></div><div className="grid grid-cols-2 gap-2 p-2 lg:grid-cols-1 lg:p-3">{[{ key: "movement", label: "Nuevo movimiento", description: "Retiros, devoluciones y traslados", Icon: ArrowLeftRight }, { key: "history", label: "Vales de material", description: "Historial y documentos imprimibles", Icon: ClipboardList }].map(({ key, label, description, Icon }) => <button key={key} aria-pressed={active === key} onClick={() => setActive(key)} className={`min-h-14 rounded-xl border px-3 py-3 text-left transition lg:rounded-2xl lg:px-4 ${active === key ? "border-emerald-300/40 bg-emerald-400 text-black" : "border-white/10 bg-white/[0.035] text-white/70 hover:bg-white/[0.075] hover:text-white"}`}><span className="flex items-center gap-2 text-xs font-semibold lg:text-sm"><Icon size={15} />{label}</span><span className={`mt-1 hidden text-[11px] lg:block ${active === key ? "text-black/65" : "text-white/40"}`}>{description}</span></button>)}</div></aside>
      <section className="min-w-0 flex-1"><div hidden={active !== "movement"}><MovementCart components={components} onSaved={() => void reload()} /></div><div hidden={active !== "history"} className="space-y-4">
        <div className={panelClass}><h2 className="text-lg font-semibold">Vales de material</h2><p className="mb-4 mt-1 text-xs text-white/45">Últimos 300 registros. Abre un vale para consultar sus datos o imprimirlo.</p><SearchInput value={search} onChange={setSearch} placeholder="Buscar folio, proyecto, componente, lote o fecha…" /><p className="mt-3 text-right text-xs text-white/45">Mostrando {filtered.length} vales</p></div>
        <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-white/[0.035] backdrop-blur-xl sm:rounded-3xl"><div className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-emerald-500/10 to-transparent" /><div className="relative divide-y divide-white/10">{!filtered.length && <p className="px-5 py-12 text-center text-sm text-white/45">No hay vales para esta búsqueda.</p>}{filtered.map(v => <Link className="flex flex-wrap items-center justify-between gap-3 px-4 py-4 transition hover:bg-emerald-500/[0.04] sm:px-5" key={v.id} href={inventoryHref(`/inventario/vales/${v.id}`, site)}><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><strong className="text-sm font-medium text-white/90">Vale · {v.id.slice(-8)}</strong><span className="rounded-full border border-emerald-400/20 bg-emerald-400/5 px-2 py-0.5 text-[10px] font-semibold uppercase text-emerald-200">{v.kind}</span></div><p className="mt-1 text-xs text-white/45">{new Date(v.createdAt).toLocaleString("es-MX")} · {locationName(v.origin)} → {locationName(v.destination)}</p><p className="mt-2 break-words text-xs text-white/65">{v.lines.map(l => `${l.code} (${l.quantity} ${l.unit})`).join(", ")}</p></div><span className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.05] px-3 py-2 text-xs text-white/75">Ver vale<ArrowRight size={13} /></span></Link>)}</div></div>
      </div></section>
    </div>}
  </InventoryShell>;
}
