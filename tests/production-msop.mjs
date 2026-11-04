import assert from "node:assert/strict";
import {parseMsopPages,uniqueMsopRows} from "../lib/production/msop-parser.mjs";
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
assert.equal(continued.rows.length,4);
assert.equal(continued.rows[2].page,1);
assert.equal(continued.rows[2].section,"production");
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

const repeated=parseMsopPages([document,[
 cell("List of Materials/Components",0,740),
 cell("Part Number",0,720),cell("Description",120,720),
 cell("001.304",0,700),cell("Pasador",120,700),
 cell("List of Production Materials/Tools",0,660),
 cell("Part Number",0,640),cell("Description",120,640),
 cell("MTS-005",0,620),cell("Toallita de limpieza",120,620),
 cell("MTS-006",0,580),cell("Toallita de limpieza",120,580)
]],"001.MSOP.pdf");
assert.equal(repeated.rows.filter(r=>r.code==="001.304").length,1);
assert.equal(repeated.rows.find(r=>r.code==="001.304").name,"Pin");
assert.equal(repeated.rows.filter(r=>r.code==="MTS-005").length,1);
assert.ok(repeated.rows.some(r=>r.code==="MTS-006"),"Same name with another ID remains separate");
const saved=[
 {id:"a",code:" mts-005 ",name:"Wipe",unit:"",section:"materials",page:1,supplier:"",spec:""},
 {id:"b",code:"MTS–005",name:"Toallita",unit:"pz",section:"production",page:3,supplier:"Bioana",spec:"SPEC.MTS-005"},
 {id:"c",code:"",name:"Tool 1"}, {id:"d",code:"",name:"Tool 2"},
 {id:"e",code:"NA",name:"Tool 3"}, {id:"f",code:"NA",name:"Tool 4"},
 {id:"g",code:"001.303A",name:"Component"}, {id:"h",code:"001.303B",name:"Component"},
 {id:"i",code:"MTS-000",name:"Invalid 1"}, {id:"j",code:"MTS-000",name:"Invalid 2"}
];
const deduped=uniqueMsopRows(saved);
assert.equal(deduped.length,9);
assert.equal(deduped[0].id,"a");
assert.equal(deduped[0].section,"materials");
assert.equal(deduped[0].page,1);
assert.equal(deduped[0].name,"Wipe");
assert.equal(deduped[0].unit,"pz");
assert.equal(deduped[0].supplier,"Bioana");
assert.equal(deduped[0].spec,"SPEC.MTS-005");
assert.equal(saved[0].unit,"","Deduplication must not mutate saved/editor source rows");
assert.deepEqual(uniqueMsopRows(deduped),deduped,"Deduplication must be idempotent");
assert.equal(uniqueMsopRows([{code:"006.302",name:""},{code:"006.302",name:"Foam"}])[0].name,"Foam");
console.log("Bilingual/repeated MSOP rows and saved catalogues deduplicated by ID; missing metadata filled and uncoded/distinct articles preserved.");

// A wrapped Drawing / Reference header must not close a table that starts next page.
const splitTable=parseMsopPages([
 [cell("3. List of Materials/Components",0,140),cell("Part Number",0,115),cell("Component Name",120,115),{...cell("SPEC",350,115),width:30},cell("Drawing /",450,115),cell("Reference",450,100),cell("CONFIDENTIAL",260,40)],
 [cell("MSOP Example",240,760),cell("Page 2 of 3",440,730),cell("005.301",0,700),cell("Sleeves",120,700),{...cell("SPEC.005.301",350,700),width:75},cell("DWG.005.301",450,700),
  cell("005.302",0,670),cell("Scrubbing Head",120,670),cell("SPEC.005.302",350,670),
  cell("4. Manufacturing Process and Quality Inspection Information",0,610),cell("005.399",0,580),cell("Not in the materials table",120,580)]
],"005.MSOP.pdf");
assert.equal(splitTable.rows.length,2);
assert.ok(splitTable.rows.every(r=>r.section==="materials"&&r.page===2));
assert.equal(splitTable.rows[0].name,"Sleeves");
assert.equal(splitTable.rows[1].name,"Scrubbing Head");
const actualReferences=parseMsopPages([[cell("List of Materials/Components",0,760),cell("Part Number",0,740),cell("Component Name",120,740),cell("Drawing /",450,740),cell("Reference",450,725),cell("005.301",0,700),cell("Sleeves",120,700),cell("References",0,650),cell("005.399",0,620),cell("Outside the table",120,620)]],"005.MSOP.pdf");
assert.deepEqual(actualReferences.rows.map(r=>r.code),["005.301"],"A real References heading must still close the table");

