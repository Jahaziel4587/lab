"use client";
import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import InventoryShell, { useInventory, inputClass, panelClass, buttonClass } from "@/app/components/inventario/InventoryShell";
import ComponentForm from "@/app/components/inventario/ComponentForm";
import QrScanner from "@/app/components/inventario/QrScanner";
import { WAREHOUSES, TYPES } from "@/lib/inventario/catalogs";
export default function InventoryPage() {
  const { components, loading, error, reload } = useInventory(); const router = useRouter();
  const [warehouse, setWarehouse] = useState(""), [project, setProject] = useState(""), [type, setType] = useState(""), [search, setSearch] = useState(""), [create, setCreate] = useState(false);
  const projects = [...new Set(components.map(c => c.project).filter(Boolean))].sort();
  const filtered = components.filter(c => (!project || c.project === project) && (!type || c.type === type) && (!warehouse || c.lots.some(l => (l.stock[warehouse] || 0) > 0)) && `${c.code} ${c.name} ${c.lots.map(l => l.name).join(" ")}`.toLowerCase().includes(search.toLowerCase()));
  return <InventoryShell><div className="flex flex-wrap items-center justify-between gap-3"><div><h1 className="text-3xl font-semibold">Inventario</h1><p className="text-white/60">Materiales y componentes por almacén</p></div><button className={buttonClass} onClick={() => setCreate(!create)}>{create ? "Cerrar formulario" : "Nuevo artículo"}</button></div>
    <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-5">{WAREHOUSES.map(w => <button key={w.id} onClick={() => setWarehouse(warehouse === w.id ? "" : w.id)} className={`rounded-xl border p-4 text-left ${warehouse === w.id ? "border-emerald-400 bg-emerald-400/15" : "border-white/15 bg-slate-900/80"}`}><strong>{w.name}</strong><p className="mt-1 text-xs text-white/60">{components.filter(c => c.lots.some(l => (l.stock[w.id] || 0) > 0)).length} artículos</p></button>)}</div>
    <div className="grid gap-3 sm:grid-cols-3"><input aria-label="Buscar código, nombre o lote" className={inputClass} placeholder="Buscar código, nombre o lote" value={search} onChange={e => setSearch(e.target.value)} /><select aria-label="Proyecto" className={inputClass} value={project} onChange={e => setProject(e.target.value)}><option value="">Todos los proyectos</option>{projects.map(p => <option key={p}>{p}</option>)}</select><select aria-label="Tipo" className={inputClass} value={type} onChange={e => setType(e.target.value)}><option value="">Todos los tipos</option>{Object.entries(TYPES).map(([id, name]) => <option key={id} value={id}>{id} · {name}</option>)}</select></div>
    <QrScanner onScan={id => router.push(`/inventario/components/${id}`)} />
    {create && <ComponentForm onSaved={id => router.push(`/inventario/components/${id}`)} />}
    {error && <p role="alert" className="text-red-300">{error} <button className="underline" onClick={reload}>Reintentar</button></p>}
    <section className={panelClass}><h2 className="mb-4 text-xl">{WAREHOUSES.find(w => w.id === warehouse)?.name || "Todos los almacenes"}</h2>{loading ? <p>Cargando…</p> : filtered.length === 0 ? <p className="text-white/60">Sin artículos para esta selección. Crea un artículo y registra su primer lote.</p> : <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="text-white/60"><tr>{["Código", "Nombre", "Proyecto", "Tipo", "Cantidad", "Lotes"].map(h => <th className="p-3" key={h}>{h}</th>)}</tr></thead><tbody>{filtered.map(c => <tr key={c.id} className="border-t border-white/10"><td className="p-3"><Link className="text-emerald-300 underline" href={`/inventario/components/${c.id}`}>{c.code}</Link></td><td className="p-3">{c.name}</td><td className="p-3">{c.project || "General / MTS"}</td><td className="p-3">{c.type}</td><td className="p-3">{Number(c.lots.reduce((sum, l) => sum + (warehouse ? l.stock[warehouse] || 0 : Object.values(l.stock).reduce((a, b) => a + b, 0)), 0).toFixed(6))} {c.unit}</td><td className="p-3">{c.lots.filter(l => !warehouse || (l.stock[warehouse] || 0) > 0).length}</td></tr>)}</tbody></table></div>}</section>
  </InventoryShell>;
}
