const assert=require('node:assert/strict'),ts=require('typescript'),vm=require('node:vm'),fs=require('node:fs');
(async()=>{
 const parser=await import('../lib/dhr/parser.mjs');let fail=false;
 const folders={'204430279767':[{id:'1',type:'folder',name:'2025'}],'1':[{id:'2',type:'file',name:'ATF.161 Capacitación.pdf'},{id:'3',type:'file',name:'ATF.1611 Otro.pdf'},{id:'4',type:'folder',name:'Subcarpeta'}],'4':[{id:'5',type:'file',name:'ATF.192.pdf'}]};
 const exports={};vm.runInNewContext(ts.transpileModule(fs.readFileSync('lib/dhr/box.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,{exports,AbortSignal,require:name=>{
  if(name==='server-only')return {};
  if(name.includes('parser'))return parser;
  if(name.includes('boxAuth'))return {};
  return {listBoxFolderItems:async(id,offset)=>{if(fail&&id==='4')throw new Error('denied');const entries=folders[id];return {entries:entries.slice(offset,offset+1),total_count:entries.length};}};
 }});
 const result=await exports.searchSection('training',[{id:'a',text:'ATF.161 capacitación'},{id:'b',text:'ATF.192 capacitación'}]);
 assert.deepEqual(Array.from(result,f=>f.id),['2','5']);assert.equal(result[1].path,'Capacitaciones/2025/Subcarpeta');
 assert.throws(()=>exports.scope('untrusted'),/Sección/);
 fail=true;await assert.rejects(()=>exports.searchSection('training',[{id:'a',text:'ATF.161'}]),/denied/);
 console.log('DHR Box: paginated recursive search, code boundaries, allowed roots and complete failure on inaccessible folders verified.');
})();
