import assert from "node:assert/strict";
import {parseMsopPages} from "../lib/production/msop-parser.mjs";
const cell=(str,x,y)=>({str,transform:[1,0,0,1,x,y],width:100});
const document=[
 cell("001.MSOP Rev3",0,800),cell("Device Name",0,770),cell("001.101",0,750),cell("Final assembly",120,750),
 cell("List of Materials/Components",0,700),cell("Part Number",0,680),cell("Description",120,680),cell("Supplier",300,680),
 cell("001.304",0,660),cell("Pin",120,660),cell("Bioana",300,660),
 cell("List of Production Materials/Tools",0,600),cell("Part Number",0,580),cell("Description",120,580),
 cell("MTS-005",0,560),cell("Cleaning wipe",120,560),cell("NA",0,540),cell("Tool requiring a code",120,540)
];
const result=parseMsopPages([document],"001.MSOP.pdf");
assert.equal(result.documentProjectCode,"001");
assert.equal(result.rows.length,4);
assert.equal(result.rows[1].name,"Pin");
assert.equal(result.rows[1].supplier,"Bioana");
assert.equal(result.rows[2].section,"production");
assert.equal(result.rows[3].code,"");
assert.equal(result.rows[3].name,"Tool requiring a code");
assert.ok(result.rows.every(row=>row.unit===""),"PDF import must never invent stock units");
const continued=parseMsopPages([document,[cell("MTS-005",0,740),cell("Cleaning wipe",120,740)]],"001.MSOP.pdf");
assert.equal(continued.rows.length,5);
assert.equal(continued.rows[4].page,2);
assert.equal(continued.rows[4].section,"production");
const wrong=parseMsopPages([[cell("005.MSOP Rev6",0,800),...document.slice(1)]],"005.MSOP.pdf");
assert.equal(wrong.documentProjectCode,"005");
assert.ok(parseMsopPages([[]],"001.MSOP.pdf").warnings.length);
assert.ok(!parseMsopPages([[cell("MTS-999 outside any target table",0,800)]],"001.MSOP.pdf").rows.length);
console.log("MSOP extraction section boundaries, pages, missing codes, and blank-unit gate passed.");

const wrapped=[
 cell("List of Materials/Components",0,740),
 cell("Part Number",0,720),cell("Component Name",150,720),cell("Spec #",380,720),
 {...cell("006.301",10,700),width:45},cell("Top Dressing Foam",110,700),cell("SPEC.006.301",380,700),
 cell("Two line",110,676),{...cell("006.302",10,670),width:45},cell("SPEC.006.302",380,670),cell("foam insert",110,664),
 {...cell("006.303",10,640),width:45},cell("Partial Top SPEC.006.303",110,640)
];
const corrected=parseMsopPages([wrapped],"006.MSOP Rev3.pdf");
assert.equal(corrected.rows.length,3);
assert.equal(corrected.rows[0].name,"Top Dressing Foam");
assert.equal(corrected.rows[0].spec,"SPEC.006.301");
assert.equal(corrected.rows[1].name,"Two line foam insert");
assert.equal(corrected.rows[1].spec,"SPEC.006.302");
assert.equal(corrected.rows[2].name,"Partial Top");
assert.equal(corrected.rows[2].spec,"SPEC.006.303");
assert.equal(result.rows[2].name,"Cleaning wipe","Uncoded tool row must not be appended to preceding name");
const specOnly=parseMsopPages([[cell("List of Materials/Components",0,740),cell("Part Number",0,720),cell("Description",120,720),cell("Spec #",380,720),cell("006.302",0,700),cell("SPEC.006.302",380,700)]],"006.MSOP.pdf");
assert.equal(specOnly.rows[0].name,"");
assert.ok(specOnly.warnings.some(w=>w.includes("sin código o nombre")));
const spacing=parseMsopPages([[cell("List of Materials/Components",0,740),cell("006.301",0,700),cell("Top foam",120,700),cell("SPEC. 006.301",380,700)]],"006.MSOP.pdf");
assert.equal(spacing.rows.length,1);
assert.equal(spacing.rows[0].name,"Top foam");
assert.equal(spacing.rows[0].spec,"SPEC.006.301");
console.log("SPEC separation and centered-number multiline-row regressions passed.");
