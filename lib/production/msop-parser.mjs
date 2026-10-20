// PDF text coordinates are supplied by PDF.js; this module is also testable without a browser.
export const MSOP_SECTIONS = [
  {id:"device",label:"Device Name"},
  {id:"materials",label:"List of Materials/Components"},
  {id:"production",label:"List of Production Materials/Tools"}
];
const clean = s => String(s || "").replace(/\s+/g," ").trim();
const fold = s => clean(s).toLowerCase().replace(/[^a-z0-9]/g,"");
function heading(text) {
  const n=fold(text);
  if(n.includes("listofproductionmaterialstools") || /listofproductionmaterials(?:and)?tools/.test(n)) return "production";
  if(n.includes("listofmaterialscomponents") || /listofmaterials(?:and)?components/.test(n)) return "materials";
  if(n.includes("devicename")) return "device";
  return "";
}
export function codeCandidates(text) {
  return [...String(text).matchAll(/(^|[^A-Za-z0-9.])((?:MTS\s*[-–]\s*\d{3,})|(?:\d{3}\s*[.-]\s*[1-4]\d{2}[A-Za-z]*(?:[.-][A-Za-z0-9]+)*))(?=$|[^A-Za-z0-9])/g)].map(m=>m[2].replace(/\s/g,"").replace(/–/g,"-").replace(/\.+$/,"").toUpperCase());
}
function unresolvedRow(line,columns) {
  const codeColumn=columns.find(c=>/part\s*(number|no)|item\s*(number|code)|material\s*code|component\s*code/i.test(c.text)&&!/client/i.test(c.text));
  const nameColumn=columns.find(c=>/description|(?:device|component|material)\s*name|^name$/i.test(c.text));
  if(!codeColumn||!nameColumn)return null;
  const codeCell=line.cells.find(c=>Math.abs(c.x-codeColumn.x)<20);
  const next=columns.filter(c=>c.x>nameColumn.x+8).sort((a,b)=>a.x-b.x)[0];
  const names=line.cells.filter(c=>c.x>=nameColumn.x-8&&(!next||c.x<next.x-5));
  const name=clean(names.map(c=>c.text).join(" "));
  if(!name||!codeCell||/^\d+$/.test(codeCell.text))return null;
  return {code:/^(?:n\/a|na|tbd|[-–])$/i.test(codeCell.text)?"":codeCell.text,name};
}
function linesOf(items) {
  const sorted=items.filter(i=>clean(i.str)).map(i=>({text:clean(i.str),x:Number(i.transform?.[4]||0),y:Number(i.transform?.[5]||0),width:Number(i.width||0)})).sort((a,b)=>b.y-a.y||a.x-b.x);
  const lines=[];
  for(const item of sorted) { const previous=lines[lines.length-1]; if(previous&&Math.abs(previous.y-item.y)<=2.5) previous.cells.push(item); else lines.push({y:item.y,cells:[item]}); }
  return lines.map(l=>({...l,cells:l.cells.sort((a,b)=>a.x-b.x),text:l.cells.sort((a,b)=>a.x-b.x).map(c=>c.text).join(" ")}));
}
export function parseMsopPages(pages, fileName="") {
  const rows=[], warnings=[], found=new Set();let section="",last=null,columns=[];
  let documentProjectCode=String(fileName).match(/(?:^|[^0-9])(\d{3})[.\s_-]*MSOP/i)?.[1]||"";
  for(let p=0;p<pages.length;p++) {
    const lines=linesOf(pages[p]);last=null;let previous="";
    const pageCode=lines.map(l=>l.text).join(" ").match(/\b(\d{3})[.\s_-]*MSOP/i)?.[1];
    if(pageCode) { if(documentProjectCode&&documentProjectCode!==pageCode) warnings.push("El nombre y el contenido del documento indican proyectos distintos."); documentProjectCode=pageCode; }
    for(const line of lines) {
      const text=clean(line.text),norm=fold(text),codes=codeCandidates(text);
      const title=heading(text)||heading(previous+" "+text);
      previous=text;
      if(title) { section=title;found.add(title);last=null;columns=[]; }
      if(!section)continue;
      if(/^(?:\d+(?:\.\d+)*[.)]?\s*)?(?:list of (?!materials|production materials)|references?\b|manufacturing (?:process|procedure)|process flow\b|standard operating\b|revision history\b|quality control\b|procedure\b|appendix\b)/i.test(text)&&!title){section="";last=null;continue;}
      if(/^(?:page|página)\s*\d|^\d+\s*(?:of|de)\s*\d+$|^\d{2}\/[a-z]{3}\/\d{2}/i.test(text)||/\bMSOP\b.*\bRev(?:ision)?\b/i.test(text))continue;
      const isHeader= !codes.length && (/(?:part\s*(?:number|no\.?)|item\s*(?:number|code)|material\s*code|component\s*code)/i.test(text) || (/(?:description|name)/i.test(text)&&/(?:supplier|spec|code|number)/i.test(text)));
      if(isHeader) { columns=line.cells.map(c=>({x:c.x,text:c.text}));last=null;continue; }
      if(title && !codes.length)continue;
      if(codes.length) {
        const codeColumn=columns.find(c=>/part\s*(number|no)|item\s*(number|code)|material\s*code|component\s*code/i.test(c.text));
        const nameColumn=columns.find(c=>/description|(?:device|component|material)\s*name|^name$/i.test(c.text));
        const metadata=columns.filter(c=>/supplier|spec|drawing|quantity|unit|qty/i.test(c.text));
        for(const code of [...new Set(codes)]) {
          const codeCell=line.cells.find(c=>codeCandidates(c.text).includes(code));

          let cells=line.cells.filter(c=>!codeCandidates(c.text).length);
          if(nameColumn) { const next=columns.filter(c=>c.x>nameColumn.x+8).sort((a,b)=>a.x-b.x)[0]; cells=cells.filter(c=>c.x>=nameColumn.x-8&&(!next||c.x<next.x-5)); }
          else { const stop=metadata.length?Math.min(...metadata.map(c=>c.x)):Infinity;cells=cells.filter(c=>c.x<stop-3&&!/^\d+(?:\.\d+)?$|^(?:variable|n\/a|na|pcs|pz|ml|kg|roll)$/i.test(c.text)); }
          let name=clean(cells.map(c=>c.text).join(" "));
          if(!name) name=clean(text.replace(/MTS\s*[-–]\s*\d{3,}|\d{3}\s*[.-]\s*[1-4]\d{2}[A-Za-z]*(?:[.-][A-Za-z0-9]+)*/g,"").replace(/^\s*\d+[.)]?\s*/,""));
          name=name.replace(/^device name\s*:?\s*/i,"").trim();
          const row={id:"msop-"+rows.length,code,name,unit:"",section,page:p+1,supplier:"",spec:""};
          for(const key of ["supplier","spec"]){const col=columns.find(c=>key==="supplier"?/supplier/i.test(c.text):/spec|drawing/i.test(c.text));if(col){const next=columns.filter(c=>c.x>col.x+8).sort((a,b)=>a.x-b.x)[0];row[key]=clean(line.cells.filter(c=>c.x>=col.x-8&&(!next||c.x<next.x-5)).map(c=>c.text).join(" "));}}
          rows.push(row);last={row,y:line.y,nameX:nameColumn?.x??cells[0]?.x??0};
        }
      } else if(unresolvedRow(line,columns)) {
        const candidate=unresolvedRow(line,columns);
        rows.push({id:"msop-"+rows.length,code:candidate.code,name:candidate.name,unit:"",section,page:p+1,supplier:"",spec:""});last=null;
      } else if(last && Math.abs(last.y-line.y)<23 && line.cells.every(c=>c.x>=last.nameX-8) && !/^(?:part|item|material|description|supplier|spec|revision|rev\.?|approved|prepared|reviewed|document)\b/i.test(text) && !title) {
        last.row.name=clean(last.row.name+" "+text);last.y=line.y;
      } else if(columns.length&&!title&&/\b(?:n\/a|NA|TBD)\b/.test(text)&&line.cells.length>=2) {
        rows.push({id:"msop-"+rows.length,code:"",name:clean(line.cells.filter(c=>!/^(?:n\/a|na|tbd|\d+)$/i.test(c.text)).map(c=>c.text).join(" ")),unit:"",section,page:p+1,supplier:"",spec:""});
        last=null;
      }
    }
  }
  for(const s of MSOP_SECTIONS) if(!found.has(s.id))warnings.push("No se detectó la tabla "+s.label+". Revisa el PDF y agrega los renglones faltantes.");
  if(!rows.length)warnings.push("No se extrajeron artículos. El PDF puede ser escaneado o tener una estructura distinta; no se puede finalizar sin capturar artículos.");
  if(rows.some(r=>!r.name||!r.code))warnings.push("Hay renglones sin código o nombre que requieren revisión.");
  return {rows,warnings:[...new Set(warnings)],documentProjectCode,sections:[...found]};
}
