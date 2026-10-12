import { parseComponentCode } from "@/lib/operacional/catalog";
export function normalizedCode(v: string) { return parseComponentCode(v.replace(/\s+/g, "")).code; }
