export const sections = [
 {id:'production',label:'Orden de producción',manual:true},
 {id:'incoming',label:'Inspecciones de entrada',folder:'201276168943'},
 {id:'process',label:'Inspecciones en proceso',manual:true},
 {id:'sterilization',label:'Inspección de esterilización',manual:true},
 {id:'materials',label:'Certificados de material',folder:'201279680263'},
 {id:'calibration',label:'Certificados de calibración',folder:'380850607173'},
 {id:'tests',label:'Reportes de pruebas',manual:true},
 {id:'final',label:'Inspecciones finales del dispositivo',manual:true},
 {id:'labels',label:'Control de etiqueta',folder:'380850671648'},
 {id:'history',label:'Registro de historial de lote',folder:'218653744455'},
 {id:'training',label:'Capacitaciones',folder:'204430279767'},
 {id:'memos',label:'Memos',folder:'201276713016'},
 {id:'deviations',label:'Desviaciones',folder:'319352001560'},
];
export const normalize = value => value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase().replace(/[^A-Z0-9]/g,'');
const aliases={history:['Registro del historial de lote'],memos:['MEMO']};
function heading(line) {
 return sections.find(s=>[s.label,...(aliases[s.id]||[])].some(label=>normalize(line).startsWith(normalize(label))));
}
function startsRecord(section,line) {
 const patterns={production:/^PDO\./i,incoming:/^IIF\./i,process:/^QCI\./i,materials:/^EXT\./i,calibration:/^(?:IVR\.)?B[12]-\d/i,labels:/^LBL\./i,history:/^LHR\./i,training:/^ATF\./i,memos:/^(?:MEMO|MEM)\b[.\s-]/i,deviations:/^DV\./i};
 return patterns[section]?.test(line.trim())||false;
}
export function parseDhrLines(lines) {
 let section=null, current=null;
 const records=[], skipped=new Set();
 for(const raw of lines) {
  const line=raw.replace(/\s+/g,' ').trim(); if(!line)continue;
  const found=heading(line);
  if(found){section=found.id;current=null;const tail=normalize(line).slice(normalize(found.label).length);if(/^(?:NA|NOAPLICA)$/.test(tail))skipped.add(section);continue;}
  if(/^(Observaciones|Aprobaci[oó]n de QC)/i.test(line)){section=null;current=null;continue;}
  if(!section)continue;
  if(/^(NA|N\/A|NO APLICA)$/i.test(line)){skipped.add(section);current=null;continue;}
  if(/^(SI|SÍ)$/.test(line.toUpperCase())||/Contenidos del DHR|Nombre de los registros|¿Aplica|DOCUMENTOS/i.test(line))continue;
  if(startsRecord(section,line)) {
   current={id:`${section}-${records.length+1}`,section,text:line};records.push(current);
  } else if(current) {
   // Incoming component, PO and QCI are context, not additional IIF files.
   if(section==='incoming') { if(/^(PO[-\s]|QCI\.)/i.test(line))current.text+=' '+line; }
   else current.text+=' '+line;
  }
 }
 return {records:records.filter(r=>!skipped.has(r.section)),skipped:[...skipped]};
}
export function pdfLines(pages) {
 const output=[];
 let previousColumn=null;
 for(const items of pages){
  const rows=[];
  for(const item of items){if(!item.str?.trim())continue;const y=item.transform[5];let row=rows.find(r=>Math.abs(r.y-y)<3);if(!row){row={y,items:[]};rows.push(row);}row.items.push(item);}
  rows.sort((a,b)=>b.y-a.y);
  const header=items.find(i=>/Nombre de los registros/i.test(i.str));
  const codes=items.filter(i=>/^(?:PDO\.|IIF\.|EXT\.|LBL\.|LHR\.|ATF\.|DV\.|(?:IVR\.)?B[12]-)/i.test(i.str.trim()));
  const positions=[...(header?[header.transform[4]]:[]),...codes.map(i=>i.transform[4]),...(previousColumn!=null?[previousColumn]:[])];
  const column=positions.length?Math.min(...positions):null;
  if(column==null){output.push(...rows.map(r=>r.items.sort((a,b)=>a.transform[4]-b.transform[4]).map(i=>i.str).join(' ')));continue;}
  previousColumn=column;
  const join=values=>values.sort((a,b)=>a.transform[4]-b.transform[4]).map(i=>i.str).join(' ').trim();
  const split=rows.map(r=>({left:join(r.items.filter(i=>i.transform[4]<column-65)),middle:join(r.items.filter(i=>i.transform[4]>=column-65&&i.transform[4]<column-5)),right:join(r.items.filter(i=>i.transform[4]>=column-5))}));
  const consumed=new Set();
  for(let index=0;index<split.length;index++){
   const row=split[index];
   if(row.left&&!consumed.has(index)){
    let text=row.left,found=heading(text),end=index;
    for(let next=index+1;!found&&next<Math.min(index+4,split.length);next++){
     text+=' '+split[next].left;found=heading(text);end=next;
    }
    if(found){output.push(found.label);for(let n=index;n<=end;n++)consumed.add(n);}
    else if(/^(Observaciones|Aprobaci[oó]n de QC)/i.test(row.left))output.push(row.left);
   }
   if(/^(?:SI|SÍ|NA|N\/A)$/i.test(row.middle))output.push(row.middle);
   if(row.right)output.push(row.right);
  }
 }
 return output;
}
export function recordKey(section,text) {
 const patterns={incoming:/IIF\.[A-Z0-9.-]+/i,materials:/EXT\.[A-Z0-9./&-]+/i,calibration:/(?:IVR\.)?B[12]-\d+(?:-\d+)?/i,labels:/LBL\.[\d.]+/i,history:/LHR\.[A-Z0-9.-]+/i,training:/ATF\.\s*\d+/i,memos:/(?:MEMO|MEM)[.\s-]+[A-Z0-9.-]+/i,deviations:/DV\.[A-Z0-9.-]+/i};
 return text.match(patterns[section])?.[0]?.replace(/[.]+$/,'')||'';
}
export function matchesRecord(section,text,name,path='') {
 const key=recordKey(section,text);if(!key)return false;
 const norm=normalize(name);const needle=normalize(key);
 const index=norm.indexOf(needle);if(index<0||/\d/.test(norm[index+needle.length]||'x'))return false;
 const revision=section==='incoming'?undefined:text.match(/Rev\s*(\d+)/i)?.[1];
 if(revision && !new RegExp(`REV0*${revision}(?!\\d)`).test(norm))return false;
 if(section==='materials') { const po=text.match(/PO[-\s]*(\d+)/i)?.[1];if(po&&!new RegExp(`PO0*${po}(?!\\d)`).test(normalize(path+' '+name)))return false; }
 if(section==='calibration') { const dates=text.match(/\b\d{6}\b/g)||[];if(dates.some(date=>!norm.includes(date)))return false; }
 return true;
}
