/** Controlled transcription: QAP-013 Rev C, tables A/B (pp.11–12), Squeglia (p.13).
 * Normal single sampling only. Single-direction arrows follow their direction;
 * bidirectional ranges keep the original sample and take only Ac/Re from below
 * (custom operational rule; not the unmodified standard sampling plan).
 * No percentage approximation and no automatic normal/tightened/reduced switching.
 */
export type AqlLevel = "I"|"II"|"III"|"S1"|"S2"|"S3"|"S4";
export type AqlPlan = "normal"|"squeglia";
export const NORMAL_AQLS = ["0.065","0.10","0.15","0.25","0.40","0.65","1.0","1.5","2.5","4.0","6.5"];
export const ZERO_AQLS = ["0.010","0.015","0.025","0.040","0.065","0.10","0.15","0.25","0.40","0.65","1.0","1.5","2.5","4.0","6.5","10.0"];
const bounds=[8,15,25,50,90,150,280,500,1200,3200,10000,35000,150000,500000,Infinity];
const levels:AqlLevel[]=["I","II","III","S1","S2","S3","S4"];
const letters="ABCDEFGHJKLMNPQR";
const sizes=[2,3,5,8,13,20,32,50,80,125,200,315,500,800,1250,2000];
const codes=["AABAAAA","ABCAAAA","BCDAABB","CDEABBC","CEFBBCC","DFGBBCD","EGHBCDE","FHJBCDE","GJKCCEF","HKLCDEG","JLMCDFG","KMNCDFH","LNPDEGJ","MPQDEGJ","NQRDEHK"];
// Explicit numeric cells in each column. Missing cells follow the printed arrows:
// above first -> down; after last -> up; bidirectional gap after Ac=0 -> lower plan.
const normalColumns=[
 [[10,0],[13,1],[14,2],[15,3]],
 [[9,0],[12,1],[13,2],[14,3],[15,5]],
 [[8,0],[11,1],[12,2],[13,3],[14,5],[15,7]],
 [[7,0],[10,1],[11,2],[12,3],[13,5],[14,7],[15,10]],
 [[6,0],[9,1],[10,2],[11,3],[12,5],[13,7],[14,10],[15,14]],
 [[5,0],[8,1],[9,2],[10,3],[11,5],[12,7],[13,10],[14,14],[15,21]],
 [[4,0],[7,1],[8,2],[9,3],[10,5],[11,7],[12,10],[13,14],[14,21]],
 [[3,0],[6,1],[7,2],[8,3],[9,5],[10,7],[11,10],[12,14],[13,21]],
 [[2,0],[5,1],[6,2],[7,3],[8,5],[9,7],[10,10],[11,14],[12,21]],
 [[1,0],[4,1],[5,2],[6,3],[7,5],[8,7],[9,10],[10,14],[11,21]],
 [[0,0],[3,1],[4,2],[5,3],[6,5],[7,7],[8,10],[9,14],[10,21]],
];
// 0 denotes the table's A: inspect the entire lot.
const zeroSizes=[
 [0,0,0,0,0,0,0,0,0,0,0,0,5,3,2,2],
 [0,0,0,0,0,0,0,0,0,0,13,8,5,3,2,2],
 [0,0,0,0,0,0,0,0,0,20,13,8,5,3,3,2],
 [0,0,0,0,0,0,0,0,32,20,13,8,5,5,5,2],
 [0,0,0,0,0,0,80,50,32,20,13,8,7,6,5,4],
 [0,0,0,0,0,125,80,50,32,20,13,12,11,7,6,5],
 [0,0,0,0,200,125,80,50,32,20,20,19,13,10,7,6],
 [0,0,0,315,200,125,80,50,48,47,29,21,16,11,9,7],
 [0,800,500,315,200,125,80,75,73,47,34,27,19,15,11,8],
 [1250,800,500,315,200,125,120,116,73,53,42,35,23,18,13,9],
 [1250,800,500,315,200,192,189,116,86,68,50,38,29,22,15,9],
 [1250,800,500,315,300,294,189,135,108,77,60,46,35,29,15,9],
 [1250,800,500,490,476,294,218,170,123,96,74,56,40,29,15,9],
 [1250,800,750,715,476,345,270,200,156,119,90,64,40,29,15,9],
 [1250,1200,1112,715,556,435,303,244,189,143,102,64,40,29,15,9],
];
export function calculateAql(lotSize:number, level:AqlLevel, aql:string, plan:AqlPlan="normal") {
 if(!Number.isSafeInteger(lotSize)||lotSize<1)throw new Error("Agrega una cantidad total de lote válida para calcular AQL.");
 if(!levels.includes(level))throw new Error("Nivel de inspección no válido.");
 if(plan!=="normal"&&plan!=="squeglia")throw new Error("Plan de muestreo no disponible en QAP-013 Rev C.");
 const options=plan==="normal"?NORMAL_AQLS:ZERO_AQLS;
 const column=options.findIndex(x=>Number(x)===Number(aql));
 if(!aql.trim()||column<0)throw new Error("Selecciona un AQL de la tabla del QAP.");
 const row=bounds.findIndex(x=>lotSize<=x);
 const codeLetter=codes[row][levels.indexOf(level)];
 let sampleSize:number, acceptanceNumber:number, effectiveCodeLetter="";
 let bidirectionalArrow=false;
 if(plan==="squeglia") {sampleSize=zeroSizes[row][column]||lotSize;acceptanceNumber=0;}
 else {
  const index=letters.indexOf(codeLetter), cells=normalColumns[column];
  let cell=cells.find(c=>c[0]===index);
  if(!cell){if(index<cells[0][0])cell=cells[0];else if(index>cells[cells.length-1][0])cell=cells[cells.length-1];else {bidirectionalArrow=true;cell=cells[1];}}
  sampleSize=sizes[cell[0]];acceptanceNumber=cell[1];effectiveCodeLetter=letters[cell[0]];
 }
 const baseSampleSize=plan==="normal"?sizes[letters.indexOf(codeLetter)]:0;
 const tableSampleSize=sampleSize;
 const lotRange=lotSize===1?"1":row===bounds.length-1?"500001 o más":`${row===0?2:bounds[row-1]+1}–${bounds[row]}`;
 if(bidirectionalArrow)sampleSize=baseSampleSize;
 const inspectEntireLot=sampleSize>=lotSize;
 // QAP table B: if n >= lot size, inspect 100%; existing 100% rule is Ac=0/Re=1.
 if(inspectEntireLot){sampleSize=lotSize;acceptanceNumber=0;}
 return {plan,lotRange,baseSampleSize,tableSampleSize,bidirectionalArrow,preserveBaseSample:bidirectionalArrow, aql:options[column],codeLetter:plan==="normal"?codeLetter:"",effectiveCodeLetter,sampleSize,acceptanceNumber,rejectionNumber:acceptanceNumber+1,inspectEntireLot,reference:"QAP-013 Rev C"};
}
export type AqlCalculation=ReturnType<typeof calculateAql>;

