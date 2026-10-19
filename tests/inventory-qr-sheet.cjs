const fs=require('fs'),ts=require('typescript'),assert=require('node:assert/strict'),{PDFDocument}=require('pdf-lib');
function load(path,imports={}){const m={exports:{}};new Function('require','module','exports',ts.transpileModule(fs.readFileSync(path,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,esModuleInterop:true}}).outputText)(n=>imports[n]||require(n),m,m.exports);return m.exports;}
const sites=load('lib/inventario/sites.ts'),{createMtsQrSheet}=load('lib/inventario/qr-sheet.ts',{'./sites':sites});
(async()=>{
const articles=Array.from({length:7},(_,i)=>({id:`component${i}`,code:`MTS-${String(i+1).padStart(3,'0')}`,name:i===2?'Rollo para esterilización de material y componentes de producción con descripción larga para verificar el espacio disponible en la etiqueta':i===3?'Material con símbolos Ω → y acentos áéíóú':`Material de prueba ${i+1}`}));
const bytes=await createMtsQrSheet(articles,'https://example.test','B2'),pdf=await PDFDocument.load(bytes);
assert.equal(pdf.getPageCount(),2);for(const page of pdf.getPages())assert.deepEqual(page.getSize(),{width:612,height:792});
assert.equal(pdf.getPages()[0].node.Resources().lookup(require('pdf-lib').PDFName.of('XObject')).keys().length,6);
assert.equal(pdf.getPages()[1].node.Resources().lookup(require('pdf-lib').PDFName.of('XObject')).keys().length,1);
if(process.env.QR_QA_OUTPUT)fs.writeFileSync(process.env.QR_QA_OUTPUT,bytes);
const calls=[], qr=require('qrcode');
const sortedModule=load('lib/inventario/qr-sheet.ts',{'./sites':sites,qrcode:{...qr,toDataURL:async(url,options)=>{calls.push(url);return qr.toDataURL(url,options);}}});
const unordered=[{id:'ten',code:'MTS-010',name:'Diez'},{id:'thousand',code:'MTS-1000',name:'Mil'},{id:'one',code:'MTS-001',name:'Uno'},{id:'hundred',code:'MTS-100',name:'Cien'},{id:'two',code:'MTS-002',name:'Dos'}];
await sortedModule.createMtsQrSheet(unordered,'https://example.test','B1');
assert.deepEqual(calls.map(url=>url.match(/components\/([^?]+)/)[1]),['one','two','ten','hundred','thousand']);
assert.equal(unordered[0].code,'MTS-010');
console.log('Numeric MTS order is ascending without mutating the source list.');
console.log('MTS QR sheets: Letter size, six QR images per page, overflow pagination and non-WinAnsi names passed.');
})().catch(e=>{console.error(e);process.exitCode=1;});
