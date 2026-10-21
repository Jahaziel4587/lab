import "server-only";
import { getBoxAccessToken } from "@/lib/box/boxAuth";
import { listBoxFolderItems } from "@/lib/box/boxClient";
import { sections, matchesRecord } from "./parser.mjs";
export async function boxJson(path:string) {
 const token=await getBoxAccessToken();
 const response=await fetch(`https://api.box.com/2.0${path}`,{headers:{Authorization:`Bearer ${token}`},cache:'no-store',signal:AbortSignal.timeout(30000)});
 if(!response.ok)throw new Error(`Box HTTP ${response.status}: revisa los permisos del archivo o carpeta.`);
 return response.json();
}
export function scope(id:string) {
 const section=sections.find(s=>s.id===id&&'folder' in s);
 if(!section||!('folder' in section))throw new Error('Sección no disponible para búsqueda en Box.');
 return section as {id:string;label:string;folder:string};
}
export async function searchSection(id:string,records:Array<{id:string;text:string}>) {
 const section=scope(id),queue=[{id:section.folder,path:section.label}],files:Array<{id:string;name:string;path:string;records:string[]}>=[];
 const visited=new Set<string>(),started=Date.now();
 while(queue.length) {
  if(Date.now()-started>210000||visited.size>1500)throw new Error('No se pudo completar el recorrido. Reduce la búsqueda o vuelve a intentar; no se entregan resultados parciales.');
  const folder=queue.shift()!;if(visited.has(folder.id))continue;visited.add(folder.id);
  let offset=0;
  while(true){
   const page=await listBoxFolderItems(folder.id,offset);
   for(const item of page.entries){
    if(item.type==='folder')queue.push({id:item.id,path:folder.path+'/'+item.name});
    if(item.type==='file'&&(/\.pdf$/i.test(item.name)||(id==='history'&&/\.xlsx?$/i.test(item.name)))){
     const matched=records.filter(r=>matchesRecord(id,r.text,item.name,folder.path)).map(r=>r.id);
     if(matched.length)files.push({id:item.id,name:item.name,path:folder.path,records:matched});
    }
   }
   offset+=page.entries.length;if(offset>=page.total_count)break;
   if(!page.entries.length)throw new Error('Box devolvió un listado incompleto.');
  }
 }
 return files;
}
