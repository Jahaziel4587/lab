const fs=require('fs'),ts=require('typescript'),assert=require('node:assert/strict');function load(p,imports={}){const m={exports:{}};new Function('require','module','exports',ts.transpileModule(fs.readFileSync(p,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,esModuleInterop:true}}).outputText)(n=>imports[n]||require(n),m,m.exports);return m.exports;}
const {renderVoucher}=load('lib/inventario/voucher-docx.ts',{'./catalogs':load('lib/inventario/catalogs.ts')});const template=fs.readFileSync('public/templates/vale-material.docx');const v={id:'voucher123456789',site:'B2',kind:'salida',createdAt:'2026-10-10T20:00:00Z',project:'004.Solvein',origin:'aprobado',destination:'externo:produccion',requestedBy:'Inspector',receivedBy:'Producción',actor:'Jahaziel Garza',notes:'Prueba de generación',lines:[{code:'004.308',name:'Connector',unit:'pz',quantity:100,lot:'LOT-01',expiry:'2028-01-01',comments:'Material aprobado'},{code:'004.305',name:'Main Shaft',unit:'pz',quantity:75,lot:'LOT-02',expiry:'',comments:''}]};const result=renderVoucher(template,v);const Zip=require('pizzip');const xml=new Zip(result).file('word/document.xml').asText();assert.equal((xml.match(/<w:checked w:val="1"/g)||[]).length,3);assert(!xml.includes('{articulo}'));assert(xml.indexOf('004.308')<xml.indexOf('004.305'));
for(const kind of ['entrada','traslado']){const x=new Zip(renderVoucher(template,{...v,kind,origin:'externo:recepcion',destination:'pendiente'})).file('word/document.xml').asText();assert.equal((x.match(/<w:checked w:val="1"/g)||[]).length,3);}
console.log('Voucher generation: native checkbox states, row repetition and order passed.');

const unknown=new Zip(renderVoucher(template,{...v,origin:'ssc'})).file('word/document.xml').asText();
assert(unknown.includes('Materiales con SSC'));
assert.equal((unknown.match(/<w:checked w:val="1"/g)||[]).length,3);
const many={...v,lines:Array.from({length:30},(_,i)=>({...v.lines[0],code:`004.${String(300+i).padStart(3,'0')}`,name:`Artículo ${i+1}`}))};
const multi=renderVoucher(template,many),archive=new Zip(multi);
assert(archive.file('word/document.xml').asText().includes('<w:tblHeader/>'));
assert(/numpages/i.test(archive.file('word/header2.xml').asText()));
if(process.env.VOUCHER_QA_OUTPUT)fs.writeFileSync(process.env.VOUCHER_QA_OUTPUT,multi);
