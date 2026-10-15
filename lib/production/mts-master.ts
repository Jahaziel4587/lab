import * as XLSX from "xlsx";
export type MtsMasterItem = { code: string; name: string };
const header = (value: unknown) => String(value ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
export function parseMtsMaster(buffer: Buffer): MtsMasterItem[] {
  const book = XLSX.read(buffer, { type: "buffer" }), items = new Map<string, MtsMasterItem>();
  let foundHeaders = false;
  for (const sheetName of book.SheetNames) {
    const sheet = book.Sheets[sheetName];
    if (!sheet["!ref"]) continue;
    const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: "", blankrows: false });
    const start = rows.findIndex(row => row.some(value => header(value) === "codigo") && row.some(value => header(value) === "nombre"));
    if (start < 0) continue;
    foundHeaders = true;
    const codeIndex = rows[start].findIndex(value => header(value) === "codigo"), nameIndex = rows[start].findIndex(value => header(value) === "nombre");
    for (const row of rows.slice(start + 1)) {
      const code = String(row[codeIndex] ?? "").toUpperCase().replace(/\s+/g, ""), name = String(row[nameIndex] ?? "").trim();
      if (!/^MTS-\d{3,}$/.test(code) || Number(code.slice(4)) <= 0) continue;
      if (!name || name.length > 300) throw new Error(`${code}: revisa el Nombre en la lista maestra de Box.`);
      const existing = items.get(code);
      if (existing && existing.name !== name) throw new Error(`${code}: aparece con nombres diferentes en la lista maestra de Box.`);
      items.set(code, { code, name });
    }
  }
  if (!foundHeaders) throw new Error("La lista maestra MTS debe incluir las columnas Código y Nombre.");
  if (!items.size) throw new Error("No se encontraron códigos MTS válidos en la lista maestra de Box.");
  return [...items.values()].sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true }));
}
