import { parseMsopPages } from "./msop-parser.mjs";
export type MsopSection = "device" | "materials" | "production";
export type MsopRow = { id:string; code:string; name:string; unit:string; section:MsopSection; page:number; supplier:string; spec:string };
export type MsopSource = { fileName:string; sha256:string; pageCount:number; documentProjectCode:string; warnings:string[] };
type PdfItem = { str:string; transform:number[]; width:number };
type PdfDocument = { numPages:number; getPage:(n:number)=>Promise<{getTextContent:()=>Promise<{items:unknown[]}>}>; destroy:()=>Promise<void> };
type PdfLibrary = {GlobalWorkerOptions:{workerSrc:string};getDocument:(o:{data:Uint8Array;isEvalSupported:boolean})=>{promise:Promise<PdfDocument>;destroy:()=>Promise<void>}};
let library:Promise<PdfLibrary>|null=null;
async function pdfLibrary() {
  if(!library) {
    const url="https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/build/pdf.mjs";
    library=import(/* webpackIgnore: true */ url).then((module:PdfLibrary)=>{
      module.GlobalWorkerOptions.workerSrc="https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/build/pdf.worker.mjs";return module;
    }).catch(e=>{library=null;throw e;});
  }
  return library;
}
export async function readMsopPdf(file:File,progress:(n:number,total:number)=>void):Promise<{rows:MsopRow[];source:MsopSource}> {
  if(!/\.pdf$/i.test(file.name)||file.size>20*1024*1024||!file.size)throw new Error("Selecciona un PDF de hasta 20 MB.");
  const bytes=new Uint8Array(await file.arrayBuffer());
  if(new TextDecoder().decode(bytes.slice(0,5))!=="%PDF-")throw new Error("El archivo no es un PDF válido.");
  const hash=Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256",bytes))).map(b=>b.toString(16).padStart(2,"0")).join("");
  let pdfjs:PdfLibrary;
  try{pdfjs=await pdfLibrary();}catch{throw new Error("No se pudo cargar el lector PDF. Revisa la conexión e intenta nuevamente.");}
  const task=pdfjs.getDocument({data:bytes,isEvalSupported:false});
  try {
    const doc=await task.promise;
    if(doc.numPages>150)throw new Error("Esta carga admite MSOP de hasta 150 páginas.");
    const pages:PdfItem[][]=[];
    for(let n=1;n<=doc.numPages;n++){const page=await doc.getPage(n);const content=await page.getTextContent();pages.push(content.items.filter((i):i is PdfItem=>!!i&&typeof i==="object"&&"str" in i) as PdfItem[]);progress(n,doc.numPages);}
    const result=parseMsopPages(pages,file.name);
    return {rows:result.rows as MsopRow[],source:{fileName:file.name,sha256:hash,pageCount:doc.numPages,documentProjectCode:result.documentProjectCode,warnings:result.warnings}};
  } finally {await task.destroy();}
}
