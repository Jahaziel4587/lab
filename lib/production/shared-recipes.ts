import { type Firestore } from "firebase-admin/firestore";
import { INVENTORY_SITES, inventoryCollections, type InventorySite } from "../inventario/sites";
import type { InventoryComponent } from "../inventario/types";
import { type RecipeLine, type RecipeOutput } from "./calculate";
import { normalizedCode } from "./codes";
import { productionRecipeKey } from "./key";

type Recipe = {
  site?: InventorySite; shared?: boolean; version: number; updatedAt?: string; projectName: string; wiTitle: string;
  lines: (RecipeLine & { unit?: string })[]; output?: RecipeOutput | null;
};
export type RecipeInventory = Record<InventorySite, InventoryComponent[]>;
export function recipeRefs(db: Firestore, projectId: string, wiId: string) {
  const recipes = db.collection("production_recipes");
  return (["shared", "B1", "B2"] as const).map(site => recipes.doc(productionRecipeKey(site, projectId, wiId)));
}
export function chooseRecipe(snapshots: { data(): unknown }[]) {
  const [shared, b1, b2] = snapshots.map(s => s.data() as Recipe | undefined);
  if (shared) return { ...shared, shared: true };
  if (b2 && (!b1 || (b2.updatedAt || "") > (b1.updatedAt || ""))) return { ...b2, site: "B2" as const };
  return b1 && { ...b1, site: "B1" as const };
}
export async function recipeInventory(db: Firestore, stockSite?: InventorySite): Promise<RecipeInventory> {
  const entries = await Promise.all(INVENTORY_SITES.map(async ({ id }) => {
    const collection = db.collection(inventoryCollections(id).components);
    const snapshot = await (id === stockSite ? collection : collection.select("code", "name", "unit")).get();
    return [id, snapshot.docs.map(d => ({ ...d.data(), id: d.id }) as InventoryComponent)] as const;
  }));
  return { B1: entries[0][1], B2: entries[1][1] };
}
export function articleCode(code: string) {
  try { return normalizedCode(code).replace(/^(\d{3})-/, "$1."); } catch { return ""; }
}
export function recipeArticles(inventory: RecipeInventory, site?: InventorySite) {
  const map = new Map<string, InventoryComponent>();
  for (const item of site ? inventory[site] : [...inventory.B1, ...inventory.B2]) {
    const code = articleCode(item.code);
    if (code && !map.has(code)) map.set(code, item);
  }
  return map;
}
export function recipeByCode(recipe: Recipe | undefined, inventory: RecipeInventory) {
  if (!recipe) return null;
  if (recipe.shared) return recipe;
  const source = new Map(inventory[recipe.site || "B1"].map(item => [item.id, item]));
  function convert(id: string) { return articleCode(source.get(id)?.code || "") || id; }
  return { ...recipe, lines: recipe.lines.map(l => {
    const item = source.get(l.componentId);
    return { ...l, componentId: convert(l.componentId), ...(item?.unit ? { unit: item.unit } : {}) };
  }), output: recipe.output ? { ...recipe.output, componentId: convert(recipe.output.componentId) } : null };
}
