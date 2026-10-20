"use client";
import {useEffect,useRef,useState} from "react";
import {Upload,Save,Trash2,Plus,FileText,LoaderCircle} from "lucide-react";
import {useAuth} from "@/src/Context/AuthContext";
import {readMsopPdf,type MsopRow,type MsopSource,type MsopSection} from "@/lib/production/msop-pdf";
import {MSOP_SECTIONS} from "@/lib/production/msop-parser.mjs";
import {normalizedCode} from "@/lib/production/codes";
import {inputClass,buttonClass,secondaryButtonClass,Field} from "@/app/components/inventario/InventoryShell";
import type {InventoryComponent} from "@/lib/inventario/types";
import type {InventorySite} from "@/lib/inventario/sites";
const cellInput=inputClass+" !min-h-9 !rounded-md !border-transparent !bg-transparent !px-2 !py-1 !text-xs hover:!border-white/15 focus:!border-emerald-400/40";
type Existing=Pick<InventoryComponent,"id"|"code"|"name"|"unit"> & {sites:string[];unitConflict:boolean};
type Saved={rows:MsopRow[];source:MsopSource;version:number};
export default function MsopEditor({projectId,site,onSaved,onBusyChange}:{projectId:string;site:InventorySite;onSaved:()=>void;onBusyChange?:(busy:boolean)=>void}){
 const {user}=useAuth();
 const [rows,setRows]=useState<MsopRow[]>([]),[source,setSource]=useState<MsopSource|null>(null),[existing,setExisting]=useState<Existing[]>([]),[version,setVersion]=useState(0),[projectCode,setProjectCode]=useState("");
 const [loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[error,setError]=useState(""),[progress,setProgress]=useState(""),[pdfUrl,setPdfUrl]=useState("");
 const urlRef=useRef(""),live=useRef(true);
 async function request(body?:object){
  if(!user)throw new Error("Inicia sesión.");
  const query=new URLSearchParams({projectId,site});
  const r=await fetch("/api/production/msop?"+query,{method:body?"POST":"GET",headers:{Authorization:"Bearer "+await user.getIdToken(),"Content-Type":"application/json"},...(body?{body:JSON.stringify({...body,projectId,site})}:{})});
  const d=await r.json();if(!r.ok)throw new Error(d.error||"No se pudo cargar el MSOP.");return d;
 }
 useEffect(()=>{let active=true;if(!user)return;request().then((d:{msop:Saved|null;projectCode:string;existing:Existing[]})=>{if(!active)return;setRows(d.msop?.rows||[]);setSource(d.msop?.source||null);setVersion(d.msop?.version||0);setProjectCode(d.projectCode);setExisting(d.existing);}).catch(e=>{if(active)setError(e.message);}).finally(()=>{if(active)setLoading(false);});return()=>{active=false;};},[projectId,site,user]);
 useEffect(()=>{live.current=true;return()=>{live.current=false;if(urlRef.current)URL.revokeObjectURL(urlRef.current);};},[]);
 function working(value:boolean){setBusy(value);onBusyChange?.(value);}
 function codeOf(code:string){try{return normalizedCode(code);}catch{return "";}}
 function known(code:string){const key=codeOf(code);return existing.find(c=>codeOf(c.code)===key);}
 function update(id:string,key:keyof MsopRow,value:string){
  setRows(prior=>prior.map(row=>{
   const selected=prior.find(r=>r.id===id)!;
   if(row.id!==id && !((key==="unit"||key==="name")&&codeOf(selected.code)&&codeOf(row.code)===codeOf(selected.code)))return row;
   const next={...row,[key]:value};
   if(key==="code"){const k=known(value);if(k){next.name=k.name;next.unit=k.unit;}else next.unit="";}
   return next;
  }));
 }
 const missing=rows.filter(r=>(!codeOf(r.code)||(!codeOf(r.code).startsWith(projectCode+".")&&!codeOf(r.code).startsWith("MTS-")))||!r.name.trim()||!r.unit.trim()||known(r.code)?.unitConflict).length;
 const unique=new Set(rows.map(r=>codeOf(r.code)).filter(Boolean)).size;
 if(loading)return <p className="text-sm text-white/55">Cargando catálogo e inventario…</p>;
 return <div className="space-y-5">
  <p className="text-sm text-white/55">Proyecto {projectCode} · Importa las tablas del MSOP y revisa los artículos. La unidad es obligatoria para los nuevos; los existentes reutilizan nombre y unidad de inventario. Nada se crea al leer el PDF.</p>
  <section className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
   <div className="flex flex-wrap items-center justify-between gap-3"><div><h3 className="font-semibold">Master Standard Operating Procedure</h3><p className="mt-1 text-xs text-white/45">{source?source.fileName+" · "+source.pageCount+" páginas":"Selecciona el PDF del proyecto (máximo 20 MB)."}</p></div>
    <label className={secondaryButtonClass+" cursor-pointer"}><Upload size={16}/>{source?"Sustituir PDF":"Subir PDF MSOP"}<input className="sr-only" disabled={busy||!projectCode} type="file" accept=".pdf,application/pdf" onChange={async e=>{
     const file=e.target.files?.[0];e.target.value="";if(!file)return;
     if(rows.length&&!window.confirm("La extracción nueva reemplazará los renglones de esta revisión. No se eliminarán artículos ni existencias del inventario. ¿Continuar?"))return;
     working(true);setError("");setProgress("Leyendo documento…");
     try{
      const d=await readMsopPdf(file,(n,total)=>{if(live.current)setProgress("Leyendo página "+n+" de "+total+"…");});
      if(d.source.documentProjectCode&&d.source.documentProjectCode!==projectCode)throw new Error("El MSOP corresponde al proyecto "+d.source.documentProjectCode+", no al "+projectCode+".");
      if(!live.current)return;
      const enriched=d.rows.map(row=>{const k=known(row.code);return k?{...row,code:k.code,name:k.name,unit:k.unit}:row;});
      setRows(enriched);setSource(d.source);
      if(urlRef.current)URL.revokeObjectURL(urlRef.current);urlRef.current=URL.createObjectURL(file);setPdfUrl(urlRef.current);
     }catch(err){if(live.current)setError(err instanceof Error?err.message:"No se pudo leer el PDF.");}finally{if(live.current){working(false);setProgress("");}}
    }}/></label>
   </div>
   {progress&&<p role="status" className="mt-3 flex items-center gap-2 text-sm text-emerald-200"><LoaderCircle className="animate-spin" size={16}/>{progress}</p>}
   {pdfUrl&&<a className="mt-3 inline-flex items-center gap-2 text-sm text-emerald-200 underline" href={pdfUrl} target="_blank" rel="noreferrer"><FileText size={15}/>Abrir PDF para revisar tablas</a>}
   {source?.warnings?.length? <div className="mt-3 space-y-1 rounded-xl bg-amber-400/5 p-3 text-xs text-amber-200">{source.warnings.map((w,i)=><p key={i}>{w}</p>)}</div>:null}
  </section>
  <div className="flex flex-wrap justify-between gap-3 text-sm"><p>{rows.length} renglones · {unique} artículos únicos</p><p className={missing?"text-amber-200":"text-emerald-200"}>{missing?missing+" renglones requieren código, nombre o unidad":"Información completa para finalizar"}</p></div>
  {MSOP_SECTIONS.map(section=><section key={section.id} className="overflow-hidden rounded-2xl border border-white/10">
   <div className="flex flex-wrap items-center justify-between gap-3 bg-white/[0.09] px-4 py-3"><h3 className="text-sm font-semibold">{section.label}</h3><button disabled={busy||!source||rows.length>=600} className="inline-flex min-h-9 items-center gap-2 rounded-lg px-3 text-xs text-emerald-200 hover:bg-white/10" onClick={()=>setRows([...rows,{id:crypto.randomUUID(),code:"",name:"",unit:"",page:0,section:section.id as MsopSection,supplier:"",spec:""}])}><Plus size={15}/>Agregar renglón</button></div>
   <div className="overflow-x-auto"><table className="w-full min-w-[950px] border-collapse text-left text-xs"><thead className="bg-[#25312b] text-white/60"><tr>{["Código / Part number","Descripción / nombre","Unidad de medida","Estado","Proveedor","SPEC","Página",""].map((t,i)=><th key={i} className="border-r border-white/10 px-3 py-2 font-medium">{t}</th>)}</tr></thead><tbody>
    {rows.filter(r=>r.section===section.id).map(r=>{const k=known(r.code);return <tr key={r.id} className="border-t border-white/10 bg-white/[0.015] hover:bg-white/[0.04]">
     <td className="w-40 border-r border-white/10 p-1"><input aria-label="Código de artículo" disabled={busy} className={cellInput} maxLength={100} value={r.code} onChange={e=>update(r.id,"code",e.target.value)}/></td>
     <td className="min-w-64 border-r border-white/10 p-1"><input aria-label={"Nombre "+r.code} disabled={busy||!!k} className={cellInput} maxLength={300} value={k?.name||r.name} onChange={e=>update(r.id,"name",e.target.value)}/></td>
     <td className="min-w-36 border-r border-white/10 p-1">{k?<span className="px-2 text-emerald-200">{k.unit}</span>:<><input list="msop-units" aria-label={"Unidad de "+r.code} disabled={busy} className={cellInput+(!r.unit?" !border-amber-300/30":"")} maxLength={40} placeholder="Selecciona o escribe…" value={r.unit} onChange={e=>update(r.id,"unit",e.target.value)}/></>}</td>
     <td className="min-w-40 border-r border-white/10 px-3 py-2">{k?.unitConflict?<span className="text-red-200">Unidades B1/B2 distintas. Corrige el artículo en inventario.</span>:k?<span className="text-emerald-200">Existente · {k.sites.join(" / ")}</span>:<span className="text-amber-200">{r.unit?"Nuevo · listo":"Nuevo · falta unidad"}</span>}</td>
     {(["supplier","spec"] as const).map(key=><td key={key} className="min-w-32 border-r border-white/10 p-1"><input aria-label={key+" "+r.code} disabled={busy} className={cellInput} maxLength={300} value={r[key]} onChange={e=>update(r.id,key,e.target.value)}/></td>)}
     <td className="px-3 py-2">{r.page&&pdfUrl?<a href={pdfUrl+"#page="+r.page} className="text-emerald-200 underline" target="_blank" rel="noreferrer">{r.page}</a>:r.page||"Manual"}</td>
     <td className="px-2"><button disabled={busy} className="inline-flex h-9 w-9 items-center justify-center rounded-md text-white/40 hover:bg-red-400/10 hover:text-red-200" aria-label={"Excluir "+(r.code||"renglón")} title="Excluir renglón de esta carga" onClick={()=>setRows(rows.filter(row=>row.id!==r.id))}><Trash2 size={15}/></button></td>
    </tr>;})}
    {!rows.some(r=>r.section===section.id)&&<tr><td colSpan={8} className="p-6 text-center text-white/40">Sin renglones detectados. Revisa la tabla del PDF y agrega los faltantes.</td></tr>}
   </tbody></table></div>
  </section>)}
  <datalist id="msop-units">{["pz","caja","roll","m","kg","g","L","mL"].map(unit=><option key={unit} value={unit}/>)}</datalist>
  {error&&<p role="alert" className="rounded-xl border border-red-400/20 bg-red-400/5 p-3 text-sm text-red-200">{error}</p>}
  <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-4"><p className="max-w-2xl text-xs text-white/50">Al finalizar se guarda este catálogo para las recetas y se crean los artículos faltantes en B1 y B2, sin lotes ni existencias. Los artículos y cantidades existentes se conservan.</p><button disabled={busy||!source||!rows.length||!!missing||unique>200} className={buttonClass} onClick={async()=>{
   working(true);setError("");try{await request({rows,source,version});working(false);onSaved();}catch(err){setError(err instanceof Error?err.message:"No se pudo finalizar.");}finally{if(live.current)working(false);}
  }}><Save size={16}/>{busy?"Procesando…":"Finalizar carga de MSOP"}</button></div>
  {unique>200&&<p className="text-sm text-red-200">Esta versión admite hasta 200 artículos únicos por carga.</p>}
 </div>;
}
