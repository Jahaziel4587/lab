import { createHash } from "node:crypto";
export function productionRecipeKey(site: string, project: string, wi: string) {
  return createHash("sha256").update(JSON.stringify([site, project, wi])).digest("hex");
}
