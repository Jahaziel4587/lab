import { NextRequest,NextResponse } from "next/server";
import { authenticated } from "@/lib/dhr/auth";
import { boxJson,scope } from "@/lib/dhr/box";
import { getBoxAccessToken } from "@/lib/box/boxAuth";
export const runtime='nodejs';export const dynamic='force-dynamic';export const maxDuration=300;
export async function GET(request:NextRequest){
 if(!await authenticated(request))return NextResponse.json({error:'Inicia sesión.'},{status:401});
 const id=request.nextUrl.searchParams.get('id')||'',section=request.nextUrl.searchParams.get('section')||'';
 if(!/^\d+$/.test(id))return NextResponse.json({error:'Archivo inválido.'},{status:400});
 try{
  const root=scope(section).folder;
  const file=await boxJson(`/files/${id}?fields=id,name,type,path_collection,size,file_version,permissions`);
  if(file.type!=='file'||!(/\.pdf$/i.test(file.name)||(section==='history'&&/\.xlsx?$/i.test(file.name)))||!file.path_collection.entries.some((p:{id:string})=>p.id===root))return NextResponse.json({error:'Archivo fuera de las carpetas DHR autorizadas.'},{status:403});
  if(file.permissions?.can_download===false)throw new Error('Box permite ver el archivo pero bloquea la descarga. Revisa el permiso Write y el rol de la integración.');
  if(file.size>50*1024*1024)throw new Error('El PDF supera 50 MB. Descárgalo directamente desde Box.');
  if(!file.file_version?.id)throw new Error('Box no devolvió la versión del archivo.');
  const token=await getBoxAccessToken();
  for(let attempt=0;attempt<4;attempt++){
   const response=await fetch(`https://api.box.com/2.0/files/${id}/content?version=${encodeURIComponent(file.file_version.id)}`,{headers:{Authorization:`Bearer ${token}`},cache:'no-store',signal:AbortSignal.timeout(60000)});
   if([202,429,503].includes(response.status)){
    const wait=Number(response.headers.get('retry-after')||2);await response.body?.cancel();
    if(attempt===3||!Number.isFinite(wait)||wait>20)throw new Error('Box aún no tiene disponible la descarga. Intenta de nuevo.');
    await new Promise(resolve=>setTimeout(resolve,Math.max(1,wait)*1000));continue;
   }
   if(!response.ok||!response.body)throw new Error(`Box rechazó la descarga (HTTP ${response.status}). Revisa los permisos de descarga de la integración.`);
   return new Response(response.body,{headers:{'Content-Type':/\.pdf$/i.test(file.name)?'application/pdf':'application/octet-stream','Cache-Control':'private, no-store','X-Box-Version-Id':file.file_version.id}});
  }
 }catch(error){return NextResponse.json({error:error instanceof Error?error.message:'Falló la descarga.'},{status:502});}
 return NextResponse.json({error:'No se pudo descargar.'},{status:502});
}
