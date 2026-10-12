import type { InventoryComponent } from "@/lib/inventario/types";
import { createHash } from "node:crypto";
import { adminDB } from "@/lib/firebaseAdmin";
import { parseComponentCode } from "@/lib/operacional/catalog";
import { projectCatalog } from "@/lib/operacional/server";
import { inventoryCollections, type InventorySite } from "@/lib/inventario/sites";
import { normalizedCode } from "./codes";
export { normalizedCode };
export async function ensureArticle(site: InventorySite, raw: string, name: string, unit: string, uid: string) {
  const code = normalizedCode(raw), parsed = parseComponentCode(code);
  if (!name.trim() || name.length > 300 || !unit.trim() || unit.length > 40) throw new Error("Completa nombre y unidad de medida.");
  const project = (await projectCatalog()).find(p => p.code === parsed.projectCode)?.label || "";
  const collection = adminDB.collection(inventoryCollections(site).components);
  return adminDB.runTransaction(async t => {
    const all = await t.get(collection);
    const existing = all.docs.find(d => { try { return normalizedCode(d.data().code) === code; } catch { return false; } });
    if (existing) return { ...existing.data(), id: existing.id } as InventoryComponent;
    const id = createHash("sha256").update(code).digest("hex");
    const article = { id, site, code, name: name.trim(), unit: unit.trim(), project, type: parsed.type as InventoryComponent["type"], lots: [], createdAt: new Date().toISOString(), createdBy: uid };
    t.create(collection.doc(id), article); return article;
  });
}