const fragment=(str,x,y,width)=>({...cell(str,x,y),width});
const splitCodes=parseMsopPages([[cell("List of Materials/Components",0,760),cell("Part Number",0,740),cell("Component Name",120,740),
 fragment("00",0,700,12),fragment("5",12,700,6),fragment(".",18,700,3),fragment("3",21,700,6),fragment("0",27,700,6),fragment("1",33,700,6),cell("Sleeves",120,700),
 fragment("MTS",0,670,23),fragment("-",23,670,4),fragment("046",27,670,18),cell("Label roll",120,670)]],"005.MSOP.pdf");
assert.deepEqual(splitCodes.rows.map(r=>r.code),["005.301","MTS-046"]);
assert.deepEqual(splitCodes.rows.map(r=>r.name),["Sleeves","Label roll"]);
const tools=parseMsopPages([[cell("List of Production Materials/Tools",0,760),cell("Material/Tool ID",0,740),cell("Material/Tool Name",120,740),cell("TS.005.01",0,715),cell("Master part requiring review",120,715),fragment("MTS",0,700,23),fragment("-",23,700,4),fragment("002",27,700,18),cell("Distilled Water",120,700)]],"005.MSOP.pdf");
assert.equal(tools.rows.length,2);
assert.equal(tools.rows[0].code,"TS.005.01");
assert.equal(tools.rows[1].name,"Distilled Water","Do not absorb the preceding unrecognized tool into the MTS name");

const groupedDevices=parseMsopPages([[cell("Device Name",0,760),cell("Device Trade Name",120,740),cell("Device Model Number",240,740),cell("Part Number",380,740),cell("Reference",470,740),
 cell("1.1.",90,715),cell("005.101",390,715),cell("005.102",390,690),cell("Wound heads",120,707),cell("with sleeve",120,682),
 cell("1.2.",90,660),cell("005.102C",390,652),cell("005.103C",390,630),cell("Wound heads with",120,652),cell("curette and sleeve",120,630),
 cell("2. Description of the Product",0,590),cell("Prose",120,560),cell("not an article",380,560)]],"005.MSOP.pdf");
assert.equal(groupedDevices.rows.length,4);
assert.deepEqual(groupedDevices.rows.map(r=>r.name),["Wound heads with sleeve","Wound heads with sleeve","Wound heads with curette and sleeve","Wound heads with curette and sleeve"]);
console.log("Cross-page tables, wrapped Reference headers, fragmented codes, shared device cells and table boundaries passed.");
const tsTools=parseMsopPages([[cell("List of Production Materials/Tools",0,760),cell("Material/Tool ID",0,740),cell("Material/Tool Name",120,740),cell("TS.005.01",0,700),cell("Vibration post master part",120,700),cell("TS.005.02",0,670),cell("Debriding head with curette master part",120,670)],[cell("List of Production Materials/Tools",0,760),cell("TS.005.01",0,700),cell("Pieza maestra",120,700)]],"005.MSOP.pdf");
assert.deepEqual(tsTools.rows.map(r=>r.code),["TS.005.01","TS.005.02"]);
assert.equal(tsTools.rows[0].name,"Vibration post master part");
assert.equal(tsTools.rows[1].name,"Debriding head with curette master part");
console.log("TS tool IDs recognized and deduplicated without including the code in the description.");

const variants=parseMsopPages([[cell("List of Materials/Components",0,760),cell("Part Number",0,740),cell("Component Name",120,740),cell("005.303",0,700),cell("Base head",120,700),cell("005.303C",0,670),cell("Curette head",120,670)]],"005.MSOP.pdf");
assert.deepEqual(variants.rows.map(r=>[r.code,r.name]),[["005.303","Base head"],["005.303C","Curette head"]]);
console.log("Numeric component IDs and their C variants remain separate codes and descriptions.");
