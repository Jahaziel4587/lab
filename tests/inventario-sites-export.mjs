import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
import { createRequire } from 'node:module';
const require=createRequire(import.meta.url);
function load(path, imports={}) {
  const code=ts.transpileModule(fs.readFileSync(path,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,esModuleInterop:true,resolveJsonModule:true}}).outputText;
  const m={exports:{}};new Function('require','module','exports',code)(name=>imports[name]||require(name),m,m.exports);return m.exports;
}
const sites=load('lib/inventario/sites.ts'),catalog=load('lib/operacional/catalog.ts'),warehouses=load('lib/inventario/catalogs.ts');
assert.equal(sites.inventorySite(null),'B1');assert.equal(sites.inventorySite('B2'),'B2');assert.throws(()=>sites.inventorySite('B3'));
assert.notEqual(sites.inventoryCollections('B1').components,sites.inventoryCollections('B2').components);
assert.equal(sites.inventoryHref('/inventario/components/test','B2'),'/inventario/components/test?site=B2');
const memory=new Map();let serial=0,reads=[];
const copy=v=>v===undefined?undefined:structuredClone(v);
const snap=ref=>({id:ref.id,exists:memory.has(ref.path),data:()=>copy(memory.get(ref.path))});
function collection(name){const all=()=>({docs:[...memory.keys()].filter(k=>k.startsWith(`${name}/`)).map(path=>snap({id:path.split('/')[1],path}))});return{get:async()=>{reads.push(name);return all();},orderBy:()=>({limit:()=>({get:async()=>{reads.push(name);return all();}})}),doc:(id=`voucher${String(++serial).padStart(12,'0')}`)=>({id,path:`${name}/${id}`,get:async function(){reads.push(this.path);return snap(this);}})};}
const db={collection,runTransaction:async fn=>{const writes=[];const result=await fn({get:async r=>snap(r),getAll:async(...refs)=>refs.map(snap),create:(r,v)=>{assert.equal(memory.has(r.path),false);writes.push([r.path,copy(v)]);},set:(r,v)=>writes.push([r.path,copy(v)])});writes.forEach(([k,v])=>memory.set(k,v));return result;}};
const NextResponse={json:(body,options)=>({body,status:options?.status||200})};
const route=load('app/api/inventario/route.ts',{'next/server':{NextResponse},'@/lib/firebaseAdmin':{adminDB:db,adminAuth:{verifyIdToken:async token=>{if(token!=='valid')throw Error();return{uid:'tester',email:'tester@example.com'};}}},'@/lib/inventario/sites':sites,'@/lib/operacional/catalog':catalog,'@/lib/operacional/server':{projectCatalog:async()=>catalog.DEFAULT_PROJECTS},'@/lib/inventario/catalogs':warehouses,'@/lib/inventario/selection':load('lib/inventario/selection.ts')});
const req=(site,body,token='valid')=>({nextUrl:new URL(`https://example.test/api/inventario?site=${site}`),headers:{get:()=>token?`Bearer ${token}`:''},json:async()=>body});
const post=(site,body)=>route.POST(req(site,{...body,site}));
const component={action:'component',code:'004.308',name:'Connector',unit:'pz'};
assert.equal((await route.GET(req('B1',null,''))).status,401);
const b1=await post('B1',component),b2=await post('B2',component);assert.equal(b1.status,200);assert.equal(b2.status,200);assert.equal(b1.body.id,b2.body.id);
assert.equal((await post('B2',component)).status,400);
assert.equal((await route.POST(req('B1',{...component,code:'004.309',site:'B2'}))).status,400,'Body and URL site must match');
for(const [site,quantity]of [['B1',200],['B2',30]])assert.equal((await post(site,{action:'lot',componentId:b1.body.id,name:'LOT-1',quantity,expiry:'2099-01-01',origin:'externo:recepcion',destination:'aprobado',operationId:'same-lot-key-123456789'})).status,200);
const doc=site=>memory.get(`${sites.inventoryCollections(site).components}/${b1.body.id}`);
const move={action:'movement',kind:'salida',operationId:'same-movement-key-123456789',lines:[{componentId:b1.body.id,quantity:100,origin:'aprobado',destination:'externo:produccion'}]};
assert.equal((await post('B2',move)).status,400);assert.equal(doc('B1').lots[0].stock.aprobado,200);assert.equal(doc('B2').lots[0].stock.aprobado,30);
assert.equal((await post('B1',move)).status,200);assert.equal(doc('B1').lots[0].stock.aprobado,100);assert.equal(doc('B2').lots[0].stock.aprobado,30);
for(const site of ['B1','B2']){reads=[];const result=await route.GET(req(site));assert.equal(result.status,200);assert.equal(result.body.components.length,1);assert.equal(result.body.components[0].site,site);assert(result.body.vouchers.every(v=>v.site===site));assert(reads.every(name=>Object.values(sites.inventoryCollections(site)).includes(name)));}
const excel=load('lib/inventario/excel.ts',{'./export-template.json':JSON.parse(fs.readFileSync('lib/inventario/export-template.json','utf8'))});
const XLSX=require('xlsx');
const a={...doc('B1'),name:'=1+1 & <test>',lots:[{id:'l1',name:'0000123',expiry:'2099-01-01',supplier:'Proveedor A',notes:'=HYPERLINK("bad")',createdAt:'2026-01-01',stock:{aprobado:12,ssc:5,rechazado:0}},{id:'l2',name:'LOT-2',expiry:'',supplier:'',notes:'',createdAt:'2026-01-01',stock:{aprobado:3.5}}]};
const output=excel.exportInventory([a],'B1',new Date('2026-10-10T12:00:00Z'));
const book=XLSX.read(output.buffer,{type:'buffer'});assert.equal(book.SheetNames.length,10);
assert.equal(book.Sheets['Material aprobado'].C2.v,12);assert.equal(book.Sheets['Material aprobado'].C3.v,3.5);assert.equal(book.Sheets['Material aprobado'].D2.v,'0000123');assert.equal(book.Sheets['Material aprobado'].H2.v,a.name);assert.equal(book.Sheets['Material aprobado'].H2.f,undefined);assert.equal(book.Sheets['Material aprobado'].E2.f,undefined);assert.equal(book.Sheets['Material aprobado'].F2.t,'n');assert.equal(book.Sheets['Materiales con SSC'].C2.v,5);assert.equal(book.Sheets['Material rechazado'].A2,undefined);
assert.equal(output.filename,'Almacenes-B1-2026-10-10.xlsx');
if(process.env.INVENTORY_EXPORT_QA_PATH) fs.writeFileSync(process.env.INVENTORY_EXPORT_QA_PATH,output.buffer);
console.log('Site isolation and Excel checks passed: independent B1/B2 stock, vouchers, duplicate codes, scoped operations, 10 sheets, typed quantities/dates, literal identifiers and formula-like text.');
