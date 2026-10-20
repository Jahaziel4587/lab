"use client";
import { useWarehouseAccess } from "@/app/components/inventario/useWarehouseAccess";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/src/firebase/firebaseConfig";
import InventoryShell, { Field, inputClass, panelClass, secondaryButtonClass } from "@/app/components/inventario/InventoryShell";
import { useInventorySite } from "@/app/components/inventario/InventoryProvider";
import { inventoryRequest } from "@/lib/inventario/service";
import { inventoryHref } from "@/lib/inventario/sites";
import { locationName } from "@/lib/inventario/catalogs";
import type { KivLot } from "@/lib/inventario/kiv";

type Review = { today: string; lots: KivLot[] };
function dateLabel(date: string) { return date ? date.split("-").reverse().join("/") : "No aplica"; }
export default function KivPage() {
  const { site } = useInventorySite(), router = useRouter();
  const [data, setData] = useState<Review>({ today: "", lots: [] });
  const access = useWarehouseAccess();
  const [deleting, setDeleting] = useState("");
  const [search, setSearch] = useState(""), [filter, setFilter] = useState("all");
  const [loading, setLoading] = useState(true), [refreshing, setRefreshing] = useState(false), [error, setError] = useState("");
  const [refresh, setRefresh] = useState(0);
  useEffect(() => {
    let active = true, pending = false;
    async function load() {
      if (!auth.currentUser || pending) return;
      pending = true; setRefreshing(true);
      try { const result = await inventoryRequest<Review>(undefined, "view=kiv", site); if (active) { setData(result); setError(""); } }
      catch (e) { if (active) setError(e instanceof Error ? e.message : "No se pudo cargar KIV."); }
      finally { pending = false; if (active) { setLoading(false); setRefreshing(false); } }
    }
    const unsubscribe = onAuthStateChanged(auth, user => { if (user) void load(); else { setData({ today: "", lots: [] }); router.replace("/login"); } });
    const visible = () => { if (document.visibilityState === "visible") void load(); };
    const interval = setInterval(visible, 300000);
    window.addEventListener("focus", visible); document.addEventListener("visibilitychange", visible);
    return () => { active = false; unsubscribe(); clearInterval(interval); window.removeEventListener("focus", visible); document.removeEventListener("visibilitychange", visible); };
  }, [site, router, refresh]);
  const normalize = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const lots = data.lots.filter(row => (filter === "all" || (filter === "empty" ? row.empty : row.expired)) && normalize(`${row.code} ${row.name} ${row.project} ${row.lot.name}`).includes(normalize(search.trim())));
  return <InventoryShell>
    <div className="flex flex-wrap items-start justify-between gap-4"><div><h1 className="text-3xl font-semibold">Keep in view (KIV) · Almacén {site}</h1><p className="mt-2 text-sm text-white/55">Consulta los lotes sin existencias o con caducidad vencida.</p><p className="mt-2 text-xs text-white/45">{data.today ? `Fecha de revisión: ${dateLabel(data.today)} · horario de México` : "Consultando fecha del servidor…"}</p></div><button className={secondaryButtonClass} disabled={refreshing} onClick={() => setRefresh(value => value + 1)}>{refreshing ? "Actualizando…" : "Actualizar"}</button></div>
    <section className={`${panelClass} space-y-4`}><div className="grid gap-3 sm:grid-cols-3">{[{ id: "all", title: "Todos los lotes KIV", count: data.lots.length }, { id: "empty", title: "Sin existencias", count: data.lots.filter(row => row.empty).length }, { id: "expired", title: "Caducidad vencida", count: data.lots.filter(row => row.expired).length }].map(item => <button key={item.id} onClick={() => setFilter(item.id)} aria-pressed={filter === item.id} className={`rounded-2xl border p-4 text-left transition ${filter === item.id ? "border-emerald-300/30 bg-emerald-400/10 text-emerald-200" : "border-white/10 bg-white/[0.035] text-white/70 hover:bg-white/[0.06]"}`}><span className="text-sm">{item.title}</span><strong className="mt-2 block text-2xl">{item.count}</strong></button>)}</div><div className="grid gap-4 sm:grid-cols-[1fr_240px]"><Field label="Buscar componente, MTS o lote"><input className={inputClass} value={search} onChange={e => setSearch(e.target.value)} placeholder="Código, nombre, proyecto o lote…" /></Field><Field label="Inventario"><select className={inputClass} value={site} onChange={e => router.push(`/inventario/kiv?site=${e.target.value}`)}><option value="B1">Almacén B1 · Oficina</option><option value="B2">Almacén B2 · Planta</option></select></Field></div><p className="text-xs text-white/45">Un lote puede cumplir ambos criterios. Se conserva su historial y sus existencias.</p></section>
    {error && <p role="alert" className="rounded-xl border border-red-400/20 bg-red-400/5 p-3 text-sm text-red-200">{error}</p>}
    {loading ? <p className="text-sm text-white/55">Cargando lotes…</p> : !lots.length ? <section className={panelClass}><p className="text-sm text-white/55">{search || filter !== "all" ? "No hay lotes que coincidan con estos filtros." : "No hay lotes sin existencias ni con caducidad vencida."}</p></section> : <div className="grid gap-4 lg:grid-cols-2">{lots.map(row => <section key={`${row.componentId}:${row.lot.id}`} className={`${panelClass} space-y-4`}><div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0"><Link href={inventoryHref(`/inventario/components/${row.componentId}`, site)} className="break-words font-semibold text-emerald-200 hover:text-emerald-100">{row.code} · {row.name}</Link><p className="mt-2 break-words text-sm font-semibold">Lote: {row.lot.name}</p>{row.project && <p className="mt-1 text-xs text-white/45">{row.project}</p>}</div><div className="flex flex-wrap gap-2">{row.empty && <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/60">Sin existencias</span>}{row.expired && <span className="rounded-full border border-amber-300/20 bg-amber-300/5 px-3 py-1 text-xs text-amber-200">Caducidad vencida</span>}</div></div><div className="grid gap-3 sm:grid-cols-2"><div className="rounded-2xl border border-white/10 bg-white/[0.035] p-3"><p className="text-xs text-white/45">Existencias totales</p><p className="mt-1 break-words font-semibold">{row.quantity} {row.unit}</p></div><div className="rounded-2xl border border-white/10 bg-white/[0.035] p-3"><p className="text-xs text-white/45">Caducidad / reanálisis</p><p className="mt-1 font-semibold">{dateLabel(row.lot.expiry)}</p></div></div>{Object.entries(row.lot.stock).some(([, quantity]) => quantity > 0) && <p className="break-words text-xs text-white/55">{Object.entries(row.lot.stock).filter(([, quantity]) => quantity > 0).map(([location, quantity]) => `${locationName(location)}: ${quantity} ${row.unit}`).join(" · ")}</p>}<Link href={inventoryHref(`/inventario/components/${row.componentId}`, site)} className={`${secondaryButtonClass} w-full sm:w-auto`}>Ver componente y lotes</Link>{row.empty && access.canDeleteEmptyLots && <button type="button" disabled={!!deleting} className="ml-0 min-h-11 rounded-xl border border-red-400/20 bg-red-400/5 px-4 py-2 text-sm text-red-200 disabled:opacity-50 sm:ml-3" onClick={async () => {
      if (!window.confirm(`¿Eliminar el lote ${row.lot.name} de ${row.code}? Solo se permite si no tiene existencias. Los vales se conservan.`)) return;
      setDeleting(row.lot.id); setError("");
      try { await inventoryRequest({ action: "delete-empty-lot", componentId: row.componentId, lotId: row.lot.id, site }); setData(current => ({ ...current, lots: current.lots.filter(item => !(item.componentId === row.componentId && item.lot.id === row.lot.id)) })); setRefresh(value => value + 1); }
      catch (e) { setError(e instanceof Error ? e.message : "No se pudo eliminar."); }
      finally { setDeleting(""); }
    }}>{deleting === row.lot.id ? "Eliminando…" : "Eliminar lote vacío"}</button>}</section>)}</div>}
  </InventoryShell>;
}
