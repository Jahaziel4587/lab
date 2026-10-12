import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminDB } from "@/lib/firebaseAdmin";
import { getDmrProjects, getProjectWorkInstructions } from "@/lib/box/boxCatalog";
import { inventorySite, inventoryCollections } from "@/lib/inventario/sites";
import { requiredQuantity, type RecipeLine } from "@/lib/production/calculate";
import type { InventoryComponent } from "@/lib/inventario/types";
import { createHash } from "node:crypto";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
function text(v: unknown) { if (typeof v !== "string" || !v.trim() || v.length > 300) throw new Error("Completa la información requerida."); return v.trim(); }
async function identity(req: NextRequest) { try { const h = req.headers.get("authorization") || ""; return h.startsWith("Bearer ") ? await adminAuth.verifyIdToken(h.slice(7), true) : null; } catch { return null; } }
function key(site: string, project: string, wi: string) { return createHash("sha256").update(JSON.stringify([site, project, wi])).digest("hex"); }
export async function GET(req: NextRequest) {
  if (!await identity(req)) return NextResponse.json({ error: "Inicia sesión." }, { status: 401 });
  try {
    const site = inventorySite(req.nextUrl.searchParams.get("site")), projectId = text(req.nextUrl.searchParams.get("projectId")), wiId = text(req.nextUrl.searchParams.get("wiId"));
    const id = key(site, projectId, wiId);
    const [recipe, orders] = await Promise.all([adminDB.collection("production_recipes").doc(id).get(), adminDB.collection("production_orders").where("recipeId", "==", id).get()]);
    const operations = orders.empty ? [] : await adminDB.getAll(...orders.docs.map(d => adminDB.collection(inventoryCollections(site).operations).doc(d.id)));
    return NextResponse.json({ recipe: recipe.data() || null, orders: orders.docs.map((d, i) => ({ ...d.data(), id: d.id, createdAt: String(d.data().createdAt), voucherIds: operations[i]?.data()?.voucherIds || [] })).sort((a, b) => b.createdAt.localeCompare(a.createdAt)) });
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
    const now = new Date().toISOString();
    if (b.action === "recipe") {
      if (!Array.isArray(b.lines) || !b.lines.length || b.lines.length > 50) throw new Error("Agrega de 1 a 50 materiales.");
      const lines: RecipeLine[] = b.lines.map((l: RecipeLine) => ({ componentId: text(l.componentId), perUnit: l.perUnit, extraPercent: l.extraPercent }));
      if (new Set(lines.map(l => l.componentId)).size !== lines.length) throw new Error("El material está repetido.");
      const cs = await adminDB.getAll(...lines.map(l => adminDB.collection(inventoryCollections(site).components).doc(l.componentId)));
      lines.forEach((l, i) => { if (!cs[i].exists) throw new Error("Material inexistente."); requiredQuantity(l.perUnit, 1, l.extraPercent, cs[i].data()!.unit); });
      await adminDB.runTransaction(async t => { const old = await t.get(ref); if ((old.data()?.version || 0) !== b.version) throw new Error("La receta cambió. Recarga antes de guardar."); t.set(ref, { site, projectId, projectName: project.title, wiId, wiTitle: wi.title, lines, version: (old.data()?.version || 0) + 1, updatedAt: now, updatedBy: user.uid }); });
      return NextResponse.json({ ok: true });
    }
    if (b.action !== "order") throw new Error("Acción inválida.");
    const pdo = text(b.pdo), operationId = text(b.operationId);
    if (!/^[a-zA-Z0-9-]{10,100}$/.test(operationId)) throw new Error("Operación inválida.");
    const orderRef = adminDB.collection("production_orders").doc(operationId);
    const result = await adminDB.runTransaction(async t => {
      const previous = await t.get(orderRef);
      if (previous.exists) { const d = previous.data()!; if (d.recipeId !== id || d.pdo !== pdo || d.units !== b.units || d.createdBy !== user.uid) throw new Error("Operación usada con otros datos."); return { ...d, id: previous.id }; }
      const recipe = (await t.get(ref)).data(); if (!recipe) throw new Error("Guarda primero la receta.");
      const rows = recipe.lines as RecipeLine[];
      const cs = await t.getAll(...rows.map(l => adminDB.collection(inventoryCollections(site).components).doc(l.componentId)));
      const lines = rows.map((l, i) => { if (!cs[i].exists) throw new Error("Un material ya no existe."); const c = cs[i].data() as InventoryComponent; return { ...l, code: c.code, name: c.name, unit: c.unit, ...requiredQuantity(l.perUnit, b.units, l.extraPercent, c.unit) }; });
      const order = { recipeId: id, site, projectId, projectName: project.title, wiId, wiTitle: wi.title, recipeVersion: recipe.version, pdo, units: b.units, lines, createdAt: now, createdBy: user.uid };
      t.create(orderRef, order); return { ...order, id: operationId };
    });
    return NextResponse.json({ order: result });
  } catch (e) { return NextResponse.json({ error: e instanceof Error ? e.message : "No se pudo guardar." }, { status: 400 }); }
}
