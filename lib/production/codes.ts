import { parseComponentCode } from "@/lib/operacional/catalog";
export function normalizedCode(v: string) { return parseComponentCode(v.replace(/\s+/g, "")).code; }

export function msopCodeForProject(value: string, projectCode: string) {
  try { const parsed = parseComponentCode(value); return parsed.type === "MTS" || parsed.projectCode === projectCode; }
  catch { return false; }
}

export function recipeMaterialAllowed(value: string, projectCode: string, msopCodes: ReadonlySet<string>) {
  try {
    const parsed = parseComponentCode(value);
    return parsed.type === "MTS" ? msopCodes.has(parsed.code) : !!projectCode && parsed.projectCode === projectCode;
  } catch { return false; }
}

export function recipeOutputAllowed(value: string, projectCode: string) {
  try {
    const parsed = parseComponentCode(value);
    return !!projectCode && parsed.projectCode === projectCode && ["100", "200"].includes(parsed.type);
  } catch { return false; }
}
