const fs=require('fs'),ts=require('typescript'),assert=require('node:assert/strict'),XLSX=require('xlsx');
function load(path,imports={}){const m={exports:{}};new Function('require','module','exports',ts.transpileModule(fs.readFileSync(path,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,esModuleInterop:true}}).outputText)(n=>Object.hasOwn(imports,n)?imports[n]:require(n),m,m.exports);return m.exports;}
const {parseMtsMaster}=load('lib/production/mts-master.ts');
function book(sheets){const wb=XLSX.utils.book_new();for(const [name,rows] of Object.entries(sheets))XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet(rows),name);return XLSX.write(wb,{type:'buffer',bookType:'xlsx'});}
const buffer=book({Portada:[['Lista de materiales']],MTS:[['Materiales, Tools and Supplies'],[],['Código','Proyecto(s)','Tipo','Nombre'],['MTS-002','Labella','Herramienta','Broca'],[' mts-001 ','','Insumo',' Alcohol '],['MTS-002','','','Broca'],['SUP-001','','','Proveedor'],['','','','']]});
assert.deepEqual(parseMtsMaster(buffer),[{code:'MTS-001',name:'Alcohol'},{code:'MTS-002',name:'Broca'}]);
assert.throws(()=>parseMtsMaster(book({MTS:[['Código','Nombre'],['MTS-001','']]})),/Nombre/);
assert.throws(()=>parseMtsMaster(book({MTS:[['Código','Nombre'],['MTS-001','Uno'],['MTS-001','Dos']]})),/diferentes/);
assert.throws(()=>parseMtsMaster(book({MTS:[['Code','Name'],['MTS-001','Uno']]})),/columnas/);
assert.throws(()=>parseMtsMaster(book({MTS:[['Código','Nombre'],['SUP-001','Proveedor']]})),/válidos/);
const route=fs.readFileSync('app/api/production/catalog/route.ts','utf8');assert(!route.includes('getMtsWorkInstructions'));assert.equal((route.match(/await getMtsMasterCatalog\(\)/g)||[]).length,2);
assert(fs.readFileSync('lib/box/boxCatalog.ts','utf8').includes('getMtsWorkInstructions'));
(async()=>{
 const originalFetch=global.fetch,originalId=process.env.BOX_MTS_MASTER_FILE_ID;
 process.env.BOX_MTS_MASTER_FILE_ID='123456';
 const {getMtsMasterCatalog}=load('lib/box/mtsMaster.ts',{'server-only':{},'./boxAuth':{getBoxAccessToken:async()=> 'test-token'},'@/lib/production/mts-master':{parseMtsMaster}});
 let calls=0;global.fetch=async(url,options)=>{assert.equal(url,'https://api.box.com/2.0/files/123456/content');assert.equal(options.cache,'no-store');calls++;return new Response(buffer,{status:200});};
 try{assert.equal((await getMtsMasterCatalog()).length,2);await getMtsMasterCatalog();assert.equal(calls,2);global.fetch=async()=>new Response('',{status:403});await assert.rejects(getMtsMasterCatalog,/403/);global.fetch=async()=>new Response('',{status:202});await assert.rejects(getMtsMasterCatalog,/preparando/);delete process.env.BOX_MTS_MASTER_FILE_ID;await assert.rejects(getMtsMasterCatalog,/BOX_MTS_MASTER_FILE_ID/);}
 finally{global.fetch=originalFetch;if(originalId===undefined)delete process.env.BOX_MTS_MASTER_FILE_ID;else process.env.BOX_MTS_MASTER_FILE_ID=originalId;}
 console.log('MTS master: Excel columns, codes/names, deduplication, validation, uncached Box download, permissions and source separation passed.');
})().catch(e=>{console.error(e);process.exitCode=1;});
