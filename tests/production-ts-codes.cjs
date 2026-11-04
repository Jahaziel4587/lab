const fs=require('node:fs'),path=require('node:path'),ts=require('typescript'),assert=require('node:assert/strict');
const records=new Map();let counter=0,afterQuerySnapshot=null,beforeCommit=null;
const clone=v=>v===undefined?undefined:JSON.parse(JSON.stringify(v));
const snap=p=>({id:p.split('/').at(-1),ref:doc(p),exists:records.has(p),data:()=>clone(records.get(p))});
const doc=p=>({path:p,id:p.split('/').at(-1),get:async()=>snap(p)});
const collection=name=>({doc:id=>doc(name+'/'+(id||'generated'+ ++counter)),get:async()=>{const docs=[...records.keys()].filter(p=>p.startsWith(name+'/')&&!p.slice(name.length+1).includes('/')).map(snap);if(afterQuerySnapshot)afterQuerySnapshot(name);return {docs};}});
const db={collection,runTransaction:async fn=>{const writes=[];let writing=false;const get=r=>{assert(!writing,'Reads must precede writes');return r.get();};const result=await fn({get,getAll:(...refs)=>Promise.all(refs.map(get)),create:(r,d)=>{writing=true;writes.push([r.path,d,true]);},set:(r,d)=>{writing=true;writes.push([r.path,d,false]);}});if(beforeCommit){const hook=beforeCommit;beforeCommit=null;hook();}for(const [p,d,create]of writes)if(create&&records.has(p))throw Object.assign(new Error('ALREADY_EXISTS'),{code:6});for(const [p,d]of writes)records.set(p,clone(d));return result;}};
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
 assert.equal(parseComponentCode('005.303C').type,'300');assert.equal(normalizedCode('005.303C'),'005.303C');assert.notEqual(normalizedCode('005.303'),normalizedCode('005.303C'));assert.equal(parseComponentCode('MTS-005').type,'MTS');
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
 // Manual article in only one warehouse: reuse it, preserve its lots and mirror only its definition.
 const {createHash}=require('node:crypto');
 for(const sourceSite of ['B1','B2']){
  const code=sourceSite==='B1'?'005.301':'005.302',id=createHash('sha256').update(code).digest('hex');
  const sourcePrefix=sourceSite==='B1'?'inventario_componentes/':'inventario_b2_componentes/';
  const targetPrefix=sourceSite==='B1'?'inventario_b2_componentes/':'inventario_componentes/';
  const manual={code,name:'Manual '+code,unit:'roll',lots:[{id:'manual-lot',stock:{aprobado:42},notes:'Keep me'}],createdAt:'2025-01-01',createdBy:'quality'};
  const sourcePath=sourcePrefix+(sourceSite==='B1'?'legacy-random-component-id':id);
  records.set(sourcePath,clone(manual));
  const currentVersion=[...records].find(([p])=>p.startsWith('production_msops/'))[1].version;
  const result=await post({...body,site:sourceSite,version:currentVersion,rows:[row(code,'manual')]});
  assert.equal(result.status,200,result.data.error);
  assert.deepEqual(records.get(sourcePath),manual,'Source lots, stock, QR identity and metadata must remain untouched');
  const mirrored=records.get(targetPrefix+id);assert.equal(mirrored.name,manual.name);assert.equal(mirrored.unit,'roll');assert.deepEqual(mirrored.lots,[]);
 }
 // A concurrent manual creation appears after the collection query snapshot.
 const racedCode='005.303',racedId=createHash('sha256').update(racedCode).digest('hex'),racedPath='inventario_componentes/'+racedId;
 const racedArticle={code:racedCode,name:'Created concurrently',unit:'pz',lots:[{id:'real-lot',stock:{aprobado:12}}]};
 afterQuerySnapshot=name=>{if(name==='inventario_componentes'){records.set(racedPath,clone(racedArticle));afterQuerySnapshot=null;}};
 let version=[...records].find(([p])=>p.startsWith('production_msops/'))[1].version;
 const raced=await post({...body,version,rows:[row(racedCode,'race')]});
 assert.equal(raced.status,200,raced.data.error);assert.deepEqual(records.get(racedPath),racedArticle);
 assert.deepEqual(records.get('inventario_b2_componentes/'+racedId).lots,[]);
 version++;
 assert.equal((await post({...body,version,rows:[row(racedCode,'repeat')]})).status,200);
 const both=await api.GET({nextUrl:{searchParams:new URLSearchParams({site:'B1',projectId:'project005'})}});
 assert.deepEqual(both.data.existing.find(c=>c.code===racedCode).sites,['B1','B2']);
 // Also retry a real ALREADY_EXISTS commit collision, without overriding the concurrent writer.
 const lateCode='005.306',lateId=createHash('sha256').update(lateCode).digest('hex'),latePath='inventario_componentes/'+lateId;
 const lateArticle={code:lateCode,name:'Late manual creation',unit:'pz',lots:[{id:'late-lot',stock:{aprobado:25}}]};
 beforeCommit=()=>records.set(latePath,clone(lateArticle));
 const late=await post({...body,version:version+1,rows:[row(lateCode,'late')]});
 assert.equal(late.status,200,late.data.error);assert.deepEqual(records.get(latePath),lateArticle);
 assert.deepEqual(records.get('inventario_b2_componentes/'+lateId).lots,[]);
 version++;
 // A historical article retains its QR/document ID after changing 005.304 to 005.304C.
 const conflictCode='005.304',conflictId=createHash('sha256').update(conflictCode).digest('hex');
 const variant={code:'005.304C',name:'Existing curette variant',unit:'pz',lots:[{id:'variant-lot',stock:{aprobado:17}}],createdBy:'quality'};
 records.set('inventario_componentes/'+conflictId,clone(variant));
 const variantBody={...body,version:version+1,rows:[{...row(conflictCode,'base'),name:'Base head'},row('005.304C','variant')]};
 const conflict=await post(variantBody);
 assert.equal(conflict.status,200,conflict.data.error);
 assert.deepEqual(records.get('inventario_componentes/'+conflictId),variant,'Existing variant QR, lots, stock and name stay untouched');
 const baseInB1=[...records].filter(([p,v])=>p.startsWith('inventario_componentes/')&&v.code===conflictCode);
 assert.equal(baseInB1.length,1);assert.notEqual(baseInB1[0][0],'inventario_componentes/'+conflictId);
 assert.equal(baseInB1[0][1].name,'Base head');assert.deepEqual(baseInB1[0][1].lots,[]);
 for(const prefix of ['inventario_componentes/','inventario_b2_componentes/']){
  assert.equal([...records].filter(([p,v])=>p.startsWith(prefix)&&v.code==='005.304').length,1);
  assert.equal([...records].filter(([p,v])=>p.startsWith(prefix)&&v.code==='005.304C').length,1);
 }
 const versionAfterVariant=variantBody.version+1;
 assert.equal((await post({...variantBody,version:versionAfterVariant})).status,200);
 assert.equal([...records].filter(([p,v])=>p.startsWith('inventario_componentes/')&&v.code==='005.304').length,1,'Reimport reuses the alternative identity');
 assert.deepEqual(records.get('inventario_componentes/'+conflictId),variant);
 console.log('MSOP distinguishes base/suffixed articles even with historical document IDs; both warehouses receive separate definitions and existing QR/stock survive reimports.');
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
