// Run: node --test tests/inspection-notification-recipients.test.cjs
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const ts=require('typescript');
function fixture(){
 let actor={uid:'inspector',email:'inspector@test.local'};
 let managers=[{email:' QM@test.local '},{email:'qm@test.local'},{correo:'backup@test.local'},{email:''}];
 const records=new Map(),writes=[],pushes=[],queries=[];
 const snap=(id,data)=>({id,exists:data!==undefined,data:()=>data});
 function doc(p){return {id:p.split('/').pop(),get:async()=>snap(p,records.get(p)),collection:n=>collection(p+'/'+n),set:async data=>writes.push({path:p,data})};}
 function collection(p){return {doc:(id='auto')=>doc(p+'/'+id),add:async data=>writes.push({path:p,data}),where:(field,op,value)=>{queries.push({p,field,op,value});return {get:async()=>({docs:managers.map((data,i)=>snap(String(i),data))})};},orderBy:()=>({limit:()=>({get:async()=>({docs:[snap('latest',{createdByEmail:'inspector@test.local'})]})})})};}
 const db={collection,batch:()=>({set:(ref,data)=>writes.push({path:ref.id,data}),update:(ref,data)=>writes.push({path:ref.id,data}),commit:async()=>{}})};
 const modules={};
 function load(file){
  if(modules[file])return modules[file];
  const exports={};modules[file]=exports;
  const requireMock=id=>{
   if(id==='next/server')return {NextResponse:{json:(body,options)=>({body,status:options?.status||200})}};
   if(id==='firebase-admin/firestore')return {FieldValue:{serverTimestamp:()=>123}};
   if(id==='@/lib/firebaseAdmin')return {adminDB:db,adminAuth:{verifyIdToken:async()=>actor}};
   if(id==='@/lib/pushNotifications')return {getDisplayNameForUid:async()=> 'Inspector',sendPushToEmails:async input=>{pushes.push(input);return {sent:input.emails.length}}};
   if(id==='@/lib/inspections/notificationRecipients')return load('lib/inspections/notificationRecipients.ts');
   throw Error('Unexpected import: '+id);
  };
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(__dirname,'..',file),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,{exports,require:requireMock,URL,URLSearchParams,process:{env:{}},console});
  return exports;
 }
 return {load,records,writes,pushes,queries,setActor:x=>actor=x,setManagers:x=>managers=x,request:body=>({headers:{get:()=> 'Bearer test'},json:async()=>body,nextUrl:{origin:'https://example.test'}})};
}
const incoming='app/api/notifications/inspections/incoming-lot/route.ts';
for(const source of ['entrada_mts','entrada_proyecto','proceso_proyecto'])for(const action of ['anomaly_created','message','decision','threshold_exceeded','lot_finalized'])test(source+' '+action+' sends push and bell to Quality automatically',async()=>{
 const f=fixture(),scope='inspection_incoming_lots/s',lot=scope+'/lots/l',report=lot+'/reports/r';
 f.records.set(scope,{sourceType:source,projectId:'p',wiCode:'WI',componentId:'c'});
 f.records.set(lot,{responsiblePmEmail:'PM@test.local',lotName:'Lot',status:'finalized',finalizedByUid:'inspector',finalRejectedPieces:3,inspectionResult:'will_fail',confirmedUniqueRejectedQuantity:3,methodPlans:[{method:'visual',allowedRejectedQuantity:1}]});
 f.records.set(report,{kind:'anomaly',createdByUid:'inspector',createdByEmail:'inspector@test.local',decidedByUid:'inspector',decision:'fail'});
 f.records.set(report+'/messages/m',{createdByUid:'inspector',text:'Comment'});
 const response=await f.load(incoming).POST(f.request({action,scopeKey:'s',lotId:'l',reportId:'r',messageId:'m',inspectionMethod:'visual',qmEmail:'ignored@test.local'}));
 assert.equal(response.status,200);
 const expected=action==='decision'?['qm@test.local','backup@test.local']:['pm@test.local','qm@test.local','backup@test.local'];
 assert.deepEqual([...f.pushes[0].emails].sort(),expected.sort());
 assert.deepEqual(f.writes.filter(x=>x.path==='notifications').map(x=>x.data.userEmail).sort(),expected.sort());
 assert.ok(f.pushes[0].url.includes(source==='proceso_proyecto'?'/proceso?':'/entrada?'));
 assert.equal(f.queries[0].field,'isQualityManager');
});
test('latest role assignment is used; duplicate PM/QM and sender handled deliberately',async()=>{
 const f=fixture(),helper=f.load('lib/inspections/notificationRecipients.ts');
 f.setManagers([{email:' PM@test.local '},{email:'pm@test.local'}]);
 assert.deepEqual([...(await helper.inspectionNotificationRecipients(['pm@test.local','sender@test.local'],'sender@test.local'))],['pm@test.local']);
 f.setManagers([{email:'new@test.local'}]);
 assert.deepEqual([...(await helper.inspectionNotificationRecipients(['pm@test.local'],'new@test.local'))],['pm@test.local','new@test.local']);
 f.setManagers([]);assert.deepEqual([...(await helper.inspectionNotificationRecipients(['pm@test.local']))],['pm@test.local']);
});
test('invalid event sends nothing',async()=>{const f=fixture();const r=await f.load(incoming).POST(f.request({action:'bad',scopeKey:'s',lotId:'l'}));assert.equal(r.status,400);assert.equal(f.pushes.length,0);assert.equal(f.queries.length,0)});
test('repeated anomaly event does not notify again',async()=>{const f=fixture(),scope='inspection_incoming_lots/s',lot=scope+'/lots/l';f.records.set(scope,{});f.records.set(lot,{});f.records.set(lot+'/reports/r',{kind:'anomaly',createdByUid:'inspector',notifications:{createdSent:true}});const r=await f.load(incoming).POST(f.request({action:'anomaly_created',scopeKey:'s',lotId:'l',reportId:'r'}));assert.equal(r.body.alreadyNotified,true);assert.equal(f.pushes.length,0)});
for(const source of ['entrada_mts','proceso'])test('legacy anomaly created '+source+' includes QM',async()=>{const f=fixture(),scope='inspection_anomalies/s',anomaly=scope+'/anomalies/a';f.records.set(scope,{sourceType:source});f.records.set(anomaly,{responsiblePmEmail:'pm@test.local'});f.records.set(anomaly+'/occurrences/o',{createdByUid:'inspector'});const r=await f.load('app/api/notifications/inspections/anomaly-created/route.ts').POST(f.request({scopeKey:'s',anomalyId:'a',occurrenceId:'o'}));assert.equal(r.status,200);assert.deepEqual([...f.pushes[0].emails].sort(),['backup@test.local','pm@test.local','qm@test.local']);assert.equal(f.writes.filter(x=>x.path==='notifications').length,3)});
for(const activityType of ['message','occurrence'])test('legacy '+activityType+' includes QM even when PM is missing',async()=>{const f=fixture(),scope='inspection_anomalies/s',anomaly=scope+'/anomalies/a';f.records.set(scope,{});f.records.set(anomaly,{});f.records.set(anomaly+'/'+(activityType==='message'?'messages':'occurrences')+'/x',{createdByUid:'inspector',text:'Comment'});const r=await f.load('app/api/notifications/inspections/anomaly-activity/route.ts').POST(f.request({scopeKey:'s',anomalyId:'a',activityType,activityId:'x'}));assert.equal(r.status,200);assert.deepEqual([...f.pushes[0].emails].sort(),['backup@test.local','qm@test.local']);assert.equal(f.writes.filter(x=>x.path==='notifications').length,2)});
