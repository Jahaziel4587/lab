"use client";
import { useInventorySite } from "@/app/components/inventario/InventoryProvider";
import { inventoryHref } from "@/lib/inventario/sites";
import { Plus, X, Warehouse } from "lucide-react";
import SearchInput from "@/app/calendario/components/SearchInput";
import InventoryTable from "@/app/components/inventario/InventoryTable";
import { useState } from "react";
import { useRouter } from "next/navigation";
import InventoryShell, { useInventory, inputClass, panelClass, buttonClass, Field } from "@/app/components/inventario/InventoryShell";
import InventoryDownload from "@/app/components/inventario/InventoryDownload";
import ComponentForm from "@/app/components/inventario/ComponentForm";
import QrScanner from "@/app/components/inventario/QrScanner";
import { WAREHOUSES, TYPES } from "@/lib/inventario/catalogs";
export default function InventoryPage() {
  const { site } = useInventorySite();
  const { components, loading, error, reload } = useInventory(); const router = useRouter();
  const [warehouse, setWarehouse] = useState(""), [project, setProject] = useState(""), [type, setType] = useState(""), [search, setSearch] = useState(""), [create, setCreate] = useState(false);
  const projects = [...new Set(components.map(c => c.project).filter(Boolean))].sort();
  const filtered = components.filter(c => (!project || c.project === project) && (!type || c.type === type) && (!warehouse || c.lots.some(l => (l.stock[warehouse] || 0) > 0)) && `${c.code} ${c.name} ${c.lots.map(l => l.name).join(" ")}`.toLowerCase().includes(search.toLowerCase()));
  return <InventoryShell>
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div><h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Inventario</h1><p className="mt-2 text-sm text-white/50">Consulta materiales, componentes y lotes por almacén.</p></div>
      <div className="flex flex-wrap items-start gap-2"><InventoryDownload/><button className={buttonClass} onClick={() => setCreate(!create)}>{create ? <X size={16} /> : <Plus size={16} />}{create ? "Cerrar formulario" : "Nuevo artículo"}</button></div>
    </div>
    <section className="space-y-3"><div className="flex items-center justify-between"><h2 className="text-sm font-semibold text-white/80">Almacenes</h2>{warehouse && <button className="text-xs text-emerald-300 hover:text-emerald-100" onClick={() => setWarehouse("")}>Ver todos</button>}</div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">{WAREHOUSES.map(w => {
        const active = warehouse === w.id;
        return <button key={w.id} aria-pressed={active} onClick={() => setWarehouse(active ? "" : w.id)} className={`min-h-28 rounded-2xl border p-4 text-left backdrop-blur-xl transition sm:rounded-3xl ${active ? "border-emerald-400/35 bg-emerald-500/10" : "border-white/10 bg-white/[0.035] hover:border-white/20 hover:bg-white/[0.06]"}`}>
          <Warehouse size={16} className={active ? "mb-3 text-emerald-300" : "mb-3 text-white/35"} /><span className={`block text-xs font-semibold leading-snug sm:text-sm ${active ? "text-emerald-100" : "text-white/80"}`}>{w.name}</span><span className="mt-2 block text-[11px] text-white/40">{components.filter(c => c.lots.some(l => (l.stock[w.id] || 0) > 0)).length} artículos</span>
        </button>;
      })}</div>
    </section>
    <section className={panelClass}><div className="grid items-end gap-4 sm:grid-cols-2 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)_minmax(0,1fr)]">
      <Field label="Buscar artículos"><SearchInput value={search} onChange={setSearch} placeholder="Buscar código, nombre o lote…" /></Field>
      <Field label="Filtrar por proyecto"><select aria-label="Proyecto" className={inputClass} value={project} onChange={e => setProject(e.target.value)}><option value="">Todos los proyectos</option>{projects.map(p => <option key={p}>{p}</option>)}</select></Field>
      <Field label="Tipo de artículo"><select aria-label="Tipo" className={inputClass} value={type} onChange={e => setType(e.target.value)}><option value="">Todos los tipos</option>{Object.entries(TYPES).map(([id, name]) => <option key={id} value={id}>{id} · {name}</option>)}</select></Field>
    </div><div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-4"><QrScanner onScan={(id, scannedSite) => router.push(inventoryHref(`/inventario/components/${id}`, scannedSite || "B1"))} /><p className="text-xs text-white/45">Mostrando {filtered.length} artículos</p></div></section>
    {create && <ComponentForm onSaved={id => router.push(inventoryHref(`/inventario/components/${id}`, site))} />}
    {error && <p role="alert" className="rounded-2xl border border-red-400/20 bg-red-400/5 p-4 text-sm text-red-200">{error} <button className="underline" onClick={reload}>Reintentar</button></p>}
    <div className="space-y-3"><h2 className="text-sm font-semibold text-white/80">{WAREHOUSES.find(w => w.id === warehouse)?.name || "Todos los almacenes"}</h2><InventoryTable components={filtered} warehouse={warehouse} loading={loading} /></div>
  </InventoryShell>;
}
