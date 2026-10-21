"use client";
import { useEffect,useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import PizZip from 'pizzip';
import { useAuth } from '@/src/Context/AuthContext';
import { readDhrPdf } from '@/lib/dhr/pdf';
import { sections,recordKey } from '@/lib/dhr/parser.mjs';
type Row={id:string;section:string;text:string};
type Pdf={id:string;name:string;path:string;records:string[];section:string};
const control='w-full rounded-xl border border-white/20 bg-slate-900 p-3 text-white';
const button='rounded-xl bg-emerald-500 px-4 py-3 font-semibold text-slate-950 disabled:opacity-40 disabled:cursor-not-allowed';
export default function DhrPage(){
 const {user,loading}=useAuth(),router=useRouter();
 const [rows,setRows]=useState<Row[]>([]),[source,setSource]=useState(''),[hash,setHash]=useState(''),[cover,setCover]=useState<File|null>(null);
 const [files,setFiles]=useState<Pdf[]>([]),[selected,setSelected]=useState<string[]>([]),[searched,setSearched]=useState<string[]>([]);
 const [busy,setBusy]=useState(false),[status,setStatus]=useState(''),[error,setError]=useState(''),[sectionErrors,setSectionErrors]=useState<Record<string,string>>({});
 const [skipped,setSkipped]=useState<string[]>([]);
 useEffect(()=>{if(!loading&&!user)router.replace('/login');},[loading,user,router]);
 function reset(){setFiles([]);setSelected([]);setSearched([]);setSectionErrors({});setError('');}
 async function upload(file:File){setBusy(true);reset();setRows([]);setSource('');setCover(null);setSkipped([]);
  try{const result=await readDhrPdf(file,(n,total)=>setStatus(`Leyendo página ${n} de ${total}…`));setRows(result.records);setSource(result.fileName);setHash(result.sha256);setCover(file);setSkipped(result.skipped);setStatus('Revisa los registros extraídos antes de buscar en Box.');}
  catch(e){setError(e instanceof Error?e.message:'No se pudo leer la carátula.');setStatus('');}finally{setBusy(false);}
 }
 async function search(){if(!user)return;reset();setBusy(true);
  const found:Pdf[]=[],done:string[]=[],errors:Record<string,string>={};
  try{for(const section of sections){const records=rows.filter(r=>r.section===section.id&&r.text.trim());if(!('folder' in section)||!records.length)continue;
   setStatus(`Buscando ${section.label}…`);
   try{const token=await user.getIdToken();const response=await fetch('/api/dhr/search',{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`},body:JSON.stringify({section:section.id,records})});const data=await response.json();if(!response.ok)throw new Error(data.error||'Falló la búsqueda.');found.push(...data.files.map((f:Omit<Pdf,'section'>)=>({...f,section:section.id})));done.push(section.id);}
   catch(e){errors[section.id]=e instanceof Error?e.message:'No se pudo consultar.';}
   setFiles([...found]);setSearched([...done]);setSectionErrors({...errors});
  }setStatus('Búsqueda terminada. Revisa las coincidencias y selecciona los PDF que necesitas.');}
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
 if(loading||!user)return null;
 return <main className="mx-auto max-w-6xl space-y-6 px-4 py-8 text-white">
  <Link href="/" className="text-emerald-300">← Inicio</Link><h1 className="text-3xl font-semibold">Armar DHR desde carátula</h1>
  <p className="text-white/70">Sube el PDF de la portada. Revisa sus registros, busca en Box y descarga los documentos originales por sección.</p>
  <label className="block rounded-2xl border border-white/20 bg-white/5 p-5">Carátula del DHR (PDF con texto seleccionable, hasta 20 MB)
   <input aria-label="Subir carátula PDF" className="mt-3 block max-w-full" type="file" accept="application/pdf,.pdf" disabled={busy} onChange={e=>{const file=e.target.files?.[0];if(file)void upload(file);e.target.value='';}} />
  </label>
  {error&&<p role="alert" className="rounded-xl bg-red-950 p-4 text-red-200">{error}</p>}
  <p role="status" aria-live="polite" className="break-words text-emerald-200">{status}</p>
  {source&&<><p className="break-words">{source} · {rows.length} registros</p>
   {skipped.length>0&&<p className="text-sm text-white/60">No aplica: {skipped.map(id=>sections.find(s=>s.id===id)?.label).join(', ')}.</p>}
   <p className="text-sm text-white/70">Los títulos pueden ocupar varias líneas. Revisa los códigos, revisión, PO y fechas. Los registros físicos se conservan como pendientes manuales. La búsqueda no utiliza automáticamente la revisión más reciente.</p>
   {sections.filter(section=>rows.some(r=>r.section===section.id)).map(section=><section key={section.id} className="space-y-3 rounded-2xl border border-white/15 p-4 sm:p-6">
    <h2 className="text-xl font-semibold">{section.label}</h2>
    {!('folder' in section)&&<p className="text-amber-200">Incorporación manual: todavía no se ha definido una fuente digital para esta sección.</p>}
    {sectionErrors[section.id]&&<p role="alert" className="text-red-200">{sectionErrors[section.id]} No se confirmó esta sección.</p>}
    {rows.filter(r=>r.section===section.id).map(row=>{const candidates=files.filter(f=>f.records.includes(row.id));return <div key={row.id} className="space-y-2 border-t border-white/10 pt-3">
     <label className="block text-sm text-white/60">Registro {recordKey(row.section,row.text)}<textarea aria-label={`Registro ${row.id}`} rows={2} className={control} value={row.text} disabled={busy} onChange={e=>{setRows(rows.map(r=>r.id===row.id?{...r,text:e.target.value}:r));reset();}} /></label>
     <button className="text-sm text-red-200" disabled={busy} onClick={()=>{setRows(rows.filter(r=>r.id!==row.id));reset();}}>Quitar registro</button>
     {searched.includes(section.id)&&<p className={candidates.length?'text-emerald-200':'text-amber-200'}>{!candidates.length?'No encontrado':candidates.length>1?'Varias coincidencias: selecciona la correcta.':'1 coincidencia: confirma el documento.'}</p>}
     {candidates.map(file=><label key={file.id} className="flex items-start gap-3 rounded-lg bg-white/5 p-3"><input type="checkbox" className="mt-1 h-5 w-5 shrink-0" disabled={busy} checked={selected.includes(file.section+':'+file.id)} onChange={e=>setSelected(previous=>e.target.checked?[...new Set([...previous,file.section+':'+file.id])]:previous.filter(id=>id!==file.section+':'+file.id))}/><span className="min-w-0 break-words">{file.name}<span className="block text-xs text-white/60">{file.path}</span></span></label>)}
    </div>})}
    <button className="text-emerald-300 underline" disabled={busy} onClick={()=>{setRows([...rows,{id:crypto.randomUUID(),section:section.id,text:''}]);reset();}}>Agregar registro</button>
   </section>)}
   <label className="block space-y-2">Agregar un registro que no se haya detectado
    <select className={control} value="" disabled={busy} onChange={e=>{const section=e.target.value;if(!section)return;setRows([...rows,{id:crypto.randomUUID(),section,text:''}]);setSkipped(skipped.filter(id=>id!==section));reset();}}>
     <option value="">Selecciona la sección</option>{sections.map(section=><option key={section.id} value={section.id}>{section.label}</option>)}
    </select>
   </label>
   <div className="flex flex-wrap gap-3"><button className={button} disabled={busy||!rows.some(r=>r.text.trim())} onClick={search}>Buscar registros en Box</button>
    <button className={button} disabled={busy||!selected.length} onClick={download}>Descargar ZIP ({new Set(selected.map(id=>id.split(':')[1])).size} archivos)</button></div>
   <p className="text-sm text-white/60">El ZIP incluye la carátula, los documentos seleccionados y un resumen de trazabilidad. El historial de lote también puede descargarse en su Excel original. Hasta 50 MB por PDF y 150 MB por descarga. Los documentos no seleccionados o no encontrados quedan pendientes.</p>
  </>}
 </main>;
}
