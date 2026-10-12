import { normalizedCode } from "./codes";
export type BomEntry = { id: string; parentId: string; code: string; name: string; unit: string; level: number; description: string; spanishName: string; clientCode: string; supplier: string; spec: string };
export type BomItem = { code: string; name: string; unit: string; children: string[] };
export function projectCodeFromDmr(title: string) {
  return title.match(/^\s*(?:DMR[.\s_-]*)?(\d{3})(?=[.\s_-]|$)/i)?.[1] || "";
}
export function legacyBomEntries(items: BomItem[]): BomEntry[] {
  const out: BomEntry[] = [];
  const childCodes = new Set(items.flatMap(i => i.children));
  function add(item: BomItem, parentId: string, path: string[]) {
    if (path.includes(item.code)) return;
    const id = `legacy-${out.length}`;
    out.push({ id, parentId, code: item.code, name: item.name, unit: item.unit, level: /^MTS-|\.4\d{2}/.test(item.code) ? 4 : /\.3\d{2}/.test(item.code) ? 3 : parentId ? 2 : 1, description: "", spanishName: "", clientCode: "", supplier: "", spec: "" });
    for (const code of item.children) { const child = items.find(i => i.code === code); if (child) add(child, id, [...path, item.code]); }
  }
  items.filter(i => !childCodes.has(i.code)).forEach(i => add(i, "", []));
  items.filter(i => !out.some(e => e.code === i.code)).forEach(i => add(i, "", []));
  return out;
}
export function validateBomEntries(raw: unknown, projectCode: string): { entries: BomEntry[]; items: BomItem[] } {
  if (!Array.isArray(raw) || raw.length > 200) throw new Error("Agrega hasta 200 renglones al BOM.");
  const entries: BomEntry[] = raw.map(x => {
    const code = normalizedCode(String(x.code || ""));
    if (!code.startsWith(projectCode + ".") && !code.startsWith("MTS-")) throw new Error(`${code}: no corresponde al proyecto ${projectCode}.`);
    const row: BomEntry = { id: String(x.id || ""), parentId: String(x.parentId || ""), code, name: String(x.name || "").trim(), unit: String(x.unit || "").trim(), level: Number(x.level), description: String(x.description || "").trim(), spanishName: String(x.spanishName || "").trim(), clientCode: String(x.clientCode || "").trim(), supplier: String(x.supplier || "").trim(), spec: String(x.spec || "").trim() };
    if (!/^[a-zA-Z0-9-]{1,100}$/.test(row.id) || !row.name || row.name.length > 300 || !row.unit || row.unit.length > 40 || ![1,2,3,4].includes(row.level) || [row.description,row.spanishName,row.clientCode,row.supplier,row.spec].some(v => v.length > 300)) throw new Error(`${code}: completa nombre, unidad y nivel BOM válidos.`);
    return row;
  });
  const ids = new Map(entries.map(e => [e.id,e]));
  if (ids.size !== entries.length) throw new Error("Renglones duplicados.");
  const byCode = new Map<string,BomItem>();
  for (const e of entries) {
    const prior = byCode.get(e.code);
    if (prior && (prior.name !== e.name || prior.unit !== e.unit)) throw new Error(`${e.code}: usa el mismo nombre y unidad en todos sus renglones.`);
    byCode.set(e.code, prior || { code:e.code,name:e.name,unit:e.unit,children:[] });
    const path = new Set<string>(); let current: BomEntry | undefined = e;
    while (current) { if (path.has(current.id)) throw new Error("El BOM tiene relaciones circulares."); path.add(current.id); if (!current.parentId) break; const parent = ids.get(current.parentId); if (!parent || !/\.[12]\d{2}/.test(parent.code)) throw new Error(`${current.code}: selecciona un ensamble o subensamble válido.`); if (parent.code === e.code) throw new Error("Un artículo no puede contenerse a sí mismo."); current = parent; }
  }
  for (const e of entries) if (e.parentId) { const p = byCode.get(ids.get(e.parentId)!.code)!; if (!p.children.includes(e.code)) p.children.push(e.code); }
  // The shared article graph must also remain acyclic across repeated occurrences.
  const done = new Set<string>();
  function visit(code: string, path: Set<string>) { if(path.has(code)) throw new Error("El BOM tiene referencias circulares entre artículos."); if(done.has(code)) return; const next=new Set(path);next.add(code);byCode.get(code)!.children.forEach(c=>visit(c,next));done.add(code); }
  byCode.forEach((_,code)=>visit(code,new Set()));
  return {entries,items:[...byCode.values()]};
}
