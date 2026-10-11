export const runtime = "nodejs";
export const dynamic = "force-dynamic";
import fs from "fs/promises";
import path from "path";
import PizZip from "pizzip";
import Docxtemplater from "docxtemplater";
import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminDB } from "@/lib/firebaseAdmin";
import { mapIncomingLot } from "@/app/inspecciones/entrada-lotes/utils";
import { extractIncomingPartInfo, incomingMethodLabel } from "@/app/inspecciones/entrada-lotes/qmsReportData";
import { validateInspectionFormData } from "@/app/inspecciones/entrada-lotes/inspectionFormData";
import type { IncomingInspectionContext, IncomingInspectionFormData, IncomingLotReport } from "@/app/inspecciones/entrada-lotes/types";
const clean=(x:unknown)=>String(x??"").trim();
function formatDate(date?:string){return date?date.split("-").reverse().join("/"):"";}
export async function POST(request:NextRequest){
 try {
  const auth=request.headers.get("authorization");if(!auth?.startsWith("Bearer "))return NextResponse.json({error:"No autorizado."},{status:401});
  await adminAuth.verifyIdToken(auth.slice(7));const body=await request.json();const scopeKey=clean(body.scopeKey),lotId=clean(body.lotId);
  if(!scopeKey||!lotId||scopeKey.includes("/")||lotId.includes("/"))return NextResponse.json({error:"Lote inválido."},{status:400});
  const scopeRef=adminDB.collection("inspection_incoming_lots").doc(scopeKey),lotRef=scopeRef.collection("lots").doc(lotId);
  const [scopeSnap,lotSnap,reportsSnap]=await Promise.all([scopeRef.get(),lotRef.get(),lotRef.collection("reports").get()]);
  if(!scopeSnap.exists||!lotSnap.exists)return NextResponse.json({error:"Lote no encontrado."},{status:404});
  const scope=scopeSnap.data()||{},lot=mapIncomingLot(lotId,lotSnap.data()||{});
  if(scope.sourceType==="proceso_proyecto"||lot.status!=="finalized")return NextResponse.json({error:"Este formato requiere un lote de entrada finalizado."},{status:409});
  const raw={...lot.inspectionFormData,...body.inspectionFormData} as IncomingInspectionFormData;
  const data:IncomingInspectionFormData={purchasedQuantity:clean(raw.purchasedQuantity),receivedDate:clean(raw.receivedDate),supplierName:clean(raw.supplierName),expirationDate:clean(raw.expirationDate),noExpiration:raw.noExpiration===true,documentation:Array.isArray(raw.documentation)?raw.documentation.filter(x=>["coa","coc","drawing","tests","other"].includes(x)):[],otherDocumentation:clean(raw.otherDocumentation),specReference:clean(raw.specReference),wiRevision:clean(raw.wiRevision),failedQuantities:Object.fromEntries(lot.methodPlans.map(p=>[p.method,clean(raw.failedQuantities?.[p.method])])),totalDefects:clean(raw.totalDefects),lotDisposition:raw.lotDisposition,lotComments:clean(raw.lotComments)};
  validateInspectionFormData(data,lot.methodPlans,true);
  if(lot.inspectionResult==="will_fail"&&data.lotDisposition!=="rejected")throw new Error("El lote que no pasó por SPEC debe registrarse como rechazado.");
  const reports=reportsSnap.docs.map(d=>({id:d.id,...d.data()})) as IncomingLotReport[];
  const values:Record<string,string>={...extractIncomingPartInfo(scope as IncomingInspectionContext),lotName:lot.lotName,purchaseOrder:lot.purchaseOrder,purchasedQuantity:data.purchasedQuantity!,receivedDate:formatDate(data.receivedDate),receivedQuantity:String(lot.totalLotQuantity),supplierName:data.supplierName!,expirationDate:data.noExpiration?"No aplica":formatDate(data.expirationDate),otherDocumentation:data.documentation?.includes("other")?data.otherDocumentation||"":"",specReference:data.specReference!,wiReference:`${clean(scope.wiCode)} Rev ${data.wiRevision}`,sampleSizeSummary:lot.methodPlans.map(p=>`${incomingMethodLabel(p.method)}: ${p.inspectedQuantity}`).join("\n"),allowedDefectsSummary:lot.methodPlans.map(p=>`${incomingMethodLabel(p.method)}: ${p.isFullInspection?"No aplica (100%)":p.allowedRejectedQuantity}`).join("\n"),totalDefects:data.totalDefects!,lotComments:data.lotComments||""};
  for(const method of ["documentary","visual","dimensional","functional"] as const){const plan=lot.methodPlans.find(p=>p.method===method);const failed=Number(data.failedQuantities?.[method]||0);values[method+"PassedQuantity"]=plan?String(plan.inspectedQuantity-failed):"NA";values[method+"FailedQuantity"]=plan?String(failed):"NA";values[method+"Comments"]=plan?reports.filter(r=>(r.inspectionMethod||"visual")===method).map(r=>`${r.kind==="anomaly"?"Anormalidad":"Rechazo por SPEC"}: ${r.title}${r.description?" — "+r.description:""}${r.kind==="anomaly"?r.decision==="fail"?" (no pasó)":" (pasó)":""}`).join("\n"):"No aplica";}
  const zip=new PizZip(await fs.readFile(path.join(process.cwd(),"public","templates","Incoming Inspection Form ES.docx")));
  const doc=new Docxtemplater(zip,{paragraphLoop:true,linebreaks:true});doc.render(values);
  const output=doc.getZip();
  // Apply checkbox selections by their containing table row, preserving approval fields.
  const current=output.file("word/document.xml")!.asText();
  output.file("word/document.xml",current.replace(/<w:tr(?:\s[^>]*)?>[\s\S]*?<\/w:tr>/g,row=>{
   const text=Array.from(row.matchAll(/<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/g)).map(m=>m[1]).join("");
   const documentation=text.includes("COA")||text.includes("REPORTE DE PRUEBAS"),disposition=/LOTE\s*:/.test(text);
   if(!documentation&&!disposition)return row;
   return row.replace(/<w:tc(?:\s[^>]*)?>[\s\S]*?<\/w:tc>/g,cell=>{
    const t=Array.from(cell.matchAll(/<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/g)).map(m=>m[1]).join("");
    const key=t.includes("COA")?"coa":t.includes("COC")?"coc":t.includes("DIBUJO/HOJA")?"drawing":t.includes("REPORTE DE PRUEBAS")?"tests":t.includes("OTRO")?"other":null;
    const selected=documentation?!!key&&!!data.documentation?.includes(key):t.includes("ACEPTADO")?data.lotDisposition==="accepted":t.includes("RECHAZADO")?data.lotDisposition==="rejected":t.includes("OTRO")?data.lotDisposition==="other":false;
    return cell.replace(/(<w14:checked\s+w14:val=")[01]("\s*\/>)/g,`$1${selected?"1":"0"}$2`).replace(/(<w:default\s+w:val=")[01]("\s*\/>)/g,`$1${selected?"1":"0"}$2`).replace(/[☐☒]/g,selected?"☒":"☐");
   });
  }));
  const printable=output.file("word/document.xml")!.asText().replace(/(<w:tr(?:\s[^>]*)?>)([\s\S]*?)(<\/w:tr>)/g,(_match,open,contents,close)=>{
    if(contents.includes("<w:cantSplit"))return open+contents+close;
    const body=contents.includes("<w:trPr>")?contents.replace("<w:trPr>","<w:trPr><w:cantSplit/>"):`<w:trPr><w:cantSplit/></w:trPr>${contents}`;
    return open+body+close;
  });
  output.file("word/document.xml",printable);
  const result=output.generate({type:"nodebuffer",compression:"DEFLATE"});
  await lotRef.update({inspectionFormData:data});
  const name=lot.lotName.replace(/[^a-zA-Z0-9._-]/g,"_");return new NextResponse(new Uint8Array(result),{headers:{"Content-Type":"application/vnd.openxmlformats-officedocument.wordprocessingml.document","Content-Disposition":`attachment; filename="Inspeccion_entrada_${name}.docx"`}});
 }catch(error){console.error("[inspection form]",error);return NextResponse.json({error:"No se pudo generar el formato de entrada.",detail:error instanceof Error?error.message:String(error)},{status:400});}
}
