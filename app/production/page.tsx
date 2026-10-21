"use client";
import { useEffect, useState } from "react";
import MsopEditor from "./MsopEditor";
import PdoPanel from "./PdoPanel";
import InventoryDialog from "@/app/components/inventario/InventoryDialog";
import { productionCatalog } from "@/lib/production/client";
import { useSearchParams, useRouter } from "next/navigation";
import { useAuth } from "@/src/Context/AuthContext";
import { useInspectionCatalog } from "@/app/inspecciones/hooks/useInspectionCatalog";
import { inventoryRequest } from "@/lib/inventario/service";
import { type InventorySite } from "@/lib/inventario/sites";
import type { InventoryComponent } from "@/lib/inventario/types";
import { ArrowLeft, Factory, Plus, Save, Trash2, ClipboardList, CheckCircle2, LoaderCircle } from "lucide-react";
import CatalogList from "@/app/inspecciones/components/CatalogList";
import InspectionFlowProgress from "@/app/inspecciones/components/InspectionFlowProgress";
import { inspectionPageClass, inspectionPanelClass, inspectionBackButtonClass } from "@/app/inspecciones/styles";
import { inputClass, buttonClass, panelClass, secondaryButtonClass, Field } from "@/app/components/inventario/InventoryShell";
import type { RecipeLine } from "@/lib/production/calculate";
const input = inputClass;
const button = buttonClass;
const panel = panelClass;
export default function Production() {
  const { user } = useAuth(), params = useSearchParams(), router = useRouter();
  const projectId = params.get("proyecto"), wiId = params.get("wi");
  const [msopBusy, setMsopBusy] = useState(false);
  const [bomOpen, setBomOpen] = useState(false), [bomCodes, setBomCodes] = useState<string[]>([]), [bomProjectCode, setBomProjectCode] = useState("");
  const [tab, setTab] = useState<"recipe" | "pdo">("recipe");
  const [site, setSite] = useState<InventorySite>("B1");
  const projects = useInspectionCatalog({ scope: "projects" });
  const wis = useInspectionCatalog({ scope: "process", projectId, enabled: !!projectId });
  const project = projects.projects.find(p => p.id === projectId), wi = wis.workInstructions.find(w => w.id === wiId);
  const [components, setComponents] = useState<InventoryComponent[]>([]);
  const [lines, setLines] = useState<RecipeLine[]>([]), [version, setVersion] = useState(0);
  const [busy, setBusy] = useState(false), [loading, setLoading] = useState(false), [error, setError] = useState(""), [message, setMessage] = useState("");
  async function request(body?: unknown, signal?: AbortSignal) {
    if (!user) throw new Error("Inicia sesión.");
    const q = new URLSearchParams({ site, projectId: projectId || "", wiId: wiId || "" });
    const r = await fetch(`/api/production?${q}`, { method: body ? "POST" : "GET", headers: { Authorization: `Bearer ${await user.getIdToken()}`, "Content-Type": "application/json" }, ...(body ? { body: JSON.stringify({ ...(body as object), site, projectId, wiId }) } : {}), signal });
    const d = await r.json(); if (!r.ok) throw new Error(d.error); return d;
  }
  async function inventory() { const d = await inventoryRequest<{ components: InventoryComponent[] }>(undefined, "", site); setComponents(d.components); }
  useEffect(() => {
    const controller = new AbortController(); setLines([]); setVersion(0); setError(""); setMessage(""); setLoading(true);
    if (!user || !projectId || !wiId) { setLoading(false); return () => controller.abort(); }
    Promise.all([request(undefined, controller.signal), inventoryRequest<{ components: InventoryComponent[] }>(undefined, "", site)]).then(([d, inv]) => { if (controller.signal.aborted) return; setLines(d.recipe?.lines || []); setVersion(d.recipe?.version || 0); setComponents(inv.components); }).catch(e => { if (!controller.signal.aborted) setError(e.message); }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
    // Request state follows the selected WI and warehouse.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, projectId, wiId, site]);
  async function run(task: () => Promise<void>) { setBusy(true); setError(""); setMessage(""); try { await task(); } catch (e) { setError(e instanceof Error ? e.message : "No se pudo guardar."); } finally { setBusy(false); } }
  function navigate(p?: string, w?: string) { const q = new URLSearchParams(); if (p) q.set("proyecto", p); if (w) q.set("wi", w); router.push(`/production?${q}`); }
  useEffect(() => { if (!projectId || !user) return; let live = true; productionCatalog<{bom:{projectCode?:string;items:{code:string}[]}}>(site, undefined, projectId).then(d => { if(live){setBomCodes(d.bom.items.map(i=>i.code));setBomProjectCode(d.bom.projectCode || "");}}).catch(e=>setError(e.message)); return ()=>{live=false;}; }, [projectId, site, user, bomOpen]);
  const prefix = bomProjectCode || project?.title.match(/(?:^|\D)(\d{3})(?:\D|$)/)?.[1] || wi?.id.match(/WI\.(\d{3})/)?.[1] || "";
  const recipeComponents = components.filter(c => bomCodes.includes(c.code));

  return <main className={`${inspectionPageClass} space-y-5`}>
    <button disabled={busy} className={inspectionBackButtonClass} onClick={() => wiId ? navigate(projectId!) : projectId ? navigate() : router.push("/")}><ArrowLeft size={17} />Regresar</button>
    <section className={inspectionPanelClass}>
      <InspectionFlowProgress label="Progreso de producción" steps={["Proyecto", "Work instruction", "Receta y PDO"]} currentStep={wiId ? 3 : projectId ? 2 : 1} />
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0"><p className="text-xs font-semibold uppercase tracking-[0.22em] text-emerald-300">Production</p><h1 className="mt-3 break-words text-2xl font-semibold sm:text-3xl">{wi?.title || project?.title || "Proyectos de producción"}</h1><p className="mt-3 text-sm leading-relaxed text-white/60">{wiId ? "Define la receta por unidad y prepara el material de cada orden de producción." : projectId ? "Selecciona una In process work instruction del proyecto." : "Selecciona un proyecto del DMR para consultar sus instrucciones de proceso."}</p></div>
        {wiId && <div className="w-full sm:w-48"><Field label="Inventario de materiales"><select disabled={busy} className={input} value={site} onChange={e => setSite(e.target.value as InventorySite)}><option value="B1">Almacén B1</option><option value="B2">Almacén B2</option></select></Field></div>}
      </div>
      {projectId && !wiId && <button className={`${secondaryButtonClass} mt-5`} onClick={()=>setBomOpen(true)}>Cargar MSOP</button>}
      {!projectId && !projects.loading && !projects.error && <div className="mt-7"><CatalogList searchPlaceholder="Buscar proyecto…" emptyMessage="No hay proyectos disponibles en el DMR." items={projects.projects.map(p => ({ id: p.id, title: p.title, description: "Proyecto disponible en el DMR" }))} onSelect={p => navigate(p.id)} /></div>}
      {projectId && !wiId && !wis.loading && !wis.error && <div className="mt-7"><CatalogList key={projectId} searchPlaceholder="Buscar work instruction…" emptyMessage="No hay instrucciones de proceso disponibles para este proyecto." items={wis.workInstructions.map(w => ({ id: w.id, title: w.title, description: "In process work instruction" }))} onSelect={w => navigate(projectId, w.id)} /></div>}
    </section>
    {(projects.loading || wis.loading || loading) && <div role="status" className={`${panel} flex items-center gap-3 text-sm text-white/60`}><LoaderCircle size={18} className="animate-spin text-emerald-300" />Cargando información…</div>}
    {(error || projects.error || wis.error) && <p role="alert" className="rounded-2xl border border-red-400/20 bg-red-400/5 p-4 text-sm text-red-200">{error || projects.error || wis.error}</p>}
    {message && <p role="status" className="flex items-center gap-2 rounded-2xl border border-emerald-400/20 bg-emerald-400/5 p-4 text-sm text-emerald-200"><CheckCircle2 size={17} />{message}</p>}
    {projectId && !wis.loading && wis.folderFound === false && <p>No se encontró la carpeta In process WI para este proyecto.</p>}
    {bomOpen && projectId && <InventoryDialog label="Production" wide title="Cargar MSOP" onClose={()=>{if(!msopBusy)setBomOpen(false);}}><h2 className="mb-4 text-xl font-semibold">MSOP · {project?.title}</h2><MsopEditor projectId={projectId} site={site} onBusyChange={setMsopBusy} onSaved={()=>{setMsopBusy(false);setBomOpen(false);void inventory();}} /></InventoryDialog>}
    {project && wi && !loading && <>
      <nav aria-label="Secciones de producción" className="flex w-fit max-w-full gap-1 rounded-2xl border border-white/10 bg-white/[0.035] p-1">{[{ id: "recipe", title: "Receta básica", Icon: Factory }, { id: "pdo", title: "PDO y material", Icon: ClipboardList }].map(({ id, title, Icon }) => <button disabled={busy} key={id} aria-pressed={tab === id} onClick={() => setTab(id as "recipe" | "pdo")} className={`inline-flex min-h-11 items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition ${tab === id ? "bg-emerald-400/10 text-emerald-300" : "text-white/55 hover:bg-white/5 hover:text-white"}`}><Icon size={16} />{title}</button>)}</nav>
      {tab === "recipe" && <section className={`${panel} space-y-4`}><h2 className="text-lg font-semibold">Receta básica · {wi.title}</h2><p className="text-sm text-white/60">Cantidades por una unidad producida en esta WI. Selecciona dispositivos, componentes, MTS y materiales de manufactura del catálogo MSOP del proyecto, incluso sin existencias. Versión {version || "sin guardar"}.</p>
        {!lines.length && <div className="rounded-2xl border border-dashed border-white/15 bg-black/15 p-7 text-center"><Factory size={28} className="mx-auto text-white/40" /><p className="mt-3 text-sm text-white/55">Esta WI aún no tiene receta. Agrega los materiales necesarios por unidad.</p></div>}
        {lines.map((l, i) => <div key={i} className="grid items-end gap-3 rounded-xl border border-white/10 p-3 sm:grid-cols-2 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)_auto]">
          <Field label="Material"><select disabled={busy} className={input} value={l.componentId} onChange={e => setLines(lines.map((x, n) => n === i ? { ...x, componentId: e.target.value } : x))}><option value="">Seleccionar material</option>{recipeComponents.map(c => <option disabled={lines.some((x,n) => n !== i && x.componentId === c.id)} key={c.id} value={c.id}>{c.code} · {c.name} ({c.unit})</option>)}</select></Field>
          <Field label="Cantidad por unidad"><input disabled={busy} className={input} type="number" min="0.000001" step="any" value={l.perUnit || ""} onChange={e => setLines(lines.map((x,n) => n === i ? { ...x, perUnit: Number(e.target.value) } : x))} /></Field>
          <Field label="Extra por scrap (%)"><input disabled={busy} className={input} type="number" min="0" max="1000" step="any" value={l.extraPercent} onChange={e => setLines(lines.map((x,n) => n === i ? { ...x, extraPercent: Number(e.target.value) } : x))} /></Field>
          <button disabled={busy} aria-label={`Quitar material ${i + 1}`} className="inline-flex min-h-11 items-center justify-center rounded-xl border border-red-400/20 px-3 text-sm text-red-200 transition hover:bg-red-400/10" onClick={() => setLines(lines.filter((_, n) => n !== i))}><Trash2 size={16} /></button>
        </div>)}
        <div className="flex flex-wrap gap-3"><button disabled={busy || lines.length >= 50} className={button} onClick={() => setLines([...lines, { componentId: "", perUnit: 1, extraPercent: 0 }])}><Plus size={16} />Agregar material</button><button disabled={busy || !lines.length} className={button} onClick={() => run(async () => { await request({ action: "recipe", lines, version }); setVersion(version + 1); setMessage("Receta guardada."); })}><Save size={16} />Guardar receta</button></div>
      </section>}
      {tab === "pdo" && <PdoPanel key={`${site}:${projectId}:${wiId}`} site={site} projectId={projectId!} wiId={wiId!} wiTitle={wi.title} version={version} />}

    </>}
  </main>;
}
