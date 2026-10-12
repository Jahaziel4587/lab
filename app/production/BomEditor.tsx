"use client";
import { useEffect, useState } from "react";
import { Plus, Save, Trash2 } from "lucide-react";
import { productionCatalog } from "@/lib/production/client";
import { inventoryRequest } from "@/lib/inventario/service";
import type { InventoryComponent } from "@/lib/inventario/types";
import type { InventorySite } from "@/lib/inventario/sites";
import { Field, inputClass, buttonClass, secondaryButtonClass } from "@/app/components/inventario/InventoryShell";
import { normalizedCode } from "@/lib/production/codes";
import { validateBomEntries, type BomEntry } from "@/lib/production/bom";
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
  const assemblies = entries.filter(e => /\.[12]\d{2}/.test(e.code));
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
  if (loading) return <p role="status" className="text-sm text-white/55">Cargando BOM e inventario…</p>;
  return <div className="space-y-5">
    <p className="text-sm text-white/55">Proyecto {projectCode || "no identificado"} · Captura los renglones como en tu BOM. Un código puede aparecer en varios ensambles y se conserva como un solo artículo en inventario. Las cantidades se asignan después en cada receta.</p>
    <section className="space-y-4 rounded-2xl border border-white/10 bg-white/[0.035] p-4">
      <h3 className="font-semibold">Agregar renglón</h3>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Field label="Part number Bioana"><input disabled={busy} list="bom-codes" className={inputClass} value={draft.code} placeholder={`${projectCode}.200 o MTS-005`} onChange={e => {
          const code = e.target.value; let level = draft.level;
          try { const normalized = normalizedCode(code); level = /^MTS-|\.4\d{2}/.test(normalized) ? 4 : /\.3\d{2}/.test(normalized) ? 3 : /\.2\d{2}/.test(normalized) ? 2 : 1; } catch { /* incomplete input */ }
          setDraft({ ...draft, code, level });
        }} /><datalist id="bom-codes">{components.filter(c => c.code.startsWith(projectCode + ".") || c.type === "MTS").map(c => <option key={c.id} value={c.code}>{c.name}</option>)}</datalist></Field>
        <Field label="Nombre del artículo"><input disabled={busy || !!known} className={inputClass} value={known?.name || draft.name} onChange={e => setDraft({ ...draft, name: e.target.value })} /></Field>
        <Field label="Unidad de medida"><input disabled={busy || !!known} className={inputClass} value={known?.unit || draft.unit} placeholder="pz, ml, g, m…" onChange={e => setDraft({ ...draft, unit: e.target.value })} /></Field>
        <Field label="BOM Level"><select disabled={busy} className={inputClass} value={draft.level} onChange={e => setDraft({ ...draft, level: Number(e.target.value) })}>{[1,2,3,4].map(n => <option key={n} value={n}>{n}</option>)}</select></Field>
        <div className="sm:col-span-2"><Field label="Forma parte de"><select disabled={busy} className={inputClass} value={draft.parentId} onChange={e => setDraft({ ...draft, parentId: e.target.value })}><option value="">Nivel principal del BOM</option>{assemblies.map(e => <option key={e.id} value={e.id}>{e.code} · {e.name} · renglón {entries.indexOf(e) + 1}</option>)}</select></Field></div>
      </div>
      <details className="text-sm"><summary className="cursor-pointer text-emerald-200">Datos del documento (opcionales)</summary><div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{([['description','Part description'],['spanishName','Nombre en español'],['clientCode',"Client’s part number"],['supplier','Proveedor'],['spec','SPEC / DWG / IFU']] as const).map(([key,label]) => <Field key={key} label={label}><input disabled={busy} className={inputClass} value={draft[key]} onChange={e => setDraft({ ...draft, [key]: e.target.value })} maxLength={300} /></Field>)}</div></details>
      {known && <p className="text-xs text-emerald-200">Se reutilizará el artículo existente y su unidad de medida.</p>}
      <button disabled={busy || !projectCode} className={secondaryButtonClass} onClick={add}><Plus size={16} />Agregar renglón</button>
    </section>
    <div className="flex flex-wrap items-center justify-between gap-3"><h3 className="font-semibold">BOM · {entries.length} renglones · {new Set(entries.map(e => e.code)).size} artículos</h3><p className="text-xs text-white/45">Desplaza la tabla para ver todas las columnas.</p></div>
    <div className="overflow-x-auto rounded-2xl border border-white/10">
      <table className="w-full min-w-[1650px] text-left text-sm"><thead className="bg-white/[0.06] text-xs text-white/55"><tr>{["BOM Level", "Part number Bioana", "Nombre", "Unidad", "Forma parte de", "Part description", "Nombre en español", "Client’s part number", "Proveedor", "SPEC / DWG / IFU", ""].map((label,i) => <th key={i} className="px-3 py-3 font-medium">{label}</th>)}</tr></thead><tbody>
        {entries.map((e,index) => <tr key={e.id} className={`border-t border-white/10 ${/\.[12]\d{2}/.test(e.code) ? "bg-emerald-400/[0.06]" : "bg-white/[0.02]"}`}>
          <td className="p-2"><select aria-label={`Nivel renglón ${index+1}`} disabled={busy} className={inputClass} value={e.level} onChange={ev => change(e.id,"level",Number(ev.target.value))}>{[1,2,3,4].map(n => <option key={n}>{n}</option>)}</select></td>
          <td className="px-3 py-3"><span className="font-semibold text-emerald-200">{e.code}</span><span className="block text-[10px] text-white/40">Renglón {index+1}</span></td>
          <td className="min-w-48 px-3 py-3">{e.name}</td><td className="px-3 py-3">{e.unit}</td>
          <td className="min-w-64 p-2"><select aria-label={`Ensamble de ${e.code}, renglón ${index+1}`} disabled={busy} className={inputClass} value={e.parentId} onChange={ev => change(e.id,"parentId",ev.target.value)}><option value="">Nivel principal</option>{assemblies.filter(a => a.id!==e.id && a.code!==e.code).map(a => <option key={a.id} value={a.id}>{a.code} · renglón {entries.indexOf(a)+1}</option>)}</select></td>
          {(['description','spanishName','clientCode','supplier','spec'] as const).map(key => <td key={key} className="min-w-44 p-2"><input aria-label={`${key} ${e.code}, renglón ${index+1}`} disabled={busy} className={inputClass} value={e[key]} maxLength={300} onChange={ev => change(e.id,key,ev.target.value)} /></td>)}
          <td className="p-2"><button aria-label={`Quitar renglón ${index+1}`} disabled={busy} className="p-3 text-red-200" onClick={() => {
            const ids = new Set([e.id]); let changed = true;
            while(changed) { changed=false; for(const row of entries) if(ids.has(row.parentId)&&!ids.has(row.id)){ids.add(row.id);changed=true;} }
            if(ids.size>1 && !window.confirm(`Este ensamble tiene ${ids.size-1} renglones dentro. ¿Quitar todos esos renglones del BOM? Los artículos de inventario se conservan.`)) return;
            setEntries(entries.filter(row=>!ids.has(row.id))); if(ids.has(draft.parentId)) setDraft({...draft,parentId:""});
          }}><Trash2 size={16} /></button></td>
        </tr>)}
        {!entries.length && <tr><td colSpan={11} className="p-7 text-center text-white/45">Agrega el ensamble principal y después sus subensambles y materiales.</td></tr>}
      </tbody></table>
    </div>
    {error && <p role="alert" className="rounded-xl bg-red-400/10 p-3 text-sm text-red-200">{error}</p>}
    <button disabled={busy || !entries.length || !projectCode} className={buttonClass} onClick={async () => { setBusy(true); setError(""); try { validateBomEntries(entries,projectCode); await productionCatalog(site,{action:"bom",projectId,entries,version});onSaved(); } catch(e){setError((e as Error).message);}finally{setBusy(false);} }}><Save size={16} />{busy ? "Guardando…" : "Guardar BOM y artículos"}</button>
  </div>;
}
