import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminDB } from "@/lib/firebaseAdmin";
import { getDmrProjects, getProjectWorkInstructions } from "@/lib/box/boxCatalog";
import { inventorySite, inventoryCollections } from "@/lib/inventario/sites";
import { requiredQuantity, type RecipeLine, type RecipeOutput } from "@/lib/production/calculate";
import { projectCodeFromDmr } from "@/lib/production/bom";
import { recipeMaterialAllowed, recipeOutputAllowed } from "@/lib/production/codes";
import { createHash } from "node:crypto";
import { projectCatalog } from "@/lib/operacional/server";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
function text(v: unknown) { if (typeof v !== "string" || !v.trim() || v.length > 300) throw new Error("Completa la información requerida."); return v.trim(); }
async function identity(req: NextRequest) { try { const h = req.headers.get("authorization") || ""; return h.startsWith("Bearer ") ? await adminAuth.verifyIdToken(h.slice(7), true) : null; } catch { return null; } }
function key(site: string, project: string, wi: string) { return createHash("sha256").update(JSON.stringify([site, project, wi])).digest("hex"); }
function msopRef(projectId: string) { return adminDB.collection("production_msops").doc(createHash("sha256").update(projectId).digest("hex")); }
function msopCodes(data?: { items?: { code: string }[] }) { return (data?.items || []).map(item => item.code); }
export async function GET(req: NextRequest) {
  if (!await identity(req)) return NextResponse.json({ error: "Inicia sesión." }, { status: 401 });
  try {
    const site = inventorySite(req.nextUrl.searchParams.get("site")), projectId = text(req.nextUrl.searchParams.get("projectId")), wiId = text(req.nextUrl.searchParams.get("wiId"));
    const id = key(site, projectId, wiId);
    const [recipe, orders, msop] = await Promise.all([adminDB.collection("production_recipes").doc(id).get(), adminDB.collection("production_orders").where("recipeId", "==", id).get(), msopRef(projectId).get()]);
    const operations = orders.empty ? [] : await adminDB.getAll(...orders.docs.map(d => adminDB.collection(inventoryCollections(site).operations).doc(d.id)));
    return NextResponse.json({ recipe: recipe.data() || null, msopCodes: msopCodes(msop.data()), orders: orders.docs.map((d, i) => ({ ...d.data(), id: d.id, createdAt: String(d.data().createdAt), voucherIds: operations[i]?.data()?.voucherIds || [] })).sort((a, b) => b.createdAt.localeCompare(a.createdAt)) });
  } catch (e) { return NextResponse.json({ error: e instanceof Error ? e.message : "No se pudo cargar." }, { status: 400 }); }
}
export async function POST(req: NextRequest) {
  const user = await identity(req); if (!user) return NextResponse.json({ error: "Inicia sesión." }, { status: 401 });
  try {
    const b = await req.json(), site = inventorySite(b.site), projectId = text(b.projectId), wiId = text(b.wiId);
    const id = key(site, projectId, wiId), ref = adminDB.collection("production_recipes").doc(id);
    const projects = await getDmrProjects(), project = projects.find(p => p.id === projectId);
    if (!project) throw new Error("Proyecto no disponible en DMR.");
    const catalog = await getProjectWorkInstructions({ projectId, type: "process" }), wi = catalog.workInstructions.find(w => w.id === wiId);
    if (!wi) throw new Error("WI no disponible en el proyecto.");
    const prefix = projectCodeFromDmr(project.title);
    const projectName = (await projectCatalog()).find(p=>p.code===prefix)?.label || project.title;
    const allowedMts = new Set(msopCodes((await msopRef(projectId).get()).data()));
    const now = new Date().toISOString();
    if (b.action === "recipe") {
      if (!Array.isArray(b.lines) || !b.lines.length || b.lines.length > 50) throw new Error("Agrega de 1 a 50 materiales.");
      const lines: RecipeLine[] = b.lines.map((l: RecipeLine) => ({ componentId: text(l.componentId), perUnit: l.perUnit, extraPercent: l.extraPercent }));
      if (new Set(lines.map(l => l.componentId)).size !== lines.length) throw new Error("El material está repetido.");
      const cs = await adminDB.getAll(...lines.map(l => adminDB.collection(inventoryCollections(site).components).doc(l.componentId)));
      lines.forEach((l, i) => { if (!cs[i].exists) throw new Error("Material inexistente."); if (!recipeMaterialAllowed(cs[i].data()!.code, prefix, allowedMts)) throw new Error("Selecciona un artículo del proyecto o un MTS de su MSOP."); requiredQuantity(l.perUnit, 1, l.extraPercent, cs[i].data()!.unit); });
      let output: RecipeOutput | null = null;
      if (b.output != null) {
        const componentId = text(b.output.componentId), quantity = b.output.quantity;
        if (componentId.includes("/") || !Number.isSafeInteger(quantity) || quantity < 1 || quantity > 1e9) throw new Error("Indica una cantidad entera de salida válida.");
        if (lines.some(l => l.componentId === componentId)) throw new Error("La salida de una WI no puede ser uno de sus insumos.");
        const article = (await adminDB.collection(inventoryCollections(site).components).doc(componentId).get()).data();
        if (!article || !recipeOutputAllowed(article.code, prefix)) throw new Error("Selecciona un ensamble o subensamble del proyecto.");
        output = { componentId, quantity };
      }
      await adminDB.runTransaction(async t => { const old = await t.get(ref); if ((old.data()?.version || 0) !== b.version) throw new Error("La receta cambió. Recarga antes de guardar."); t.set(ref, { site, projectId, projectName, wiId, wiTitle: wi.title, lines, ...(b.output === undefined && old.data()?.output ? { output: old.data()!.output } : { output }), version: (old.data()?.version || 0) + 1, updatedAt: now, updatedBy: user.uid }); });
      return NextResponse.json({ ok: true });
    }
    throw new Error("Crea o abre una PDO y registra una solicitud parcial de material desde PDO y material.");
  } catch (e) { return NextResponse.json({ error: e instanceof Error ? e.message : "No se pudo guardar." }, { status: 400 }); }
}
