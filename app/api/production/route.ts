import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminDB } from "@/lib/firebaseAdmin";
import { getDmrProjects, getProjectWorkInstructions } from "@/lib/box/boxCatalog";
import { requiredQuantity, type RecipeLine, type RecipeOutput } from "@/lib/production/calculate";
import { projectCodeFromDmr } from "@/lib/production/bom";
import { recipeMaterialAllowed, recipeOutputAllowed } from "@/lib/production/codes";
import { createHash } from "node:crypto";
import { projectCatalog } from "@/lib/operacional/server";
import { articleCode, chooseRecipe, recipeArticles, recipeByCode, recipeInventory, recipeRefs } from "@/lib/production/shared-recipes";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
function text(v: unknown) { if (typeof v !== "string" || !v.trim() || v.length > 300) throw new Error("Completa la información requerida."); return v.trim(); }
async function identity(req: NextRequest) { try { const h = req.headers.get("authorization") || ""; return h.startsWith("Bearer ") ? await adminAuth.verifyIdToken(h.slice(7), true) : null; } catch { return null; } }
function msopRef(projectId: string) { return adminDB.collection("production_msops").doc(createHash("sha256").update(projectId).digest("hex")); }
function msopCodes(data?: { items?: { code: string }[] }) { return (data?.items || []).map(item => item.code); }
export async function GET(req: NextRequest) {
  if (!await identity(req)) return NextResponse.json({ error: "Inicia sesión." }, { status: 401 });
  try {
    const projectId = text(req.nextUrl.searchParams.get("projectId")), wiId = text(req.nextUrl.searchParams.get("wiId"));
    const [snapshots, inventory, msop] = await Promise.all([adminDB.getAll(...recipeRefs(adminDB, projectId, wiId)), recipeInventory(adminDB), msopRef(projectId).get()]);
    return NextResponse.json({
      recipe: recipeByCode(chooseRecipe(snapshots), inventory), msopCodes: msopCodes(msop.data()),
      articles: [...recipeArticles(inventory)].map(([id, item]) => ({ id, code: item.code, name: item.name, unit: item.unit, lots: [] })),
    });
  } catch (e) { return NextResponse.json({ error: e instanceof Error ? e.message : "No se pudo cargar." }, { status: 400 }); }
}
export async function POST(req: NextRequest) {
  const user = await identity(req); if (!user) return NextResponse.json({ error: "Inicia sesión." }, { status: 401 });
  try {
    const b = await req.json(), projectId = text(b.projectId), wiId = text(b.wiId);
    const refs = recipeRefs(adminDB, projectId, wiId);
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
      const inventory = await recipeInventory(adminDB), articles = recipeArticles(inventory);
      const b1 = recipeArticles(inventory, "B1"), b2 = recipeArticles(inventory, "B2");
      // Older clients sent a warehouse document ID; the editor now sends the article code.
      const legacy = new Map((b.site === "B2" ? inventory.B2 : inventory.B1).map(item => [item.id, item.code]));
      const codeFor = (value: unknown) => { const id = text(value); return articleCode(legacy.get(id) || id); };
      const lines = b.lines.map((l: RecipeLine) => {
        const componentId = codeFor(l.componentId), item = articles.get(componentId);
        if (!item || !recipeMaterialAllowed(item.code, prefix, allowedMts)) throw new Error("Selecciona un artículo del proyecto o un MTS de su MSOP.");
        if (b1.has(componentId) && b2.has(componentId) && b1.get(componentId)!.unit !== b2.get(componentId)!.unit) throw new Error(`${item.code}: B1 y B2 tienen unidades distintas. Unifícalas en Inventario antes de guardar la receta.`);
        requiredQuantity(l.perUnit, 1, l.extraPercent, item.unit);
        return { componentId, perUnit: l.perUnit, extraPercent: l.extraPercent, unit: item.unit };
      }) as (RecipeLine & { unit: string })[];
      if (new Set(lines.map(l => l.componentId)).size !== lines.length) throw new Error("El material está repetido.");
      let output: RecipeOutput | null = null;
      if (b.output != null) {
        const componentId = codeFor(b.output.componentId), quantity = b.output.quantity;
        if (!Number.isSafeInteger(quantity) || quantity < 1 || quantity > 1e9) throw new Error("Indica una cantidad entera de salida válida.");
        const item = articles.get(componentId);
        if (!item || !recipeOutputAllowed(item.code, prefix)) throw new Error("Selecciona un ensamble o subensamble del proyecto.");
        output = { componentId, quantity };
      }
      await adminDB.runTransaction(async t => {
        const old = recipeByCode(chooseRecipe(await Promise.all(refs.map(ref => t.get(ref)))), inventory);
        if ((old?.version || 0) !== b.version) throw new Error("La receta cambió. Recarga antes de guardar.");
        const nextOutput = b.output === undefined ? old?.output || null : output;
        if (nextOutput && lines.some(l => l.componentId === nextOutput.componentId)) throw new Error("La salida de una WI no puede ser uno de sus insumos.");
        t.set(refs[0], { shared: true, projectId, projectName, wiId, wiTitle: wi.title, lines, output: nextOutput, version: (old?.version || 0) + 1, updatedAt: now, updatedBy: user.uid });
      });
      return NextResponse.json({ ok: true });
    }
    throw new Error("Crea o abre una PDO y registra una solicitud parcial de material desde PDO y material.");
  } catch (e) { return NextResponse.json({ error: e instanceof Error ? e.message : "No se pudo guardar." }, { status: 400 }); }
}
