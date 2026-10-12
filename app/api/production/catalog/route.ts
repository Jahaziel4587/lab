import { NextRequest, NextResponse } from "next/server";
import { adminDB } from "@/lib/firebaseAdmin";
import { identify, projectCatalog } from "@/lib/operacional/server";
import { getDmrProjects, getMtsWorkInstructions } from "@/lib/box/boxCatalog";
import { inventorySite, inventoryCollections } from "@/lib/inventario/sites";
import { ensureArticle, normalizedCode } from "@/lib/production/catalog";
import { projectCodeFromDmr, legacyBomEntries, validateBomEntries } from "@/lib/production/bom";
import { parseComponentCode } from "@/lib/operacional/catalog";
import { createHash } from "node:crypto";
export const dynamic = "force-dynamic";
function bomId(projectId: string) { return createHash("sha256").update(projectId).digest("hex"); }
export async function GET(req: NextRequest) {
  const user = await identify(req);
  if (!user) return NextResponse.json({ error: "Inicia sesión." }, { status: 401 });
  try {
    const site = inventorySite(req.nextUrl.searchParams.get("site")), projectId = req.nextUrl.searchParams.get("projectId");
    if (projectId) {
      const project = (await getDmrProjects()).find(p=>p.id===projectId);
      if (!project) throw new Error("Proyecto DMR inválido.");
      const s = await adminDB.collection("production_boms").doc(bomId(projectId)).get(); const bom = s.data() || {items:[],version:0};
      return NextResponse.json({bom:{...bom,projectCode:projectCodeFromDmr(project.title) || bom.projectCode || "",entries:bom.entries || legacyBomEntries(bom.items)}});
    }
    if (req.nextUrl.searchParams.get("scope") === "projects") return NextResponse.json({ projects: await projectCatalog() });
    const wis = await getMtsWorkInstructions();
    const catalog = wis.map(w => ({ code: w.documentCode.match(/MTS-\d+/i)?.[0]?.toUpperCase(), name: w.itemName || w.title })).filter(w => w.code);
    const current = await adminDB.collection(inventoryCollections(site).components).get();
    const other = await adminDB.collection(inventoryCollections(site === "B1" ? "B2" : "B1").components).get();
    const all = [...current.docs, ...other.docs];
    for (const item of catalog) {
      const exists = current.docs.some(d => { try { return normalizedCode(d.data().code) === item.code; } catch { return false; } });
      const known = all.find(d => { try { return normalizedCode(d.data().code) === item.code && !!d.data().unit; } catch { return false; } });
      if (!exists && known) await ensureArticle(site, item.code!, known.data().name || item.name, known.data().unit, user.uid);
    }
    const cs = await adminDB.collection(inventoryCollections(site).components).get();
    return NextResponse.json({ catalog, components: cs.docs.map(d => ({ ...d.data(), id: d.id })), projects: await projectCatalog() });
  } catch(e) { return NextResponse.json({ error: e instanceof Error ? e.message : "Error de catálogo." }, { status: 400 }); }
}
export async function POST(req: NextRequest) {
  const user = await identify(req); if (!user) return NextResponse.json({ error: "Inicia sesión." }, { status: 401 });
  try {
    const b = await req.json(), site = inventorySite(b.site);
    if (b.action === "mts") {
      const wis = await getMtsWorkInstructions(), code = normalizedCode(String(b.code));
      const wi = wis.find(w => w.documentCode.match(/MTS-\d+/i)?.[0]?.toUpperCase() === code);
      if (!wi) throw new Error("El MTS no está en el catálogo de Box.");
      const c = await ensureArticle(site, code, wi.itemName || wi.title, String(b.unit || ""), user.uid);
      return NextResponse.json({ component: c });
    }
    if (b.action === "reserve") {
      const ref = adminDB.collection(inventoryCollections(site).components).doc(String(b.componentId));
      const projects = await projectCatalog();
      if (b.project && !projects.some(p => p.label === b.project)) throw new Error("Proyecto inválido.");
      await adminDB.runTransaction(async t => { const s = await t.get(ref); if (!s.exists || s.data()?.type !== "MTS") throw new Error("MTS inexistente."); const lots = s.data()!.lots; const lot = lots.find((l: {id:string}) => l.id === b.lotId); if (!lot) throw new Error("Lote inexistente."); lot.reservedProject = b.project || ""; t.update(ref, { lots }); });
      return NextResponse.json({ ok: true });
    }
    if (b.action !== "bom" || typeof b.projectId !== "string") throw new Error("Acción inválida.");
    const project = (await getDmrProjects()).find(p => p.id === b.projectId);
    if (!project) throw new Error("Proyecto DMR inválido.");
    const priorBom = (await adminDB.collection("production_boms").doc(bomId(b.projectId)).get()).data();
    const projectCode = projectCodeFromDmr(project.title) || priorBom?.projectCode || "";
    const opProject = (await projectCatalog()).find(p=>p.code===projectCode);
    if (!opProject) throw new Error("No se pudo identificar el número de proyecto desde el DMR.");
    const {entries,items} = validateBomEntries(b.entries || legacyBomEntries(b.items || []),projectCode);
    const ref = adminDB.collection("production_boms").doc(bomId(b.projectId));
    await adminDB.runTransaction(async t => {
      const cols = [adminDB.collection(inventoryCollections(site).components), adminDB.collection(inventoryCollections(site === "B1" ? "B2" : "B1").components)];
      const [old, current, other] = await Promise.all([t.get(ref), t.get(cols[0]), t.get(cols[1])]);
      if ((old.data()?.version || 0) !== b.version) throw new Error("El BOM cambió. Recarga antes de guardar.");
      const snapshots = [current, other];
      const saved = items.map((x: {code:string;name:string;unit:string;children:string[]}) => {
        const known = current.docs.find(d=> { try{return normalizedCode(d.data().code) === x.code;}catch{return false;} });
        const row = {...x, name: known?.data().name || x.name, unit: known?.data().unit || x.unit};
        for(let index=0;index<2;index++) {
          const exists = snapshots[index].docs.some(d=>{try{return normalizedCode(d.data().code)===x.code;}catch{return false;}});
          if(!exists) {
            const parsed=parseComponentCode(x.code), id=createHash("sha256").update(x.code).digest("hex");
            t.create(cols[index].doc(id), { id, site:index===0?site:(site==="B1"?"B2":"B1"), code:x.code, name:row.name, unit:row.unit, project:parsed.type==="MTS"?"":opProject.label, type:parsed.type, lots:[], createdAt:new Date().toISOString(), createdBy:user.uid });
          }
        }
        return row;
      });
      const savedEntries = entries.map(e=>{const i=saved.find(i=>i.code===e.code)!;return {...e,name:i.name,unit:i.unit};});
      t.set(ref, {projectId:b.projectId,projectCode,items:saved,entries:savedEntries,version:b.version+1,updatedBy:user.uid,updatedAt:new Date().toISOString()});
    });
    return NextResponse.json({ ok: true });
  } catch(e) { return NextResponse.json({ error: e instanceof Error ? e.message : "No se pudo guardar." }, { status: 400 }); }
}
