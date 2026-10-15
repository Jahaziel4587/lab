"use client";
import { Fragment, useEffect, useRef, useState } from "react";
import { Plus, Save, Trash2, ChevronDown, ChevronRight, X } from "lucide-react";
import { productionCatalog } from "@/lib/production/client";
import { inventoryRequest } from "@/lib/inventario/service";
import type { InventoryComponent } from "@/lib/inventario/types";
import type { InventorySite } from "@/lib/inventario/sites";
import { Field, inputClass, buttonClass, secondaryButtonClass } from "@/app/components/inventario/InventoryShell";
import { normalizedCode } from "@/lib/production/codes";
import { validateBomEntries, type BomEntry } from "@/lib/production/bom";
import { orderedBomRows } from "@/lib/production/bom-view";
const cellInput = `${inputClass} !min-h-8 !rounded-md !border-transparent !bg-transparent !px-2 !py-1 !text-xs hover:!border-white/15 focus:!border-emerald-400/40 focus:!bg-black/20`;
const empty = { code: "", name: "", unit: "pz", level: 3, parentId: "", description: "", spanishName: "", clientCode: "", supplier: "", spec: "" };
export default function BomEditor({ projectId, site, onSaved }: { projectId: string; site: InventorySite; onSaved: () => void }) {
  const [entries, setEntries] = useState<BomEntry[]>([]), [version, setVersion] = useState(0), [projectCode, setProjectCode] = useState("");
  const [components, setComponents] = useState<InventoryComponent[]>([]), [draft, setDraft] = useState(empty), [error, setError] = useState(""), [busy, setBusy] = useState(false), [loading, setLoading] = useState(true);
  useEffect(() => {
    let live = true;
    Promise.all([productionCatalog<{ bom: { entries: BomEntry[]; version: number; projectCode: string } }>(site, undefined, projectId), inventoryRequest<{ components: InventoryComponent[] }>(undefined, "", site)])
      .then(([b, c]) => { if (live) { setEntries(b.bom.entries); setVersion(b.bom.version); setProjectCode(b.bom.projectCode); setComponents(c.components); } })
      .catch(e => { if (live) setError(e.message); }).finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, [site, projectId]);
  const [editorParent, setEditorParent] = useState<string | null>(null), [moreColumns, setMoreColumns] = useState(false);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const codeInput = useRef<HTMLInputElement>(null);
  const rows = orderedBomRows(entries);
  const byId = new Map(entries.map(e => [e.id, e]));
  function hidden(id: string) { let parent = byId.get(id)?.parentId; const seen = new Set<string>(); while(parent && !seen.has(parent)) { if(collapsed.has(parent)) return true; seen.add(parent); parent=byId.get(parent)?.parentId; } return false; }
  function startAdding(parentId: string) {
    if(editorParent === parentId) { codeInput.current?.focus();return; }
    if (draft.code.trim() && editorParent !== parentId && !window.confirm("Hay un renglón sin agregar. ¿Descartar esa captura?")) return;
    setEditorParent(parentId); setDraft({...empty,parentId}); setError("");
    setCollapsed(previous => { const next=new Set(previous);next.delete(parentId);return next; });
    requestAnimationFrame(() => { codeInput.current?.scrollIntoView({block:"nearest",behavior:"smooth"});codeInput.current?.focus({preventScroll:true}); });
  }
  function existing(code: string) { try { const normalized = normalizedCode(code); return components.find(c => normalizedCode(c.code) === normalized) || entries.find(e => e.code === normalized); } catch { return undefined; } }
  const known = existing(draft.code);
  function add() {
    try {
      const code = normalizedCode(draft.code);
      const row = { ...draft, id: crypto.randomUUID(), code, name: known?.name || draft.name.trim() || draft.spanishName.trim() || draft.description.trim(), unit: known?.unit || draft.unit.trim() };
      validateBomEntries([...entries, row], projectCode);
      setEntries([...entries, row]); setDraft({ ...empty, parentId: draft.parentId }); setError("");
    } catch (e) { setError((e as Error).message); }
  }
  function change(id: string, key: keyof BomEntry, value: string | number) { setEntries(entries.map(e => e.id === id ? { ...e, [key]: value } : e)); }
  function renderEditor() { return <section className="max-w-[calc(100vw-6rem)] space-y-4 lg:max-w-none rounded-2xl border border-white/10 bg-white/[0.035] p-4">
      <div className="flex items-center justify-between gap-3"><h3 className="font-semibold">{draft.parentId ? `Agregar material en ${byId.get(draft.parentId)?.code} · ${byId.get(draft.parentId)?.name}` : "Agregar artículo principal"}</h3><button disabled={busy} aria-label="Cerrar captura de artículo" className={secondaryButtonClass} onClick={()=>{setEditorParent(null);setDraft(empty);}}><X size={15}/></button></div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Field label="Part number Bioana"><input disabled={busy} ref={codeInput} list="bom-codes" className={inputClass} value={draft.code} placeholder={`${projectCode}.200 o MTS-005`} onChange={e => {
          const code = e.target.value; let level = draft.level;
          try { const normalized = normalizedCode(code); level = /^MTS-|\.4\d{2}/.test(normalized) ? 4 : /\.3\d{2}/.test(normalized) ? 3 : /\.2\d{2}/.test(normalized) ? 2 : 1; } catch { /* incomplete input */ }
          setDraft({ ...draft, code, level });
        }} /><datalist id="bom-codes">{components.filter(c => c.code.startsWith(projectCode + ".") || c.type === "MTS").map(c => <option key={c.id} value={c.code}>{c.name}</option>)}</datalist></Field>
        <Field label="Nombre del artículo"><input disabled={busy || !!known} className={inputClass} value={known?.name || draft.name} onChange={e => setDraft({ ...draft, name: e.target.value })} /></Field>
        <Field label="Unidad de medida"><input disabled={busy || !!known} className={inputClass} value={known?.unit || draft.unit} placeholder="pz, ml, g, m…" onChange={e => setDraft({ ...draft, unit: e.target.value })} /></Field>
        <Field label="BOM Level"><select disabled={busy} className={inputClass} value={draft.level} onChange={e => setDraft({ ...draft, level: Number(e.target.value) })}>{[1,2,3,4].map(n => <option key={n} value={n}>{n}</option>)}</select></Field>

      </div>
      <details className="text-sm"><summary className="cursor-pointer text-emerald-200">Datos del documento (opcionales)</summary><div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{([['description','Part description'],['spanishName','Nombre en español'],['clientCode',"Client’s part number"],['supplier','Proveedor'],['spec','SPEC / DWG / IFU']] as const).map(([key,label]) => <Field key={key} label={label}><input disabled={busy} className={inputClass} value={draft[key]} onChange={e => setDraft({ ...draft, [key]: e.target.value })} maxLength={300} /></Field>)}</div></details>
      {known && <p className="text-xs text-emerald-200">Se reutilizará el artículo existente y su unidad de medida.</p>}
      {error && <p role="alert" className="text-sm text-red-200">{error}</p>}
      <button disabled={busy || !projectCode} className={secondaryButtonClass} onClick={add}><Plus size={16} />Agregar renglón</button>
    </section>; }
  if (loading) return <p role="status" className="text-sm text-white/55">Cargando BOM e inventario…</p>;
  return <div className="space-y-4">
    <p className="text-sm text-white/55">Proyecto {projectCode || "no identificado"} · Usa el botón + de un ensamble o subensamble para agregar sus materiales. Las cantidades se definen en las recetas.</p>
    <div className="flex flex-wrap items-center justify-between gap-3"><h3 className="font-semibold">BOM · {entries.length} renglones · {new Set(entries.map(e => e.code)).size} artículos</h3><div className="flex flex-wrap gap-2"><button disabled={busy} className={secondaryButtonClass} onClick={()=>startAdding("")}><Plus size={15}/>Artículo principal</button><button className={secondaryButtonClass} aria-pressed={moreColumns} onClick={()=>setMoreColumns(!moreColumns)}>{moreColumns?"Menos columnas":"Más columnas"}</button></div></div>
    {editorParent === "" && renderEditor()}
    <div className="overflow-x-auto rounded-2xl border border-white/10">
      <table className={`w-full border-collapse text-left text-xs ${moreColumns ? "min-w-[1400px]" : "min-w-[900px]"}`}><thead className="sticky top-0 z-10 bg-[#25312b] text-[11px] text-white/65"><tr>{["Nivel", "Part number", "Descripción / nombre", "Unidad", "Proveedor", "SPEC / DWG / IFU", ...(moreColumns ? ["Part description", "Nombre en español", "Client’s part number"] : []), "Acciones"].map(label=><th key={label} className="border-r border-white/10 px-3 py-2 font-semibold">{label}</th>)}</tr></thead><tbody>
        {rows.filter(({entry})=>!hidden(entry.id)).map(({entry:e,depth}) => {
          const assembly = /\.[12]\d{2}/.test(e.code), hasChildren=entries.some(row=>row.parentId===e.id);
          return <Fragment key={e.id}><tr className={`border-t border-white/15 ${assembly ? "bg-white/[0.09] font-semibold" : "bg-white/[0.015] hover:bg-white/[0.04]"}`}>
            <td className="w-14 border-r border-white/10 px-1"><select aria-label={`Nivel de ${e.code}`} disabled={busy} className={`${cellInput} !w-12 !px-1`} value={e.level} onChange={ev=>change(e.id,"level",Number(ev.target.value))}>{[1,2,3,4].map(n=><option key={n}>{n}</option>)}</select></td>
            <td className="whitespace-nowrap border-r border-white/10 py-2 pr-3 text-emerald-200" style={{paddingLeft:12+depth*16}}>{e.code}</td>
            <td className="min-w-64 border-r border-white/10 py-2 pr-3" style={{paddingLeft:12+depth*24}}><div className="flex items-center gap-2">
              {hasChildren ? <button disabled={busy} aria-label={`${collapsed.has(e.id)?"Expandir":"Contraer"} ${e.code}`} aria-expanded={!collapsed.has(e.id)} className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md hover:bg-white/10" onClick={()=>setCollapsed(prev=>{const next=new Set(prev);next.has(e.id)?next.delete(e.id):next.add(e.id);return next;})}>{collapsed.has(e.id)?<ChevronRight size={14}/>:<ChevronDown size={14}/>}</button> : <span aria-hidden="true" className={`inline-flex w-7 shrink-0 justify-center ${depth ? "text-white/30" : ""}`}>{depth?"↳":""}</span>}
              <span className="break-words">{e.name}</span>
            </div></td>
            <td className="border-r border-white/10 px-3 py-2 text-white/60">{e.unit}</td>
            {(['supplier','spec',...(moreColumns ? ['description','spanishName','clientCode'] : [])] as ('supplier'|'spec'|'description'|'spanishName'|'clientCode')[]).map(key=><td key={key} className="min-w-32 border-r border-white/10 p-0.5"><input aria-label={`${key} de ${e.code}`} disabled={busy} className={cellInput} maxLength={300} value={e[key]} onChange={ev=>change(e.id,key,ev.target.value)}/></td>)}
            <td className="w-24 whitespace-nowrap px-2 py-1">{assembly && <button disabled={busy} title={`Agregar material a ${e.code}`} aria-label={`Agregar material a ${e.code}`} className="inline-flex h-8 w-8 items-center justify-center rounded-md text-emerald-200 transition hover:bg-emerald-400/15 focus-visible:outline-emerald-300" onClick={()=>startAdding(e.id)}><Plus size={16}/></button>}<button aria-label={`Quitar ${e.code}`} title="Quitar renglón" disabled={busy} className="inline-flex h-8 w-8 items-center justify-center rounded-md text-white/35 hover:bg-red-400/10 hover:text-red-200" onClick={()=>{
              const ids=new Set([e.id]);let changed=true;while(changed){changed=false;for(const row of entries)if(ids.has(row.parentId)&&!ids.has(row.id)){ids.add(row.id);changed=true;}}
              if(ids.size>1&&!window.confirm(`Este ensamble tiene ${ids.size-1} renglones dentro. ¿Quitar esos renglones del BOM? Los artículos de inventario se conservan.`))return;
              setEntries(entries.filter(row=>!ids.has(row.id)));if(editorParent!==null&&ids.has(editorParent)){setEditorParent(null);setDraft(empty);}
            }}><Trash2 size={14}/></button></td>
          </tr>{editorParent===e.id&&<tr><td colSpan={moreColumns?10:7} className="border-y border-emerald-400/25 bg-emerald-400/[0.04] p-3">{renderEditor()}</td></tr>}</Fragment>;
        })}
        {!entries.length && <tr><td colSpan={moreColumns?10:7} className="p-7 text-center text-white/45"><p>Agrega un ensamble principal para comenzar.</p><button disabled={busy} className={`${secondaryButtonClass} mt-3`} onClick={()=>startAdding("")}><Plus size={16}/>Agregar artículo principal</button></td></tr>}
      </tbody></table>
    </div>
    {error && editorParent === null && <p role="alert" className="rounded-xl bg-red-400/10 p-3 text-sm text-red-200">{error}</p>}
    <button disabled={busy || !entries.length || !projectCode} className={buttonClass} onClick={async () => { setBusy(true); setError(""); try { validateBomEntries(entries,projectCode); await productionCatalog(site,{action:"bom",projectId,entries,version});onSaved(); } catch(e){setError((e as Error).message);}finally{setBusy(false);} }}><Save size={16} />{busy ? "Guardando…" : "Guardar BOM y artículos"}</button>
  </div>;
}
