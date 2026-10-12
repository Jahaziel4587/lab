"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { useAuth } from "@/src/Context/AuthContext";
import { useInspectionCatalog } from "@/app/inspecciones/hooks/useInspectionCatalog";
import { inventoryRequest } from "@/lib/inventario/service";
import { inventoryHref, type InventorySite } from "@/lib/inventario/sites";
import { WAREHOUSES } from "@/lib/inventario/catalogs";
import { selectLot, mexicoToday } from "@/lib/inventario/selection";
import type { InventoryComponent, Voucher } from "@/lib/inventario/types";
import type { RecipeLine } from "@/lib/production/calculate";
const input = "w-full rounded-xl border border-white/20 bg-slate-900 px-3 py-3 text-white [color-scheme:dark]";
const button = "rounded-xl bg-emerald-400 px-4 py-3 font-semibold text-slate-950 disabled:opacity-40";
const panel = "rounded-2xl border border-white/10 bg-white/5 p-4 sm:p-6";
type Order = { voucherIds?: string[]; id: string; pdo: string; units: number; projectName: string; wiTitle: string; recipeVersion: number; createdAt: string; lines: (RecipeLine & { code: string; name: string; unit: string; base: number; extra: number; total: number })[] };
export default function Production() {
  const { user } = useAuth(), params = useSearchParams(), router = useRouter();
  const projectId = params.get("proyecto"), wiId = params.get("wi");
  const [site, setSite] = useState<InventorySite>("B1");
  const projects = useInspectionCatalog({ scope: "projects" });
  const wis = useInspectionCatalog({ scope: "process", projectId, enabled: !!projectId });
  const project = projects.projects.find(p => p.id === projectId), wi = wis.workInstructions.find(w => w.id === wiId);
  const [components, setComponents] = useState<InventoryComponent[]>([]), [vouchers, setVouchers] = useState<Voucher[]>([]);
  const [lines, setLines] = useState<RecipeLine[]>([]), [version, setVersion] = useState(0), [orders, setOrders] = useState<Order[]>([]), [selected, setSelected] = useState<Order | null>(null);
  const [pdo, setPdo] = useState(""), [units, setUnits] = useState(""), [busy, setBusy] = useState(false), [loading, setLoading] = useState(false), [error, setError] = useState(""), [message, setMessage] = useState("");
  const [allocation, setAllocation] = useState<Record<string, { origin: string; lotId: string }>>({});
  const pending = useRef<{ signature: string; id: string } | null>(null);
  async function request(body?: unknown, signal?: AbortSignal) {
    if (!user) throw new Error("Inicia sesión.");
    const q = new URLSearchParams({ site, projectId: projectId || "", wiId: wiId || "" });
    const r = await fetch(`/api/production?${q}`, { method: body ? "POST" : "GET", headers: { Authorization: `Bearer ${await user.getIdToken()}`, "Content-Type": "application/json" }, ...(body ? { body: JSON.stringify({ ...(body as object), site, projectId, wiId }) } : {}), signal });
    const d = await r.json(); if (!r.ok) throw new Error(d.error); return d;
  }
  async function inventory() { const d = await inventoryRequest<{ components: InventoryComponent[]; vouchers: Voucher[] }>(undefined, "", site); setComponents(d.components); setVouchers(d.vouchers); }
  useEffect(() => {
    const controller = new AbortController(); setLines([]); setVersion(0); setOrders([]); setSelected(null); setAllocation({}); setError(""); setMessage(""); setLoading(true);
    if (!user || !projectId || !wiId) { setLoading(false); return () => controller.abort(); }
    Promise.all([request(undefined, controller.signal), inventoryRequest<{ components: InventoryComponent[]; vouchers: Voucher[] }>(undefined, "", site)]).then(([d, inv]) => { if (controller.signal.aborted) return; setLines(d.recipe?.lines || []); setVersion(d.recipe?.version || 0); setOrders(d.orders); setComponents(inv.components); setVouchers(inv.vouchers); }).catch(e => { if (!controller.signal.aborted) setError(e.message); }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
    // Request state follows the selected WI and warehouse.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, projectId, wiId, site]);
  async function run(task: () => Promise<void>) { setBusy(true); setError(""); setMessage(""); try { await task(); } catch (e) { setError(e instanceof Error ? e.message : "No se pudo guardar."); } finally { setBusy(false); } }
  function navigate(p?: string, w?: string) { const q = new URLSearchParams(); if (p) q.set("proyecto", p); if (w) q.set("wi", w); router.push(`/production?${q}`); }
  const issued = selected ? (selected.voucherIds?.length ? selected.voucherIds : vouchers.filter(v => v.operationId === selected.id).map(v => v.id)) : [];
  return <main className="mx-auto max-w-6xl space-y-5 px-4 py-8 text-white">
    <div className="flex flex-wrap items-center justify-between gap-4"><div><p className="text-sm text-emerald-300">Manufactura</p><h1 className="text-3xl font-semibold">Production</h1><p className="mt-2 text-sm text-white/60">Proyecto → Work instruction → Receta → PDO → Retiro de material</p></div><Link href="/" className="underline">Inicio</Link></div>
    <section className={`${panel} grid gap-4 sm:grid-cols-3`}>
      <label>Proyecto DMR<select disabled={busy} className={input} value={projectId || ""} onChange={e => navigate(e.target.value)}><option value="">Seleccionar proyecto</option>{projects.projects.map(p => <option key={p.id} value={p.id}>{p.title}</option>)}</select></label>
      <label>In process work instruction<select disabled={busy || !projectId} className={input} value={wiId || ""} onChange={e => navigate(projectId!, e.target.value)}><option value="">Seleccionar WI</option>{wis.workInstructions.map(w => <option key={w.id} value={w.id}>{w.title}</option>)}</select></label>
      <label>Inventario<select disabled={busy} className={input} value={site} onChange={e => setSite(e.target.value as InventorySite)}><option>B1</option><option>B2</option></select></label>
    </section>
    {(projects.loading || wis.loading || loading) && <p role="status">Cargando…</p>}
    {(error || projects.error || wis.error) && <p role="alert" className="rounded-xl bg-red-400/10 p-4 text-red-200">{error || projects.error || wis.error}</p>}
    {message && <p role="status" className="text-emerald-300">{message}</p>}
    {projectId && !wis.loading && wis.folderFound === false && <p>No se encontró la carpeta In process WI para este proyecto.</p>}
    {project && wi && !loading && <>
      <section className={`${panel} space-y-4`}><h2 className="text-xl font-semibold">Receta básica · {wi.title}</h2><p className="text-sm text-white/60">Cantidades por una unidad producida en esta WI. Puedes incluir componentes, MTS y subensambles registrados en Inventory {site}. Versión {version || "sin guardar"}.</p>
        {lines.map((l, i) => <div key={i} className="grid items-end gap-3 rounded-xl border border-white/10 p-3 sm:grid-cols-[2fr_1fr_1fr_auto]">
          <label>Material<select disabled={busy} className={input} value={l.componentId} onChange={e => setLines(lines.map((x, n) => n === i ? { ...x, componentId: e.target.value } : x))}><option value="">Seleccionar material</option>{components.map(c => <option disabled={lines.some((x,n) => n !== i && x.componentId === c.id)} key={c.id} value={c.id}>{c.code} · {c.name} ({c.unit})</option>)}</select></label>
          <label>Cantidad por unidad<input disabled={busy} className={input} type="number" min="0.000001" step="any" value={l.perUnit || ""} onChange={e => setLines(lines.map((x,n) => n === i ? { ...x, perUnit: Number(e.target.value) } : x))} /></label>
          <label>Extra por scrap (%)<input disabled={busy} className={input} type="number" min="0" max="1000" step="any" value={l.extraPercent} onChange={e => setLines(lines.map((x,n) => n === i ? { ...x, extraPercent: Number(e.target.value) } : x))} /></label>
          <button disabled={busy} className="p-3 text-red-200" onClick={() => setLines(lines.filter((_, n) => n !== i))}>Quitar</button>
        </div>)}
        <div className="flex flex-wrap gap-3"><button disabled={busy || lines.length >= 50} className={button} onClick={() => setLines([...lines, { componentId: "", perUnit: 1, extraPercent: 0 }])}>Agregar material</button><button disabled={busy || !lines.length} className={button} onClick={() => run(async () => { await request({ action: "recipe", lines, version }); setVersion(version + 1); setMessage("Receta guardada."); })}>Guardar receta</button></div>
      </section>
      <section className={`${panel} space-y-4`}><h2 className="text-xl font-semibold">Preparar material para PDO</h2><p className="text-sm text-white/60">Se usará la última receta guardada. Total = cantidad por unidad × unidades PDO × (1 + extra / 100). Las piezas se redondean hacia arriba.</p>
        <div className="grid gap-4 sm:grid-cols-2"><label>Número de PDO<input disabled={busy} className={input} maxLength={300} value={pdo} onChange={e => setPdo(e.target.value)} /></label><label>Unidades a manufacturar<input disabled={busy} className={input} type="number" min="1" step="1" value={units} onChange={e => setUnits(e.target.value)} /></label></div>
        <button disabled={busy || !version || !pdo.trim() || !units} className={button} onClick={() => run(async () => { const signature = JSON.stringify([site, projectId, wiId, pdo, units]); if (pending.current?.signature !== signature) pending.current = { signature, id: crypto.randomUUID() }; const d = await request({ action: "order", pdo, units: Number(units), operationId: pending.current.id }); setOrders(prev => [d.order, ...prev.filter(o => o.id !== d.order.id)]); setSelected(d.order); setAllocation({}); pending.current = null; setMessage("Lista de material guardada para almacén."); })}>Generar lista de material</button>
        <div className="flex flex-wrap gap-2">{orders.map(o => <button disabled={busy} key={o.id} className="rounded-xl border border-white/20 p-3 text-left" onClick={() => { setSelected(o); setAllocation({}); }}>{o.pdo} · {o.units} unidades · v{o.recipeVersion}<span className="block text-xs text-white/50">{new Date(o.createdAt).toLocaleString("es-MX")}</span></button>)}</div>
      </section>
      {selected && <section className={`${panel} space-y-4`}><h2 className="text-xl font-semibold">Material para {selected.pdo}</h2><p>{selected.projectName} · {selected.wiTitle} · {selected.units} unidades · receta v{selected.recipeVersion}</p>
        <button className="rounded-xl border border-white/20 p-3" onClick={() => { const rows = [["PDO", "WI", "Material", "Nombre", "Unidad", "Base", "Extra %", "Extra", "Total"], ...selected.lines.map(l => [selected.pdo, selected.wiTitle, l.code, l.name, l.unit, l.base, l.extraPercent, l.extra, l.total])]; const csv = "\uFEFF" + rows.map(row => row.map(x => '"' + String(x).replaceAll('"', '""') + '"').join(",")).join("\r\n"); const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" })); const a = document.createElement("a"); a.href = url; a.download = "material-production.csv"; a.click(); URL.revokeObjectURL(url); }}>Descargar lista para almacén</button>
        {selected.lines.map(l => { const c = components.find(x => x.id === l.componentId), a = allocation[l.componentId] || { origin: "aprobado", lotId: "" }; return <div key={l.componentId} className="space-y-3 rounded-xl border border-white/10 p-4"><div><strong>{l.code} · {l.name}</strong><p className="text-sm text-white/60">Base {l.base} + extra {l.extra} ({l.extraPercent}%) = <strong className="text-emerald-300">{l.total} {l.unit}</strong></p></div>
          {!issued.length && <div className="grid gap-3 sm:grid-cols-2"><label>Ubicación de retiro<select disabled={busy} className={input} value={a.origin} onChange={e => setAllocation({ ...allocation, [l.componentId]: { origin: e.target.value, lotId: "" } })}>{WAREHOUSES.filter(w => w.usable).map(w => <option key={w.id} value={w.id}>{w.name}</option>)}</select></label><label>Lote<select disabled={busy} className={input} value={a.lotId} onChange={e => setAllocation({ ...allocation, [l.componentId]: { ...a, lotId: e.target.value } })}><option value="">Automático · lote vigente con existencias</option>{c?.lots.filter(lot => (!lot.expiry || lot.expiry >= mexicoToday()) && (lot.stock[a.origin] || 0) >= l.total).map(lot => <option key={lot.id} value={lot.id}>{lot.name} · {lot.stock[a.origin]} {l.unit}</option>)}</select></label></div>}
        </div>; })}
        {!issued.length ? <><p className="text-sm text-white/60">El almacenista confirma el retiro físico. Al confirmar se descuentan existencias y se generan vales por ubicación. Cada material requiere un lote vigente con cantidad suficiente.</p><button disabled={busy} className={button} onClick={() => run(async () => { const rows = selected.lines.map(l => { const c = components.find(c => c.id === l.componentId), a = allocation[l.componentId] || { origin: "aprobado", lotId: "" }; const lot = c && selectLot(c.lots, a.origin, l.total, mexicoToday(), a.lotId || undefined); if (!lot) throw new Error(`${l.code}: no hay un lote vigente con existencias suficientes en la ubicación seleccionada.`); return { componentId: l.componentId, quantity: l.total, origin: a.origin, destination: "externo:produccion", lotId: lot.id }; }); const result = await inventoryRequest<{ voucherIds: string[] }>({ action: "movement", kind: "salida", site, operationId: selected.id, lines: rows, project: selected.projectName, notes: `PDO ${selected.pdo} · ${selected.wiTitle} · ${selected.units} unidades · receta v${selected.recipeVersion}` }); setSelected({ ...selected, voucherIds: result.voucherIds }); setOrders(prev => prev.map(o => o.id === selected.id ? { ...o, voucherIds: result.voucherIds } : o)); await inventory(); setMessage("Retiro registrado. Vales disponibles."); })}>Confirmar retiro y generar vales</button></> : <div className="space-y-3"><p className="text-emerald-300">Retiro registrado</p>{issued.map(id => <Link key={id} className="block underline" href={inventoryHref(`/inventario/vales/${id}`, site)}>Abrir vale · {id.slice(-8)}</Link>)}</div>}
      </section>}
    </>}
  </main>;
}
