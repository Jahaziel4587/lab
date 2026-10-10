import PizZip from "pizzip";
import Docxtemplater from "docxtemplater";
import type { Voucher } from "./types";
import { locationName } from "./catalogs";
const labels: Record<string,string> = {pendiente:"pendiente de inspeccion",aprobado:"material aprobado",rechazado:"material rechazado",cuarentena:"cuarentena",terminado:"dispositivos terminados","no-conforme":"producto no conforme",retencion:"retencion",semiterminado:"producto semiterminado",limpieza:"limpieza","externo:produccion":"actividades de operacion/produccion","externo:envio":"envio (salida de planta)"};
function normalize(s:string){return s.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/\s+/g," ").trim();}
function text(xml:string){return normalize([...xml.matchAll(/<w:t\b[^>]*>([\s\S]*?)<\/w:t>/g)].map(m=>m[1]).join(""));}
function checks(cell:string,values:boolean[]){let index=0;return cell.replace(/<w:checkBox\b[^>]*>[\s\S]*?<\/w:checkBox>/g,block=>{const value=values[index++]?1:0;return block.replace(/<w:(?:checked|default)\b[^>]*\/?>/g,"").replace('</w:checkBox>',`<w:default w:val="${value}"/><w:checked w:val="${value}"/></w:checkBox>`);});}
export function renderVoucher(template:Buffer,v:Voucher){
 const zip=new PizZip(template);const file=zip.file("word/document.xml");if(!file)throw new Error("Formato de vale inválido.");
 let xml=file.asText().replace(/<w:tblpPr\b[^>]*\/>/g, "");let count=0;
 xml=xml.replace(/<w:tblPr>/g,'<w:tblPr><w:tblInd w:w="-856" w:type="dxa"/>').replace(/<\/w:tbl>\s*<w:tbl>/g,'</w:tbl><w:p><w:pPr><w:spacing w:after="100" w:line="100" w:lineRule="exact"/></w:pPr></w:p><w:tbl>');
 // Repeat the article headings on continuation pages and keep each article together.
 let tableIndex=0;
 xml=xml.replace(/<w:tbl\b[^>]*>[\s\S]*?<\/w:tbl>/g,table=>{
   if(tableIndex++!==1)return table;
   let rowIndex=0;
   return table.replace(/<w:tr\b[^>]*>[\s\S]*?<\/w:tr>/g,row=>{
     const properties=`<w:cantSplit/>${rowIndex++===0?'<w:tblHeader/>':''}`;
     if(row.includes('<w:trPr>'))return row.replace('<w:trPr>',`<w:trPr>${properties}`);
     if(row.includes('<w:trPr/>'))return row.replace('<w:trPr/>',`<w:trPr>${properties}</w:trPr>`);
     return row.replace(/(<w:tr\b[^>]*>)/,`$1<w:trPr>${properties}</w:trPr>`);
   });
 });
 xml=xml.replace(/<w:tr\b[^>]*>[\s\S]*?<\/w:tr>/g,row=>{let col=0;return row.replace(/<w:tc\b[^>]*>[\s\S]*?<\/w:tc>/g,cell=>{const current=col; col+=Number(cell.match(/<w:gridSpan\b[^>]*w:val="(\d+)"/)?.[1]||1);if(!cell.includes('<w:checkBox'))return cell;const n=(cell.match(/<w:checkBox\b/g)||[]).length;count+=n;const label=text(cell);if(label.includes('entrada')&&label.includes('salida'))return checks(cell,[v.kind!=="salida",v.kind==="salida"]);if(current!==2&&current!==3)throw new Error("Casilla inesperada en el formato oficial.");const location=current===2?v.origin:v.destination;const expected=labels[location]||"otro:";return checks(cell,[label.startsWith(expected)]);});});
 if(count!==28)throw new Error("El formato debe contener las 28 casillas oficiales de Entrada/Salida, Origen y Destino.");
 zip.file("word/document.xml",xml);
 const other=(location:string)=>labels[location]?"":[locationName(location),v.notes].filter(Boolean).join(" · ");
 const doc=new Docxtemplater(zip,{paragraphLoop:true,linebreaks:true,nullGetter:()=>"",});
 doc.render({fecha:new Date(v.createdAt).toLocaleDateString("es-MX",{timeZone:"America/Mexico_City"}),proyecto:v.project||[...new Set(v.lines.map(l=>l.project).filter(Boolean))].join(", ")||"N/A",almacen:v.site||"B1",folio:v.id,solicitante:v.requestedBy,recibe:v.receivedBy,surte:v.actor,or_otro_texto:other(v.origin),de_otro_texto:other(v.destination),articulos:v.lines.map(l=>({articulo:`${l.code}\n${l.name}`,unidad:l.unit,cantidad:l.quantity,lote:l.lot,caducidad:l.expiry||"N/A",comentarios:[l.comments,v.notes].filter(Boolean).join("\n")||"N/A"}))});
 return doc.getZip().generate({type:"nodebuffer",compression:"DEFLATE"});
}
