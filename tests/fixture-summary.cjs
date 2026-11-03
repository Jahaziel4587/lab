const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const ts = require('typescript');
const PizZip = require('pizzip');
const sharp = require('sharp');
const filename = require('node:path').resolve('lib/fixtures/summary-docx.ts');
const compiled = ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { target: ts.ScriptTarget.ES2017, module: ts.ModuleKind.CommonJS, esModuleInterop: true } }).outputText;
const mod = new Module(filename, module); mod.filename = filename; mod.paths = module.paths;
const originalRequire = mod.require.bind(mod);
mod.require = name => name === '../firebaseAdmin' ? { adminStorage: {} } : originalRequire(name);
mod._compile(compiled, filename);
const { descriptionWidths, renderSummary, versionPhotos } = mod.exports;
(async () => {
 const template = fs.readFileSync('public/templates/Spec_draft_template.docx');
 const widths = descriptionWidths(new PizZip(template));
 assert.equal(widths.length, 2);
 const image = await sharp({ create: { width: 1200, height: 600, channels: 3, background: 'red' } }).jpeg().toBuffer();
 const photo = w => ({ imagen: { data: image, width: w, height: Math.floor(w / 2) } });
 const result = renderSummary(new PizZip(template), {
  titulo: 'Fixture de prueba', idReferencia: 'TF.001', proyecto: 'Proyecto', solicitante: 'Nombre',
  especificacionesExtra: [{ version: 'VA', especificacion: 'Una\nDos', descripcion: 'Concepto único', estatus: 'Aprobada', fotos: [photo(widths[0]), photo(widths[0])] }],
  pruebasDiseno: [{ version: 'VA.1', descripcion: 'Primera prueba', pedidosAsociados: 'Pedido 1', estatus: 'Rechazada', fotos: [photo(widths[1])] }, { version: 'VA.2', descripcion: 'Segunda prueba', pedidosAsociados: 'NA', estatus: 'Pendiente', fotos: [] }],
 });
 const zip = new PizZip(result); const xml = zip.file('word/document.xml').asText();
 assert.equal((xml.match(/Concepto único/g) || []).length, 1);
 assert.equal((xml.match(/<w:tr[ >]/g) || []).length, 9);
 assert.equal((xml.match(/<w:drawing>/g) || []).length, 3);
 assert(!xml.includes('{%imagen}') && !xml.includes('undefined'));
 const extents = [...xml.matchAll(/<wp:extent[^>]*cx="(\d+)"[^>]*cy="(\d+)"/g)];
 assert.equal(extents.length, 3);
 extents.forEach((m,i) => assert(Number(m[1]) <= widths[i < 2 ? 0 : 1] * 9525));
 const empty = renderSummary(new PizZip(template), { especificacionesExtra: [], pruebasDiseno: [] });
 assert.equal((new PizZip(empty).file('word/document.xml').asText().match(/<w:tr[ >]/g) || []).length, 6);
 assert.deepEqual(await versionPhotos([{ name: 'plano.pdf' }], 'fixture', 100), []);
 await assert.rejects(versionPhotos([{ name: 'foto.jpg', url: 'https://example.com/photo.jpg' }], 'fixture', 100), /Origen/);
 console.log('Fixture summary: versions, statuses, empty lists and column-sized images passed.');
})().catch(error => { console.error(error); process.exit(1); });
