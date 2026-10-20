import {NextRequest,NextResponse} from "next/server";
import {createHash} from "node:crypto";
import {adminDB} from "@/lib/firebaseAdmin";
import {identify,projectCatalog} from "@/lib/operacional/server";
import {getDmrProjects} from "@/lib/box/boxCatalog";
import {projectCodeFromDmr} from "@/lib/production/bom";
import {normalizedCode} from "@/lib/production/codes";
import {parseComponentCode} from "@/lib/operacional/catalog";
import {inventoryCollections,inventorySite} from "@/lib/inventario/sites";
import type {InventoryComponent} from "@/lib/inventario/types";
import type {MsopRow,MsopSource} from "@/lib/production/msop-pdf";
export const runtime="nodejs";
export const dynamic="force-dynamic";
const idFor=(projectId:string)=>createHash("sha256").update(projectId).digest("hex");
const str=(value:unknown,max=300)=>{if(typeof value!=="string"||value.length>max)throw new Error("Información de MSOP inválida.");return value.trim();};
function normalized(value:unknown){try{return normalizedCode(String(value));}catch{return "";}}
async function context(projectId:string){
 const project=(await getDmrProjects()).find(p=>p.id===projectId);
 if(!project)throw new Error("Proyecto DMR inválido.");
 const code=projectCodeFromDmr(project.title);
 const operational=(await projectCatalog()).find(p=>p.code===code);
 if(!operational)throw new Error("No se pudo identificar el proyecto del DMR.");
 return {project,code,operational};
}
export async function GET(req:NextRequest){
 if(!await identify(req))return NextResponse.json({error:"Inicia sesión."},{status:401});
 try{
  const projectId=str(req.nextUrl.searchParams.get("projectId")),site=inventorySite(req.nextUrl.searchParams.get("site"));
  const {code}=await context(projectId);
  const [saved,current,other]=await Promise.all([adminDB.collection("production_msops").doc(idFor(projectId)).get(),adminDB.collection(inventoryCollections(site).components).get(),adminDB.collection(inventoryCollections(site==="B1"?"B2":"B1").components).get()]);
  const existing=new Map<string,{id:string;code:string;name:string;unit:string;sites:string[];unitConflict:boolean}>();
  for(const [snap,siteName] of [[current,site],[other,site==="B1"?"B2":"B1"]] as const)for(const doc of snap.docs){
   const c=doc.data() as InventoryComponent,key=normalized(c.code);if(!key)continue;
   const prior=existing.get(key);
   if(prior){if(prior.unit!==c.unit)prior.unitConflict=true;if(prior.sites.includes(siteName))prior.unitConflict=true;else prior.sites.push(siteName);}
   else existing.set(key,{id:doc.id,code:key,name:c.name,unit:c.unit,sites:[siteName],unitConflict:false});
  }
  return NextResponse.json({projectCode:code,msop:saved.exists?saved.data():null,existing:[...existing.values()]});
 }catch(e){return NextResponse.json({error:e instanceof Error?e.message:"No se pudo cargar el MSOP."},{status:400});}
}
export async function POST(req:NextRequest){
 const user=await identify(req);if(!user)return NextResponse.json({error:"Inicia sesión."},{status:401});
 try{
  const b=await req.json(),projectId=str(b.projectId),site=inventorySite(b.site);
  const {code,operational}=await context(projectId);
  if(!Number.isInteger(b.version)||b.version<0)throw new Error("Versión inválida.");
  if(!b.source||!/\.pdf$/i.test(str(b.source.fileName))||!/^[a-f0-9]{64}$/.test(str(b.source.sha256))||!Number.isInteger(b.source.pageCount)||b.source.pageCount<1||b.source.pageCount>150)throw new Error("Carga un PDF MSOP válido antes de finalizar.");
  const documentProjectCode=str(b.source.documentProjectCode,3);
  if(documentProjectCode&&documentProjectCode!==code)throw new Error("El MSOP no corresponde al proyecto.");
  const source:MsopSource={fileName:str(b.source.fileName),sha256:b.source.sha256,pageCount:b.source.pageCount,documentProjectCode,warnings:Array.isArray(b.source.warnings)?b.source.warnings.slice(0,20).map((w:unknown)=>str(w,500)):[]};
  if(!Array.isArray(b.rows)||!b.rows.length||b.rows.length>600)throw new Error("Agrega entre 1 y 600 renglones.");
  const rows:MsopRow[]=b.rows.map((r:MsopRow,index:number)=>{
   const articleCode=normalizedCode(str(r.code,100));
   if(!articleCode.startsWith(code+".")&&!articleCode.startsWith("MTS-"))throw new Error(articleCode+": artículo de otro proyecto.");
   if(!["device","materials","production"].includes(r.section)||!Number.isInteger(r.page)||r.page<0||r.page>source.pageCount)throw new Error("Tabla o página inválida.");
   return {id:"msop-"+index,code:articleCode,name:str(r.name),unit:str(r.unit,40),section:r.section,page:r.page,supplier:str(r.supplier||""),spec:str(r.spec||"")};
  });
  const codes=[...new Set(rows.map(r=>r.code))];
  if(codes.length>200)throw new Error("Esta versión admite hasta 200 artículos únicos.");
  const ref=adminDB.collection("production_msops").doc(idFor(projectId));
  await adminDB.runTransaction(async t=>{
   const cols=[adminDB.collection(inventoryCollections(site).components),adminDB.collection(inventoryCollections(site==="B1"?"B2":"B1").components)];
   const [prior,current,other]=await Promise.all([t.get(ref),t.get(cols[0]),t.get(cols[1])]);
   if((prior.data()?.version||0)!==b.version)throw new Error("El MSOP cambió. Cierra y vuelve a abrir para recargarlo.");
   const snapshots=[current,other];
   const items=codes.map(articleCode=>{
    const sourceRows=rows.filter(r=>r.code===articleCode);
    const existing=snapshots.map(s=>s.docs.filter(d=>normalized(d.data().code)===articleCode));
    if(existing.some(matches=>matches.length>1))throw new Error(articleCode+": hay artículos duplicados en inventario. Corrígelos antes de finalizar.");
    const known=(existing[0][0]||existing[1][0])?.data() as InventoryComponent|undefined;
    if(existing[0][0]&&existing[1][0]&&existing[0][0].data().unit!==existing[1][0].data().unit)throw new Error(articleCode+": las unidades de B1 y B2 no coinciden.");
    const name=known?.name||sourceRows[0].name;
    const unit=known?.unit||sourceRows[0].unit;
    if(!name||!unit)throw new Error(articleCode+": completa nombre y unidad.");
    if(!known&&sourceRows.some(r=>r.unit!==unit))throw new Error(articleCode+": usa la misma unidad en todos los renglones.");
    for(const r of sourceRows){r.name=name;r.unit=unit;}
    for(let index=0;index<2;index++)if(!existing[index].length){
     const id=createHash("sha256").update(articleCode).digest("hex"),parsed=parseComponentCode(articleCode);
     t.create(cols[index].doc(id),{id,site:index===0?site:(site==="B1"?"B2":"B1"),code:articleCode,name,unit,type:parsed.type,project:parsed.type==="MTS"?"":operational.label,lots:[],createdAt:new Date().toISOString(),createdBy:user.uid});
    }
    return {code:articleCode,name,unit,children:[],sections:[...new Set(sourceRows.map(r=>r.section))]};
   });
   t.set(ref,{projectId,projectCode:code,source,rows,items,version:b.version+1,updatedAt:new Date().toISOString(),updatedBy:user.uid});
  });
  return NextResponse.json({ok:true});
 }catch(e){return NextResponse.json({error:e instanceof Error?e.message:"No se pudo finalizar el MSOP."},{status:400});}
}
