"use client";
import { useEffect,useRef,useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import PizZip from 'pizzip';
import { ArrowLeft, ChevronDown, ChevronRight, FileText, Upload, Search, Download, Pencil, Plus, Trash2, LoaderCircle, CheckCircle2, AlertCircle } from 'lucide-react';
import InventoryDialog from '@/app/components/inventario/InventoryDialog';
import { useAuth } from '@/src/Context/AuthContext';
import { readDhrPdf } from '@/lib/dhr/pdf';
import { sections,recordKey } from '@/lib/dhr/parser.mjs';
type Row={id:string;section:string;text:string};
type Pdf={id:string;name:string;path:string;records:string[];section:string};
const control='min-h-11 w-full min-w-0 rounded-xl border border-white/10 bg-white/[0.05] px-3 py-2 text-base sm:text-sm text-white outline-none focus:border-emerald-400/40 focus:ring-2 focus:ring-emerald-400/15 [&>option]:bg-[#171b19]';
const secondary='inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white/75 transition hover:bg-white/[0.08] disabled:opacity-40';
const button='rounded-xl bg-emerald-500 px-4 py-3 font-semibold text-slate-950 disabled:opacity-40 disabled:cursor-not-allowed';
export default function DhrPage(){
 const {user,loading}=useAuth(),router=useRouter();
 const [rows,setRows]=useState<Row[]>([]),[source,setSource]=useState(''),[hash,setHash]=useState(''),[cover,setCover]=useState<File|null>(null);
 const [files,setFiles]=useState<Pdf[]>([]),[selected,setSelected]=useState<string[]>([]),[searched,setSearched]=useState<string[]>([]);
 const [busy,setBusy]=useState(false),[status,setStatus]=useState(''),[error,setError]=useState(''),[sectionErrors,setSectionErrors]=useState<Record<string,string>>({});
 const [skipped,setSkipped]=useState<string[]>([]);
 const [openSection,setOpenSection]=useState(''),[query,setQuery]=useState(''),[filter,setFilter]=useState('all');
 const [editing,setEditing]=useState<Row|null>(null);
 const fileInput=useRef<HTMLInputElement>(null);
 function invalidate(section:string){setFiles(previous=>previous.filter(f=>f.section!==section));setSelected(previous=>previous.filter(id=>!id.startsWith(section+':')));setSearched(previous=>previous.filter(id=>id!==section));setSectionErrors(previous=>{const next={...previous};delete next[section];return next;});setError('');setStatus('Registro actualizado. Vuelve a buscar esta sección.');}
 function addRecord(section:string){setEditing({id:crypto.randomUUID(),section,text:''});}
 function saveRecord(){if(!editing?.text.trim())return;setRows(previous=>previous.some(row=>row.id===editing.id)?previous.map(row=>row.id===editing.id?editing:row):[...previous,editing]);setSkipped(previous=>previous.filter(id=>id!==editing.section));invalidate(editing.section);setOpenSection(editing.section);setQuery('');setFilter('all');setEditing(null);}

 useEffect(()=>{if(!loading&&!user)router.replace('/login');},[loading,user,router]);
 function reset(){setFiles([]);setSelected([]);setSearched([]);setSectionErrors({});setError('');}
 async function upload(file:File){setBusy(true);reset();setRows([]);setSource('');setCover(null);setSkipped([]);
  try{const result=await readDhrPdf(file,(n,total)=>setStatus(`Leyendo página ${n} de ${total}…`));setRows(result.records);setSource(result.fileName);setHash(result.sha256);setCover(file);setSkipped(result.skipped);setOpenSection('');setQuery('');setFilter('all');setStatus('Revisa los registros extraídos antes de buscar en Box.');}
  catch(e){setError(e instanceof Error?e.message:'No se pudo leer la carátula.');setStatus('');}finally{setBusy(false);}
 }
 async function search(only?:string){if(!user)return;setBusy(true);setError('');
  const found:Pdf[]=only?files.filter(f=>f.section!==only):[],done:string[]=only?searched.filter(id=>id!==only):[],errors:Record<string,string>=only?Object.fromEntries(Object.entries(sectionErrors).filter(([id])=>id!==only)):{};
  setFiles([...found]);setSearched([...done]);setSectionErrors({...errors});setSelected(previous=>only?previous.filter(id=>!id.startsWith(only+':')):[]);
  try{for(const section of sections){const records=rows.filter(r=>r.section===section.id&&r.text.trim());if((only&&section.id!==only)||!('folder' in section)||!records.length)continue;
   setStatus(`Buscando ${section.label}…`);
   try{const token=await user.getIdToken();const response=await fetch('/api/dhr/search',{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`},body:JSON.stringify({section:section.id,records})});const data=await response.json();if(!response.ok)throw new Error(data.error||'Falló la búsqueda.');found.push(...data.files.map((f:Omit<Pdf,'section'>)=>({...f,section:section.id})));done.push(section.id);}
   catch(e){errors[section.id]=e instanceof Error?e.message:'No se pudo consultar.';}
   setFiles([...found]);setSearched([...done]);setSectionErrors({...errors});
  }setStatus(only?'Sección actualizada. Las demás conservan sus resultados.':'Búsqueda terminada. Revisa y selecciona los documentos.');}
  finally{setBusy(false);}
 }
 async function download(){if(!user)return;setBusy(true);setError('');
  try{const zip=new PizZip(),manifest:unknown[]=[];let total=0;
   if(cover){const data=await cover.arrayBuffer();total+=data.byteLength;zip.file('00-Caratula.pdf',data);}
   // The same Box PDF can satisfy multiple rows; include its original only once.
   const unique=[...new Map(files.filter(f=>selected.includes(f.section+':'+f.id)).map(f=>[f.id,f])).values()];
   for(let n=0;n<unique.length;n++){const file=unique[n];setStatus(`Descargando ${n+1} de ${unique.length}: ${file.name}`);
    const token=await user.getIdToken();const response=await fetch(`/api/dhr/file?id=${file.id}&section=${file.section}`,{headers:{Authorization:`Bearer ${token}`}});
    if(!response.ok){const data=await response.json();throw new Error(`${file.name}: ${data.error}`);}
    const bytes=await response.arrayBuffer();if(/\.pdf$/i.test(file.name)&&new TextDecoder().decode(bytes.slice(0,5))!=='%PDF-')throw new Error(`${file.name}: no se recibió un PDF válido.`);
    total+=bytes.byteLength;if(total>150*1024*1024)throw new Error('La selección supera 150 MB. Descarga en grupos más pequeños.');
    const name=`${String(n+1).padStart(3,'0')}-${file.id}-${file.name.replace(/[\\/:*?"<>|\u0000-\u001f]/g,'_')}`;
    zip.file(`${sections.find(s=>s.id===file.section)?.label}/${name}`,bytes);
    manifest.push({...file,version:response.headers.get('X-Box-Version-Id')});
   }
   zip.file('Resumen-DHR.json',JSON.stringify({caratula:source,sha256:hash,fecha:new Date().toISOString(),registros:rows,documentos:manifest,seccionesConsultadas:searched,errores:sectionErrors},null,2));
   const url=URL.createObjectURL(zip.generate({type:'blob',compression:'STORE'})),a=document.createElement('a');a.href=url;a.download=`${source.replace(/\.pdf$/i,'')||'DHR'}.zip`;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);setStatus('ZIP generado. Revisa los pendientes antes de considerar completo el expediente.');
  }catch(e){setError((e instanceof Error?e.message:'Falló la descarga.')+' No se generó un ZIP incompleto.');setStatus('');}finally{setBusy(false);}
 }
 const candidatesFor=(row:Row)=>files.filter(file=>file.records.includes(row.id));
 const rowState=(row:Row)=>{
  if(!sections.find(s=>s.id===row.section)?.folder)return 'manual';
  if(sectionErrors[row.section])return 'error';
  if(!searched.includes(row.section))return 'pending';
  const matches=candidatesFor(row);
  if(matches.some(file=>selected.includes(file.section+':'+file.id)))return 'selected';
  return matches.length===0?'missing':matches.length>1?'multiple':'found';
 };
 const labels:Record<string,string>={manual:'Manual',error:'Error de consulta',pending:'Sin buscar',selected:'Seleccionado',missing:'No encontrado',multiple:'Varias coincidencias',found:'Por confirmar'};
 const tones:Record<string,string>={manual:'text-white/45',error:'text-red-300',pending:'text-white/45',selected:'text-emerald-300',missing:'text-amber-200',multiple:'text-amber-200',found:'text-emerald-200'};
 const visibleRows=rows.filter(row=>(!query||row.text.toLowerCase().includes(query.toLowerCase()))&&(filter==='all'||(filter==='review'?['missing','multiple','error','pending','found'].includes(rowState(row)):rowState(row)===filter)));
 const digitalRows=rows.filter(row=>!!sections.find(s=>s.id===row.section)?.folder);
 const needsReview=digitalRows.filter(row=>!['selected'].includes(rowState(row))).length;
 const countSelected=new Set(selected.map(id=>id.split(':')[1])).size;
 if(loading||!user)return null;
 return <main className="mx-auto max-w-7xl space-y-4 px-3 py-5 pb-32 text-white sm:px-8 sm:py-8 sm:pb-28">
  <Link href="/" className={`${secondary} !rounded-full`}><ArrowLeft size={15}/>Volver</Link>
  <header className="flex flex-wrap items-center justify-between gap-3">
   <div><p className="text-xs font-semibold uppercase tracking-widest text-emerald-300">Quality</p><h1 className="mt-1 text-2xl font-semibold sm:text-3xl">DHR</h1><p className="mt-1 text-sm text-white/55">Carátula, registros y documentos de Box en un solo lugar.</p></div>
   <button className={secondary} disabled={busy} onClick={()=>fileInput.current?.click()}><Upload size={16}/>{source?'Cambiar carátula':'Subir carátula PDF'}</button>
   <input ref={fileInput} aria-label="Subir carátula PDF" className="hidden" type="file" accept="application/pdf,.pdf" disabled={busy} onChange={e=>{const file=e.target.files?.[0];if(file)void upload(file);e.target.value='';}}/>
  </header>
  {error&&<p role="alert" className="rounded-2xl border border-red-400/20 bg-red-400/5 p-3 text-sm text-red-200">{error}</p>}
  {status&&<p role="status" aria-live="polite" className="flex items-start gap-2 rounded-xl border border-white/10 bg-white/[0.035] px-3 py-2 text-sm text-white/70">{busy?<LoaderCircle size={16} className="mt-0.5 shrink-0 animate-spin text-emerald-300"/>:<CheckCircle2 size={16} className="mt-0.5 shrink-0 text-emerald-300"/>}<span className="min-w-0 break-words">{status}</span></p>}
  {!source&&!busy&&<button disabled={busy} onClick={()=>fileInput.current?.click()} className="flex w-full flex-col items-center gap-3 rounded-3xl border border-dashed border-white/15 bg-white/[0.025] px-5 py-12 text-center transition hover:border-emerald-300/40 hover:bg-white/5"><FileText size={32} className="text-emerald-300"/><span className="text-lg font-medium">Sube la carátula de tu DHR</span><span className="text-sm text-white/45">PDF con texto seleccionable · Hasta 20 MB</span></button>}
  {source&&<>
   <section aria-label="Resumen del expediente" className="rounded-2xl border border-white/10 bg-white/[0.035] p-4 backdrop-blur-xl sm:rounded-3xl">
    <div className="flex items-center gap-3"><FileText size={21} className="shrink-0 text-emerald-300"/><p className="min-w-0 truncate text-sm font-medium" title={source}>{source}</p><span className="ml-auto shrink-0 text-xs text-white/45">{sections.filter(s=>rows.some(r=>r.section===s.id)).length} secciones</span></div>
    <div className="mt-3 grid grid-cols-3 divide-x divide-white/10 border-t border-white/10 pt-3 text-center"><div><p className="text-xl font-semibold">{rows.length}</p><p className="text-xs text-white/45">Registros</p></div><div><p className="text-xl font-semibold text-amber-200">{needsReview}</p><p className="text-xs text-white/45">Por revisar</p></div><div><p className="text-xl font-semibold text-emerald-300">{countSelected}</p><p className="text-xs text-white/45">Archivos elegidos</p></div></div>
   </section>
   <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
    <label className="relative min-w-0 flex-1"><Search size={16} className="pointer-events-none absolute left-3 top-3.5 text-white/40"/><input aria-label="Filtrar registros" className={`${control} !pl-9`} placeholder="Buscar código o título…" value={query} onChange={e=>{setQuery(e.target.value);setOpenSection('*');}}/></label>
    <select aria-label="Filtrar por estado" className={`${control} sm:!w-52`} value={filter} onChange={e=>{setFilter(e.target.value);setOpenSection('*');}}><option value="all">Todos los registros</option><option value="review">Por revisar</option><option value="missing">No encontrados</option><option value="multiple">Varias coincidencias</option><option value="selected">Seleccionados</option><option value="manual">Manuales</option></select>
    <button className={secondary} onClick={()=>setOpenSection(openSection?'':'*')}>{openSection?'Contraer todo':'Expandir todo'}</button>
   </div>
   <div className="space-y-2">
   {sections.filter(section=>rows.some(r=>r.section===section.id)).map(section=>{
    const sectionRows=rows.filter(r=>r.section===section.id),visible=visibleRows.filter(r=>r.section===section.id),expanded=openSection==='*'||openSection===section.id;
    const manual=!('folder' in section),chosen=sectionRows.filter(r=>rowState(r)==='selected').length;
    if((query||filter!=='all')&&!visible.length)return null;
    return <section key={section.id} className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.035] backdrop-blur-xl">
     <button aria-expanded={expanded} aria-controls={`section-${section.id}`} className="flex min-h-16 w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-white/[0.04]" onClick={()=>setOpenSection(expanded?'':section.id)}>
      {expanded?<ChevronDown size={17} className="shrink-0 text-emerald-300"/>:<ChevronRight size={17} className="shrink-0 text-white/45"/>}
      <span className="min-w-0 flex-1"><span className="block text-sm font-medium sm:text-base">{section.label}</span><span className="mt-0.5 block text-xs text-white/45">{sectionRows.length} registros{manual?' · Incorporación manual':searched.includes(section.id)?` · ${chosen} confirmados`:' · Pendiente de búsqueda'}</span></span>
      {sectionErrors[section.id]?<AlertCircle size={17} className="shrink-0 text-red-300"/>:manual?<span className="rounded-lg bg-white/5 px-2 py-1 text-xs text-white/45">Manual</span>:<span className={`shrink-0 rounded-lg px-2 py-1 text-xs ${chosen===sectionRows.length?'bg-emerald-400/10 text-emerald-300':'bg-white/5 text-white/55'}`}>{chosen}/{sectionRows.length}</span>}
     </button>
     {expanded&&<div id={`section-${section.id}`} className="border-t border-white/10">
      <div className="flex flex-wrap items-center justify-between gap-2 bg-black/10 px-4 py-2">
       <p className="text-xs text-white/45">{manual?'Estos registros se incorporan manualmente.':searched.includes(section.id)?'Confirma los archivos que necesitas.':'Revisa los títulos y busca esta sección en Box.'}</p>
       <div className="flex gap-2"><button className={`${secondary} !min-h-9 !px-2.5 !text-xs`} disabled={busy} onClick={()=>addRecord(section.id)}><Plus size={14}/>Agregar</button>{!manual&&<button className={`${secondary} !min-h-9 !px-2.5 !text-xs`} disabled={busy} onClick={()=>void search(section.id)}><Search size={14}/>{searched.includes(section.id)?'Volver a buscar':'Buscar sección'}</button>}</div>
      </div>
      {sectionErrors[section.id]&&<p role="alert" className="px-4 py-3 text-sm text-red-200">{sectionErrors[section.id]}</p>}
      <div className="divide-y divide-white/10">{visible.map(row=>{const candidates=candidatesFor(row),state=rowState(row);return <div key={row.id} className="px-4 py-3">
       <div className="flex items-start gap-2"><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-x-3 gap-y-1"><p className="text-sm font-medium text-white/90">{recordKey(row.section,row.text)||'Registro sin código'}</p><span className={`text-[11px] ${tones[state]}`}>{labels[state]}</span></div><p className="mt-1 line-clamp-2 break-words text-xs leading-relaxed text-white/50" title={row.text}>{row.text}</p></div>
        <button aria-label={`Editar ${recordKey(row.section,row.text)||'registro'}`} title="Editar registro" className="rounded-lg p-2.5 text-white/45 hover:bg-white/5 hover:text-emerald-300 disabled:opacity-40" disabled={busy} onClick={()=>setEditing({...row})}><Pencil size={15}/></button>
       </div>
       {candidates.length>0&&<div className="mt-2 space-y-1">{candidates.map(file=><label key={file.id} className={`flex cursor-pointer items-start gap-2.5 rounded-lg border px-3 py-2 transition ${selected.includes(file.section+':'+file.id)?'border-emerald-400/20 bg-emerald-400/[0.06]':'border-white/5 bg-black/10 hover:bg-white/5'}`}>
        <input type="checkbox" className="mt-0.5 h-4 w-4 shrink-0 accent-emerald-400" disabled={busy} checked={selected.includes(file.section+':'+file.id)} onChange={e=>setSelected(previous=>e.target.checked?[...new Set([...previous,file.section+':'+file.id])]:previous.filter(id=>id!==file.section+':'+file.id))}/>
        <span className="min-w-0 flex-1"><span className="block break-words text-xs text-white/85">{file.name}</span><span className="mt-0.5 block truncate text-[11px] text-white/35" title={file.path}>{file.path}</span></span>
       </label>)}</div>}
      </div>})}</div>
     </div>}
    </section>;
   })}
   {!visibleRows.length&&<p className="rounded-2xl border border-dashed border-white/10 p-6 text-center text-sm text-white/45">No hay registros con estos filtros.</p>}
   </div>
   <details className="rounded-2xl border border-white/10 px-4 py-3 text-xs text-white/50"><summary className="cursor-pointer text-sm text-white/65">Secciones no aplicables y ayuda</summary><div className="mt-3 space-y-2">{skipped.length>0&&<p>No aplica: {skipped.map(id=>sections.find(s=>s.id===id)?.label).join(', ')}.</p>}<p>El ZIP incluye la carátula, los archivos seleccionados y un resumen de trazabilidad. El historial puede conservar su Excel original. Hasta 50 MB por archivo y 150 MB por descarga.</p><p>Editar un registro permite volver a buscar solo su sección. Las demás conservan sus resultados y selecciones.</p>
    <label className="block pt-2">Agregar un registro a otra sección<select className={`${control} mt-2`} value="" disabled={busy} onChange={e=>{if(e.target.value)addRecord(e.target.value);}}><option value="">Selecciona una sección</option>{sections.map(section=><option key={section.id} value={section.id}>{section.label}</option>)}</select></label>
   </div></details>
   <div className="sticky bottom-3 z-20 flex flex-wrap items-center gap-2 rounded-2xl border border-white/15 bg-[#0d1512]/95 p-3 shadow-2xl backdrop-blur-xl sm:bottom-5">
    <p className="mr-auto text-xs text-white/55"><span className="font-medium text-white">{countSelected}</span> archivos elegidos<span className="hidden sm:inline"> · {needsReview} registros por revisar</span></p>
    <button className={secondary} disabled={busy||!digitalRows.length} onClick={()=>void search()}><Search size={15}/>{searched.length?'Buscar todo de nuevo':'Buscar en Box'}</button>
    <button className={`${button} inline-flex min-h-11 items-center justify-center gap-2 !py-2 !text-sm`} disabled={busy||!selected.length} onClick={download}><Download size={15}/>Descargar ZIP</button>
   </div>
  </>}
  {editing&&<InventoryDialog label="Quality · DHR" title="Editar registro" onClose={()=>setEditing(null)}>
   <h2 className="text-xl font-semibold">{rows.some(row=>row.id===editing.id)?'Editar registro':'Agregar registro'}</h2><p className="mt-1 text-sm text-white/50">{sections.find(section=>section.id===editing.section)?.label}</p>
   <label className="mt-5 block text-sm text-white/65">Nombre y referencia del documento<textarea autoFocus className={`${control} mt-2 min-h-32 resize-y`} rows={5} value={editing.text} onChange={e=>setEditing({...editing,text:e.target.value})}/></label>
   <p className="mt-2 text-xs text-white/40">Conserva código, revisión, PO y fechas que correspondan.</p>
   <div className="mt-5 flex flex-wrap items-center justify-end gap-2">{rows.some(row=>row.id===editing.id)&&<button className={`${secondary} mr-auto !text-red-200`} onClick={()=>{setRows(previous=>previous.filter(row=>row.id!==editing.id));invalidate(editing.section);setEditing(null);}}><Trash2 size={15}/>Quitar</button>}<button className={secondary} onClick={()=>setEditing(null)}>Cancelar</button><button className={button} disabled={!editing.text.trim()} onClick={saveRecord}>Guardar</button></div>
  </InventoryDialog>}
 </main>;
}
