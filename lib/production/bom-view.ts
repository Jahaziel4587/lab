import type { BomEntry } from "./bom";
export function orderedBomRows(entries: BomEntry[]) {
  const rows: { entry: BomEntry; depth: number }[] = [], visited = new Set<string>();
  const ids = new Set(entries.map(e => e.id));
  const children = new Map<string, BomEntry[]>();
  for (const entry of entries) { const parent = ids.has(entry.parentId) ? entry.parentId : ""; children.set(parent, [...(children.get(parent) || []), entry]); }
  function visit(entry: BomEntry, depth: number) { if (visited.has(entry.id)) return; visited.add(entry.id); rows.push({ entry, depth }); for (const child of children.get(entry.id) || []) visit(child, depth + 1); }
  for (const root of children.get("") || []) visit(root, 0);
  // Keep malformed legacy rows visible rather than hiding them.
  for (const entry of entries) if (!visited.has(entry.id)) visit(entry, 0);
  return rows;
}
