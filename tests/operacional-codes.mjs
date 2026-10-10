import ts from 'typescript';
import fs from 'node:fs';
import assert from 'node:assert/strict';
import vm from 'node:vm';
const exports={};vm.runInNewContext(ts.transpileModule(fs.readFileSync('lib/operacional/catalog.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,{exports});
assert.equal(exports.canOperate('ANDREA.SILLER@BIOANA.COM.MX'),true);
assert.equal(exports.canOperate('admin@bioana.com.mx'),false);
assert.equal(exports.canOperate('jahaziel4587@gmail.com.evil'),false);
for(const [code,project,type]of [['001.305','001','300'],['002.100','002','100'],['004.299','004','200'],['010.400','010','400'],['MTS-001','','MTS'],['MTS-1000','','MTS']]){const r=exports.parseComponentCode(code);assert.equal(r.projectCode,project);assert.equal(r.type,type);}
for(const code of ['001.500','001','MTS-000','MTS-X','001.030'])assert.throws(()=>exports.parseComponentCode(code));
assert.equal(exports.parseComponentCode('001.305.').code,'001.305');
assert.equal(new Set(exports.DEFAULT_PROJECTS.map(p=>p.code)).size,exports.DEFAULT_PROJECTS.length);
console.log('Operational access allowlist and component code checks passed.');
