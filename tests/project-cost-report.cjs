const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const pdfMake = require('pdfmake/build/pdfmake');
pdfMake.vfs = require('pdfmake/build/vfs_fonts').vfs;
const code = ts.transpileModule(fs.readFileSync('lib/project-cost-report.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
const exported = {};
vm.runInNewContext(code, { exports: exported });
const report = exported.buildProjectCostReport({ proyecto: '002.Labella', monthLabel: 'Octubre de 2026', search: 'motor', date: '27/10/2026', company: 'Bioana SAPI de CV', total: 150, pedidos: [
 { titulo: 'Motor', nombreUsuario: 'Jahaziel Garza', fechaLimite: '2026-10-24', fechaEntregaReal: '2026-10-27', status: 'listo', subtotalBaseMXN: 100 },
 { titulo: 'Otra pieza', nombreUsuario: 'user@example.com', subtotalBaseMXN: 50 },
] });
const rows = report.content[1].table.body;
assert.equal(rows.length, 3);
assert.equal(rows[1][1], 'Jahaziel Garza');
assert.equal(rows[2][1], 'Sin nombre registrado');
assert.equal(rows[1][5].text, 'MXN 100.00');
assert.match(report.content[2].text, /150\.00/);
pdfMake.createPdf(report).getBuffer(buffer => { fs.writeFileSync('/tmp/project-cost-report.pdf', buffer); console.log('Project cost PDF generated successfully'); });
