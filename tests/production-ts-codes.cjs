const fs=require('node:fs'),path=require('node:path'),ts=require('typescript'),assert=require('node:assert/strict');
const records=new Map();let counter=0;
const clone=v=>v===undefined?undefined:JSON.parse(JSON.stringify(v));
const snap=p=>({id:p.split('/').at(-1),ref:doc(p),exists:records.has(p),data:()=>clone(records.get(p))});
const doc=p=>({path:p,id:p.split('/').at(-1),get:async()=>snap(p)});
const collection=name=>({doc:id=>doc(name+'/'+(id||'generated'+ ++counter)),get:async()=>({docs:[...records.keys()].filter(p=>p.startsWith(name+'/')&&!p.slice(name.length+1).includes('/')).map(snap)})});
const db={collection,runTransaction:async fn=>{const writes=[];let writing=false;const get=r=>{assert(!writing,'Reads must precede writes');return r.get();};const result=await fn({get,create:(r,d)=>{writing=true;writes.push([r.path,d,true]);},set:(r,d)=>{writing=true;writes.push([r.path,d,false]);}});for(const [p,d,create]of writes){if(create)assert(!records.has(p));records.set(p,clone(d));}return result;}};
const stubs={
 'next/server':{NextResponse:{json:(data,o)=>({status:o?.status||200,data})}},
 '@/lib/firebaseAdmin':{adminDB:db},
 '@/lib/operacional/server':{identify:async()=>({uid:'planner'}),projectCatalog:async()=>[{code:'005',label:'005.XSONXS'},...load('lib/operacional/catalog.ts').DEFAULT_PROJECTS.filter(p=>p.code==='003')]},
 '@/lib/box/boxCatalog':{getDmrProjects:async()=>[{id:'project005',title:'DMR.005.XSONXS'},{id:'287774790255',title:'DMR.003.XSONX Handpiece'},{id:'unknown999',title:'DMR.999.Unregistered'}]},
};
const cache=new Map();function load(file){file=path.resolve(file);if(cache.has(file))return cache.get(file).exports;const m={exports:{}};cache.set(file,m);new Function('require','module','exports',ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText)(n=>{if(n in stubs)return stubs[n];if(n.startsWith('@/')||n.startsWith('.')){const p=n.startsWith('@/')?path.resolve(n.slice(2)):path.resolve(path.dirname(file),n);return load([p,p+'.ts',p+'.mjs'].find(x=>fs.existsSync(x)&&fs.statSync(x).isFile()));}return require(n);},m,m.exports);return m.exports;}
(async()=>{
 const {parseComponentCode}=load('lib/operacional/catalog.ts'),{normalizedCode,msopCodeForProject}=load('lib/production/codes.ts');
 assert.deepEqual(parseComponentCode(' ts.005.01 '),{code:'TS.005.01',projectCode:'005',type:'TS'});
 assert.equal(normalizedCode('TS . 005 . 02'),'TS.005.02');
 assert(msopCodeForProject('TS.005.01','005'));assert(!msopCodeForProject('TS.006.01','005'));
 for(const invalid of ['TS.005.00','TS.005.1','TS.05.01','TS.005.01oops','TS.005.01.02'])assert.throws(()=>parseComponentCode(invalid));
 assert.equal(parseComponentCode('005.303C').type,'300');assert.equal(parseComponentCode('MTS-005').type,'MTS');
 const {TYPES}=load('lib/inventario/catalogs.ts');assert.equal(TYPES.TS,'TS');
 const api=load('app/api/production/msop/route.ts');
 const row=(code,id)=>({id,code,name:'Tool '+id,unit:'pz',section:'production',page:3,supplier:'',spec:''});
 const body={projectId:'project005',site:'B1',version:0,source:{fileName:'005.MSOP.pdf',sha256:'a'.repeat(64),pageCount:4,documentProjectCode:'005',warnings:[]},rows:[row('TS.005.01','a'),row('TS.005.02','b')]};
 const post=b=>api.POST({json:async()=>clone(b)});
 assert.equal((await post({...body,rows:[row('TS.006.01','a')]})).status,400);
 assert.equal(records.size,0);
 const saved=await post(body);assert.equal(saved.status,200,saved.data.error);
 for(const prefix of ['inventario_componentes/','inventario_b2_componentes/']){
  const tools=[...records].filter(([p])=>p.startsWith(prefix)).map(([,v])=>v);
  assert.equal(tools.length,2);assert(tools.every(t=>t.type==='TS'&&t.project==='005.XSONXS'&&t.unit==='pz'&&t.lots.length===0));
  const {createHash}=require('node:crypto');assert(tools.every(t=>t.id===createHash('sha256').update(t.code).digest('hex')),'Same component identity used by QR/inventory');
 }
 const catalogue=[...records].find(([p])=>p.startsWith('production_msops/'))[1];
 assert.equal(catalogue.items.length,2);assert.equal(catalogue.rows.length,2);
 assert.equal((await post({...body,version:1})).status,200);assert.equal(records.size,5,'Reimport must not duplicate components');
 const defaults=load('lib/operacional/catalog.ts').DEFAULT_PROJECTS;
 assert.equal(defaults.filter(p=>p.code==='003').length,1);
 assert.equal(defaults.find(p=>p.code==='003').label,'003.XSONX Handpiece');
 const opened=await api.GET({nextUrl:{searchParams:new URLSearchParams({site:'B1',projectId:'287774790255'})}});
 assert.equal(opened.status,200,opened.data.error);assert.equal(opened.data.projectCode,'003');
 const handpiece={...body,projectId:'287774790255',source:{...body.source,fileName:'003.MSOP Rev1.pdf',documentProjectCode:'003'},rows:[row('003.301','handpiece-component'),row('TS.003.01','handpiece-tool')]};
 const handpieceSaved=await post(handpiece);assert.equal(handpieceSaved.status,200,handpieceSaved.data.error);
 for(const prefix of ['inventario_componentes/','inventario_b2_componentes/']){
  const articles=[...records].filter(([p,v])=>p.startsWith(prefix)&&v.code.startsWith('003.')).map(([,v])=>v);
  assert.equal(articles.length,1);assert.equal(articles[0].project,'003.XSONX Handpiece');
 }
 assert.equal((await post({...handpiece,version:1,rows:[row('005.301','wrong')]})).status,400);
 const missing=await api.GET({nextUrl:{searchParams:new URLSearchParams({site:'B1',projectId:'unknown999'})}});
 assert.equal(missing.status,400);assert.match(missing.data.error,/999.*Operacional/);
 const server=load('lib/operacional/server.ts');
 records.set('operacional_proyectos/003',{name:'Custom Handpiece',label:'003.Custom Handpiece'});
 assert.equal((await server.projectCatalog()).find(p=>p.code==='003').label,'003.Custom Handpiece','Existing Operational project takes precedence over the default');
 console.log('DMR.003: opens MSOP, saves project articles in both warehouses, rejects foreign codes, preserves configured project labels and explains missing catalogue entries.');
 console.log('TS codes: normalization, project boundaries, invalid formats, inventory type, MSOP finalization, stable QR/article IDs in B1/B2 and repeat imports passed.');
})().catch(e=>{console.error(e);process.exitCode=1;});
