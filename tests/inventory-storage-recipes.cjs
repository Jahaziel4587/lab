const fs=require('fs'),ts=require('typescript'),assert=require('node:assert/strict');
function load(path,imports={}){const m={exports:{}};new Function('require','module','exports',ts.transpileModule(fs.readFileSync(path,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,esModuleInterop:true,resolveJsonModule:true}}).outputText)(n=>imports[n]||require(n),m,m.exports);return m.exports;}
const storage=load('lib/inventario/storage.ts'),{validateRecipe,recipePeriod}=load('lib/inventario/fixed-recipes.ts'),{exportInventory}=load('lib/inventario/excel.ts',{'./export-template.json':JSON.parse(fs.readFileSync('lib/inventario/export-template.json'))});
const before={temperatureCondition:'15–30',humidityCondition:'Below 60'},next=storage.storageConditions(' 2–8 ','N/A');
assert.equal(next.temperatureCondition,'2–8');assert.throws(()=>storage.storageConditions('','N/A'));
const component={id:'component000001',code:'MTS-001',name:'Alcohol',unit:'L',...before,lots:[{id:'a',name:'LOTE-1',stock:{aprobado:5,ssc:3},...before},{id:'b',name:'LOTE-2',stock:{aprobado:0},...before},{id:'c',name:'LOTE-3',stock:{aprobado:2},...next}]};
assert.deepEqual(storage.affectedLots(component,next).map(l=>l.id),['a']);assert(storage.conditionsDiffer(before,next));assert(!storage.conditionsDiffer(next,{...next}));
assert.equal(storage.bioanaDate('2025-09-03T18:00:00Z'),'03/sep/25');assert.equal(storage.bioanaDate('2026-10-13T03:00:00Z'),'12/oct/26');
const recipe=validateRecipe({title:'Semanal',startDate:'2026-10-01',endDate:'2026-10-31',intervalDays:7,lines:[{componentId:component.id,quantity:3}]});assert.equal(recipePeriod(recipe,'2026-10-07'),0);assert.equal(recipePeriod(recipe,'2026-10-08'),1);assert.equal(recipePeriod(recipe,'2027-10-01'),52);assert.throws(()=>recipePeriod(recipe,'2026-09-30'));assert(!('endDate' in recipe));assert.throws(()=>validateRecipe({...recipe,intervalDays:0}));assert.throws(()=>validateRecipe({...recipe,lines:[recipe.lines[0],recipe.lines[0]]}));
const wb=require('xlsx').read(exportInventory([component],'B1').buffer,{type:'buffer'});assert(!wb.SheetNames.includes('Materiales con SSC'));assert(!wb.SheetNames.includes('Limpieza'));assert(wb.SheetNames.includes('Almacenamiento'));const audit=require('xlsx').utils.sheet_to_json(wb.Sheets.Almacenamiento);assert.equal(audit[0]['Temperatura componente (°C)'],'15–30');assert.equal(audit[0]['Temperatura lote (°C)'],'15–30');assert(audit[0]['Existencias / ubicación'].includes('ssc: 3 L'));assert.equal(require('xlsx').utils.sheet_to_json(wb.Sheets['Material aprobado'])[0].Cantidad,5);
console.log('Storage overrides, affected lots, dates, recurring periods and Excel legacy balances passed.');

const writes=[],alerts=[];let count=0;
const server=load('lib/inventario/storage-server.ts',{'@/lib/firebaseAdmin':{adminDB:{collection:name=>({doc:()=>({id:`alert${++count}`,collection:name})})}},'firebase-admin/firestore':{FieldValue:{serverTimestamp:()=> 'timestamp'}},'@/lib/pushNotifications':{},'./sites':load('lib/inventario/sites.ts'),'./storage':storage});
const copy=JSON.parse(JSON.stringify(component));server.applyStorage({create:(ref,data)=>writes.push({ref,data})},copy,next,'B1','Usuario',['warehouse@example.com'],alerts);
assert.equal(copy.temperatureCondition,'2–8');assert.equal(copy.lots[0].temperatureCondition,'15–30');assert.equal(alerts.length,1);assert.equal(writes.length,2);assert.equal(writes[0].data.lots.length,1);assert.equal(writes[1].data.userEmail,'warehouse@example.com');
server.applyStorage({create:()=>assert.fail('Unchanged conditions must not notify')},copy,next,'B1','Usuario',['warehouse@example.com'],[]);
console.log('Storage review and notification are recorded together; existing lot snapshots remain unchanged.');

const {filterRecipeMaterials,availableRecipeQuantity}=load('lib/inventario/recipe-materials.ts',{'./catalogs':load('lib/inventario/catalogs.ts'),'./selection':load('lib/inventario/selection.ts')});
const empty={...component,id:'emptycomponent',code:'MTS-099',name:'Jeringa sin inventario',lots:[]};
const expired={...component,id:'expiredcomponent',code:'MTS-100',name:'Ácido',lots:[{id:'expired',expiry:'2025-01-01',stock:{aprobado:20}}]};
assert.equal(filterRecipeMaterials([component,empty,expired],'').length,3);
assert.deepEqual(filterRecipeMaterials([component,empty,expired],'sin inventario').map(c=>c.id),[empty.id]);
assert.deepEqual(filterRecipeMaterials([component,empty,expired],'acido').map(c=>c.id),[expired.id]);
assert.deepEqual(filterRecipeMaterials([component,empty,expired],'mts-099').map(c=>c.id),[empty.id]);
assert.equal(availableRecipeQuantity(empty,'2026-10-13'),0);assert.equal(availableRecipeQuantity(expired,'2026-10-13'),0);assert.equal(availableRecipeQuantity(component,'2026-10-13'),7);
console.log('Material search includes zero-stock/expired materials and supports codes, names and accents.');
