// Run: node --test tests/aql.test.cjs
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');const ts=require('typescript');const vm=require('node:vm');const path=require('node:path');
const exportsObject={};
vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(__dirname,'../lib/inspections/aql.ts'),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,{exports:exportsObject});
const {calculateAql,applyAutomaticAql,NORMAL_AQLS,ZERO_AQLS}=exportsObject;
test('QAP worked example: 3500, II, 1.0 = L/200/5/6',()=>{const x=calculateAql(3500,'II','1.0');assert.equal(x.codeLetter,'L');assert.equal(x.sampleSize,200);assert.equal(x.acceptanceNumber,5);assert.equal(x.rejectionNumber,6)});
test('lot boundaries and special levels use table A',()=>{const max=[8,15,25,50,90,150,280,500,1200,3200,10000,35000,150000,500000,500001];const codes=['AABAAAA','ABCAAAA','BCDAABB','CDEABBC','CEFBBCC','DFGBBCD','EGHBCDE','FHJBCDE','GJKCCEF','HKLCDEG','JLMCDFG','KMNCDFH','LNPDEGJ','MPQDEGJ','NQRDEHK'];const levels=['I','II','III','S1','S2','S3','S4'];max.forEach((n,i)=>levels.forEach((l,j)=>{assert.equal(calculateAql(n,l,'1').codeLetter,codes[i][j]);if(i>0)assert.equal(calculateAql(max[i-1]+1,l,'1').codeLetter,codes[i][j])}))});
test('table arrows change n upwards/downwards, including internal gaps',()=>{assert.equal(calculateAql(3500,'II','0.065').sampleSize,200);assert.equal(calculateAql(20000,'II','0.065').sampleSize,800);assert.equal(calculateAql(100000,'II','0.065').sampleSize,800);assert.equal(calculateAql(3500,'S1','1').sampleSize,13);assert.equal(calculateAql(500001,'III','6.5').sampleSize,200);assert.equal(calculateAql(100,'II','1').sampleSize,50);assert.equal(calculateAql(200,'II','1').sampleSize,50)});
test('small lots inspect all; no sample larger than lot',()=>{for(const plan of ['normal','squeglia'])for(const aql of plan==='normal'?NORMAL_AQLS:ZERO_AQLS){for(let n=1;n<=25;n++){const x=calculateAql(n,'II',aql,plan);assert.ok(x.sampleSize<=n);if(x.inspectEntireLot){assert.equal(x.acceptanceNumber,0);assert.equal(x.rejectionNumber,1)}}}});
test('Squeglia is separate, zero acceptance, no level influence',()=>{for(const l of ['I','II','S4']){const x=calculateAql(3500,l,'1','squeglia');assert.equal(x.sampleSize,50);assert.equal(x.acceptanceNumber,0);assert.equal(x.rejectionNumber,1)}assert.equal(calculateAql(8,'II','1','squeglia').sampleSize,8);assert.equal(calculateAql(500001,'II','.01','squeglia').sampleSize,1250)});
test('all supported cells give coherent plans',()=>{for(const n of [1,8,9,15,16,25,26,50,51,90,91,150,151,280,281,500,501,1200,1201,3200,3201,10000,10001,35000,35001,150000,150001,500000,500001])for(const level of ['I','II','III','S1','S2','S3','S4'])for(const plan of ['normal','squeglia'])for(const aql of plan==='normal'?NORMAL_AQLS:ZERO_AQLS){const x=calculateAql(n,level,aql,plan);assert.ok(x.sampleSize>=1&&x.sampleSize<=n);assert.ok(x.acceptanceNumber<x.sampleSize);assert.equal(x.rejectionNumber,x.acceptanceNumber+1)}});
test('creation recomputes submitted limits; documentary/full/shift excluded',()=>{const p={method:'visual',inspectionLevel:'II',inspectionType:'normal',aql:'1',inspectedQuantity:1,allowedRejectedQuantity:99};const x=applyAutomaticAql(p,3500);assert.equal(x.inspectedQuantity,200);assert.equal(x.allowedRejectedQuantity,5);assert.equal(x.aqlCalculation.reference,'QAP-013 Rev C');for(const patch of [{method:'documentary'},{isFullInspection:true},{perShift:true}]){const input={...p,...patch};assert.equal(applyAutomaticAql(input,3500),input)}});
test('invalid or unapproved plans cannot silently calculate',()=>{for(const args of [[0,'II','1'],[1.2,'II','1'],[100,'IV','1'],[100,'II',''],[100,'II','0.01'],[100,'II','1','tightened']])assert.throws(()=>calculateAql(...args))});

