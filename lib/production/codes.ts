import { parseComponentCode } from "@/lib/operacional/catalog";
export function normalizedCode(v: string) { return parseComponentCode(v.replace(/\s+/g, "")).code; }

export function msopCodeForProject(value: string, projectCode: string) {
  try { const parsed = parseComponentCode(value); return parsed.type === "MTS" || parsed.projectCode === projectCode; }
  catch { return false; }
}
