import { NextRequest, NextResponse } from "next/server";
import { adminDB } from "@/lib/firebaseAdmin";
import { identify, projectCatalog } from "@/lib/operacional/server";
import { getDmrProjects, getProjectWorkInstructions } from "@/lib/box/boxCatalog";
import { inventoryCollections, inventorySite } from "@/lib/inventario/sites";
import { mexicoToday } from "@/lib/inventario/selection";
import type { InventoryComponent } from "@/lib/inventario/types";
import { projectCodeFromDmr } from "@/lib/production/bom";
import { productionRecipeKey } from "@/lib/production/key";
import { pdoUnits, type ProductionRequest } from "@/lib/production/pdo";
import type { RecipeLine, RecipeOutput } from "@/lib/production/calculate";
import { projectCapacity } from "@/lib/production/project-capacity";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  if (!await identify(req)) return NextResponse.json({ error: "Inicia sesión." }, { status: 401 });
  try {
    const q = req.nextUrl.searchParams, projectId = q.get("projectId");
    const site = inventorySite(q.get("site"));
    const target = q.has("target") ? pdoUnits(Number(q.get("target"))) : undefined;
    const project = projectId && (await getDmrProjects()).find(p => p.id === projectId);
    if (!project) throw new Error("Proyecto no disponible en DMR.");
    const [catalog, projects, orders] = await Promise.all([
      getProjectWorkInstructions({ projectId: project.id, type: "process" }),
      projectCatalog(),
      adminDB.collection("production_orders").where("site", "==", site).get(),
    ]);
    const recipes = adminDB.collection("production_recipes");
    const snapshots = catalog.workInstructions.length ? await adminDB.getAll(...catalog.workInstructions.map(wi => recipes.doc(productionRecipeKey(site, project.id, wi.id)))) : [];
    const data = snapshots.map(d => d.data() as { lines: RecipeLine[]; output?: RecipeOutput | null } | undefined);
    const ids = [...new Set(data.flatMap(recipe => [...(recipe?.lines || []).map(l => l.componentId), ...(recipe?.output ? [recipe.output.componentId] : [])]))];
    const refs = adminDB.collection(inventoryCollections(site).components);
    const stock = ids.length ? await adminDB.getAll(...ids.map(id => refs.doc(id))) : [];
    const components = stock.filter(d => d.exists).map(d => ({ ...d.data(), id: d.id }) as InventoryComponent);
    const byId = new Map(components.map(c => [c.id, c]));
    const steps = catalog.workInstructions.map((wi, index) => {
      const recipe = data[index], raw = recipe?.lines || [];
      const lines = raw.flatMap(l => {
        const c = byId.get(l.componentId);
        return c ? [{ ...l, code: c.code, name: c.name, unit: c.unit }] : [];
      });
      return { id: wi.id, title: wi.title, lines, missing: !raw.length || raw.length !== lines.length, output: recipe?.output };
    });
    const projectName = projects.find(p => p.code === projectCodeFromDmr(project.title))?.label || project.title;
    const pending = orders.docs.filter(d => d.data().pdoId && d.data().status === "pending").map(d => ({ ...d.data(), id: d.id }) as ProductionRequest);
    return NextResponse.json(projectCapacity(steps, components, projectName, mexicoToday(), pending, target));
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "No se pudo calcular la capacidad." }, { status: 400 });
  }
}