test('ASQ arrow examples: D/.25 -> H/50 and F/.15 -> J/80',()=>{
 const d=calculateAql(500,'S3','0.25');
 assert.equal(d.codeLetter,'D');assert.equal(d.baseSampleSize,8);
 assert.equal(d.effectiveCodeLetter,'H');assert.equal(d.tableSampleSize,50);assert.equal(d.sampleSize,50);
 assert.equal(d.acceptanceNumber,0);assert.equal(d.rejectionNumber,1);
 const f=calculateAql(150,'II','0.15');
 assert.equal(f.codeLetter,'F');assert.equal(f.baseSampleSize,20);
 assert.equal(f.effectiveCodeLetter,'J');assert.equal(f.sampleSize,80);
});
test('L: 0.65 is Ac3/Re4; 0.065 is Ac0/Re1, both n200',()=>{
 const cases=[['0.065',0,1],['0.65',3,4],['1.0',5,6]];
 for(const [aql,ac,re] of cases){
  const x=calculateAql(3500,'II',aql);
  assert.equal(x.lotRange,'3201–10000');assert.equal(x.baseSampleSize,200);
  assert.equal(x.sampleSize,200);assert.equal(x.acceptanceNumber,ac);assert.equal(x.rejectionNumber,re);
 }
});
test('base sample and actual table sample remain distinct when capped to full lot',()=>{
 const x=calculateAql(8,'III','0.65');
 assert.equal(x.codeLetter,'B');assert.equal(x.baseSampleSize,3);
 assert.equal(x.effectiveCodeLetter,'F');assert.equal(x.tableSampleSize,20);
 assert.equal(x.sampleSize,8);assert.equal(x.inspectEntireLot,true);
});

test('both rows of every bidirectional range use the first lower numeric plan',()=>{
 const rows=[
  ['0.065','MN','P',800],['0.10','LM','N',500],['0.15','KL','M',315],
  ['0.25','JK','L',200],['0.40','HJ','K',125],['0.65','GH','J',80],
  ['1.0','FG','H',50],['1.5','EF','G',32],['2.5','DE','F',20],
  ['4.0','CD','E',13],['6.5','BC','D',8]
 ];
 const letters='ABCDEFGHJKLMNPQR';
 const lots=[8,15,25,50,90,150,280,500,1200,3200,10000,35000,150000,500000,500001];
 const levels=['I','II','III','S1','S2','S3','S4'];
 for(const [aql,range,effective,n] of rows)for(const letter of range){
  let found=false;
  for(const lotSize of lots)for(const level of levels){
   const x=calculateAql(lotSize,level,aql);
   if(x.codeLetter!==letter)continue;
   found=true;assert.equal(x.bidirectionalArrow,true);
   assert.equal(x.effectiveCodeLetter,effective);assert.equal(x.tableSampleSize,n);
   assert.ok(letters.indexOf(x.effectiveCodeLetter)>letters.indexOf(letter));
   assert.equal(x.sampleSize,Math.min(n,lotSize));
   assert.equal(x.acceptanceNumber,x.inspectEntireLot?0:1);
   assert.equal(x.rejectionNumber,x.inspectEntireLot?1:2);
  }
  assert.ok(found);
 }
});
test('one-way up/down arrows and explicit numeric plans are unchanged',()=>{
 const up=calculateAql(500001,'III','6.5');
 assert.equal(up.effectiveCodeLetter,'L');assert.equal(up.sampleSize,200);
 assert.equal(up.acceptanceNumber,21);assert.equal(up.bidirectionalArrow,false);
 const down=calculateAql(500,'S3','0.25');
 assert.equal(down.effectiveCodeLetter,'H');assert.equal(down.sampleSize,50);
 assert.equal(down.acceptanceNumber,0);assert.equal(down.bidirectionalArrow,false);
 const numeric=calculateAql(3500,'II','0.65');
 assert.equal(numeric.sampleSize,200);assert.equal(numeric.acceptanceNumber,3);
 assert.equal(numeric.bidirectionalArrow,false);
});
