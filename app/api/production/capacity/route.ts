import { NextRequest, NextResponse } from "next/server";
import { adminDB } from "@/lib/firebaseAdmin";
import { identify, projectCatalog } from "@/lib/operacional/server";
import { getDmrProjects, getProjectWorkInstructions } from "@/lib/box/boxCatalog";
import { inventorySite } from "@/lib/inventario/sites";
import { mexicoToday } from "@/lib/inventario/selection";
import type { InventoryComponent } from "@/lib/inventario/types";
import { projectCodeFromDmr } from "@/lib/production/bom";
import { chooseRecipe, recipeArticles, recipeByCode, recipeInventory, recipeRefs } from "@/lib/production/shared-recipes";
import { pdoUnits, type ProductionRequest } from "@/lib/production/pdo";
import { projectCapacity } from "@/lib/production/project-capacity";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  if (!await identify(req)) return NextResponse.json({ error: "Inicia sesión." }, { status: 401 });
  try {
    const q = req.nextUrl.searchParams, projectId = q.get("projectId");
    const excludedWis = new Set(q.getAll("excludeWi"));
    const excludedMaterials = new Set(q.getAll("excludeMaterial"));
    const site = inventorySite(q.get("site"));
    const target = q.has("target") ? pdoUnits(Number(q.get("target"))) : undefined;
    const project = projectId && (await getDmrProjects()).find(p => p.id === projectId);
    if (!project) throw new Error("Proyecto no disponible en DMR.");
    const [catalog, projects, orders, inventory] = await Promise.all([
      getProjectWorkInstructions({ projectId: project.id, type: "process" }),
      projectCatalog(),
      adminDB.collection("production_orders").where("site", "==", site).get(),
      recipeInventory(adminDB, site),
    ]);
    const refs = catalog.workInstructions.flatMap(wi => recipeRefs(adminDB, project.id, wi.id));
    const snapshots = refs.length ? await adminDB.getAll(...refs) : [];
    const local = recipeArticles(inventory, site), known = recipeArticles(inventory);
    const components: InventoryComponent[] = [...local.values()];
    function resolve(code: string) {
      const item = local.get(code);
      if (item) return item;
      const fallback = known.get(code);
      if (!fallback) return undefined;
      const virtual = { ...fallback, id: `unavailable:${code}`, lots: [] };
      if (!components.some(c => c.id === virtual.id)) components.push(virtual);
      return virtual;
    }
    const steps = catalog.workInstructions.map((wi, index) => {
      const recipe = recipeByCode(chooseRecipe(snapshots.slice(index * 3, index * 3 + 3)), inventory);
      const raw = recipe?.lines || [];
      const issues: string[] = [];
      const lines = raw.map(l => {
        const c = resolve(l.componentId), selectionCode = l.componentId;
        const excluded = excludedMaterials.has(JSON.stringify([wi.id, selectionCode]));
        if (!excluded && !c) issues.push(`${selectionCode}: el insumo ya no se encuentra en el catálogo. Revisa la receta.`);
        if (!excluded && c && l.unit && l.unit !== c.unit) issues.push(`${c.code}: la unidad de ${site} (${c.unit}) no coincide con la receta (${l.unit}).`);
        return { ...l, selectionCode, excluded, componentId: c?.id || selectionCode, code: c?.code || selectionCode, name: c?.name || "Artículo fuera del catálogo", unit: c?.unit || l.unit || "" };
      });
      const output = recipe?.output && { ...recipe.output, componentId: resolve(recipe.output.componentId)?.id || recipe.output.componentId };
      return { id: wi.id, title: wi.title, lines, excluded: excludedWis.has(wi.id), missing: !raw.length || !!issues.length, issues, output };
    });
    const projectName = projects.find(p => p.code === projectCodeFromDmr(project.title))?.label || project.title;
    const pending = orders.docs.filter(d => d.data().pdoId && d.data().status === "pending").map(d => ({ ...d.data(), id: d.id }) as ProductionRequest);
    return NextResponse.json(projectCapacity(steps, components, projectName, mexicoToday(), pending, target));
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "No se pudo calcular la capacidad." }, { status: 400 });
  }
}
