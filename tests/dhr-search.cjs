const assert = require('node:assert/strict');
const ts = require('typescript');
const vm = require('node:vm');
const fs = require('node:fs');
const folders = {
  root: [{ id: '1', type: 'folder', name: 'DMR.001 Proyecto' }],
  '1': [{ id: '2', type: 'folder', name: 'WI' }, { id: '9', type: 'file', name: 'WI.001.100 Rev A.pdf' }, { id: '10', type: 'file', name: 'WI.001.100.docx' }],
  '2': [{ id: '3', type: 'folder', name: 'Histórico' }, { id: '11', type: 'file', name: 'WI.001.100 Rev B.PDF' }],
  '3': [{ id: '12', type: 'file', name: 'Certificado de inspección.pdf' }],
};
const output = ts.transpileModule(fs.readFileSync('lib/box/dhr.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
const exportsObject = {};
vm.runInNewContext(output, {
  exports: exportsObject, process: { env: { BOX_DMR_FOLDER_ID: 'root' } },
  require: name => name === 'server-only' ? {} : { listAllBoxFolderItems: async id => {
    if (!folders[id]) throw new Error('Forbidden');
    return folders[id];
  } },
});
(async () => {
  const result = await exportsObject.searchDmrPdfs('1', ['WI 001 100', 'inspeccion', 'faltante']);
  assert.deepEqual(Array.from(result.files, file => file.id), ['9', '11', '12']);
  assert.equal(result.files[2].path, 'DMR.001 Proyecto/WI/Histórico');
  assert.deepEqual(Array.from(result.missing), ['faltante']);
  await assert.rejects(() => exportsObject.searchDmrPdfs('999', ['WI']), /catálogo DMR/);
  folders['3'] = undefined;
  await assert.rejects(() => exportsObject.searchDmrPdfs('1', ['WI']), /Forbidden/);
  const PizZip = require('pizzip');
  const zip = new PizZip();
  zip.file('001-9-documento.pdf', Buffer.from('%PDF-1.7\nprueba'));
  const reopened = new PizZip(zip.generate({ type: 'nodebuffer' }));
  assert.equal(reopened.file('001-9-documento.pdf').asText(), '%PDF-1.7\nprueba');
  console.log('DHR: recursive search, revisions, missing files, scope validation, failed traversal and ZIP verified.');
})();