/** Recompute on creation as well as in the UI; never trust submitted Ac/n. */
export function applyAutomaticAql<T extends {method:string;isFullInspection?:boolean;perShift?:boolean;inspectionLevel:AqlLevel;aql:string;samplingPlan?:AqlPlan;inspectedQuantity:number;allowedRejectedQuantity:number;inspectionType:"normal"|"special"}>(plan:T,lotSize:number):T & {aqlCalculation?:AqlCalculation} {
 if(plan.method==="documentary"||plan.isFullInspection||plan.perShift)return plan;
 const result=calculateAql(lotSize,plan.inspectionLevel,plan.aql,plan.samplingPlan||"normal");
 return {...plan,samplingPlan:result.plan,aql:result.aql,inspectedQuantity:result.sampleSize,allowedRejectedQuantity:result.acceptanceNumber,inspectionType:result.plan==="normal"&&plan.inspectionLevel.startsWith("S")?"special":"normal",aqlCalculation:result};
}

export function aqlPlanDescription(plan:{samplingPlan?:AqlPlan;inspectionType:string;inspectionLevel:string;aql:string;aqlCalculation?:AqlCalculation}):string {
 if(!plan.aqlCalculation)return `${plan.inspectionType === "special" ? "Especial" : "Normal"} | Nivel ${plan.inspectionLevel} | AQL ${plan.aql}`;
 const c=plan.aqlCalculation;
 return `${plan.samplingPlan === "squeglia" ? "Squeglia C=0" : `Normal | Nivel ${plan.inspectionLevel} | Letra ${c.codeLetter}${c.preserveBaseSample?` | Muestra conservada: ${c.sampleSize} | Ac/Re de ${c.effectiveCodeLetter} (criterio interno)`:c.codeLetter!==c.effectiveCodeLetter?` -> ${c.effectiveCodeLetter}`:""}`} | AQL ${plan.aql} | Ac ${c.acceptanceNumber} / Re ${c.rejectionNumber}${c.inspectEntireLot?" | 100% del lote":""} | ${c.reference}`;
}
