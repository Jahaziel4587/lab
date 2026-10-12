import { NextRequest, NextResponse } from "next/server";
import { adminDB } from "@/lib/firebaseAdmin";
import { identify, projectCatalog } from "@/lib/operacional/server";
import { getDmrProjects, getMtsWorkInstructions } from "@/lib/box/boxCatalog";
import { inventorySite, inventoryCollections } from "@/lib/inventario/sites";
import { ensureArticle, normalizedCode } from "@/lib/production/catalog";
import { parseComponentCode } from "@/lib/operacional/catalog";
import { createHash } from "node:crypto";
export const dynamic = "force-dynamic";
function bomId(projectId: string) { return createHash("sha256").update(projectId).digest("hex"); }
export async function GET(req: NextRequest) {
  const user = await identify(req);
  if (!user) return NextResponse.json({ error: "Inicia sesión." }, { status: 401 });
  try {
    const site = inventorySite(req.nextUrl.searchParams.get("site")), projectId = req.nextUrl.searchParams.get("projectId");
    if (projectId) { const s = await adminDB.collection("production_boms").doc(bomId(projectId)).get(); return NextResponse.json({ bom: s.data() || { items: [], version: 0 } }); }
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
    const projectCode = String(b.projectCode || "");
    const opProject = (await projectCatalog()).find(p => p.code === projectCode);
    if (!opProject) throw new Error("Selecciona el número de proyecto en Operacional.");
    if (!Array.isArray(b.items) || b.items.length > 200) throw new Error("BOM inválido (máximo 200 artículos).");
    const items = b.items.map((x: {code:string;name:string;unit:string;children:string[]}) => ({ code: normalizedCode(x.code), name: String(x.name || "").trim(), unit: String(x.unit || "").trim(), children: Array.isArray(x.children) ? [...new Set(x.children.map(normalizedCode))] : [] }));
    if (new Set(items.map((x: {code:string}) => x.code)).size !== items.length) throw new Error("Hay códigos repetidos.");
    for (const x of items) {
      if (!x.name || x.name.length > 300 || !x.unit || x.unit.length > 40) throw new Error("Completa nombre y unidad en todos los artículos.");
      if (!x.code.startsWith(projectCode + ".") && !x.code.startsWith("MTS-")) throw new Error("El artículo no corresponde al proyecto.");
      if (x.children.some((c: string) => !items.some((i: {code:string}) => i.code === c))) throw new Error("Agrega todos los materiales del ensamble al BOM.");
      if (x.children.length && !/\.([12])\d{2}/.test(x.code)) throw new Error("Solo ensambles y subensambles llevan materiales.");
    }
    function visit(code: string, path: string[]) { if (path.includes(code)) throw new Error("El BOM tiene referencias circulares."); const x = items.find((i: {code:string}) => i.code === code); x?.children.forEach((c: string) => visit(c, [...path, code])); }
    items.forEach((x: {code:string}) => visit(x.code, []));
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
      t.set(ref, {projectId:b.projectId,projectCode,items:saved,version:b.version+1,updatedBy:user.uid,updatedAt:new Date().toISOString()});
    });
    return NextResponse.json({ ok: true });
  } catch(e) { return NextResponse.json({ error: e instanceof Error ? e.message : "No se pudo guardar." }, { status: 400 }); }
}
