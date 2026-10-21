import type { PdoDetails } from "./pdo";
function decode(text: string) { return text.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n))); }
function cellText(xml: string) { return [...xml.matchAll(/<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/g)].map(m => decode(m[1])).join("").replace(/\s+/g, " ").trim(); }
function normalized(text: string) { return text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]/g, ""); }
function dateValue(text: string) {
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
  const m = text.match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{2}|\d{4})$/);
  return m ? `${m[3].length === 2 ? "20" + m[3] : m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}` : "";
}
export function importPdoXml(xml: string, wiId: string) {
  const details: Partial<PdoDetails> = {}, warnings: string[] = [];
  const rows = [...xml.matchAll(/<w:tr(?:\s[^>]*)?>([\s\S]*?)<\/w:tr>/g)].map(m => [...m[1].matchAll(/<w:tc(?:\s[^>]*)?>([\s\S]*?)<\/w:tc>/g)].map(c => cellText(c[1])));
  const labels: Record<string, keyof PdoDetails | "totalUnits"> = { numerodeparte: "partNumber", nombredelproducto: "productName", numerodelote: "lotNumber", po: "customerPo", fechadeorden: "orderDate", fechaestimadadeentrega: "dueDate", fechadefinalizacion: "completionDate", cantidadrequerida: "totalUnits", cantidaddesalida: "outputQuantity" };
  let totalUnits = "", wiTable = false;
  for (const row of rows) {
    row.forEach((label, i) => {
      const field = labels[normalized(label)], value = row[i + 1] || "";
      if (!field || !value) return;
      if (field === "totalUnits") totalUnits = value.replace(/[,\s]/g, "");
      else if (field.endsWith("Date")) { details[field] = dateValue(value); if (!details[field]) warnings.push(`Revisa la fecha: ${value}.`); }
      else details[field] = value;
    });
    if (normalized(row[0] || "") === "wi" && row.some(c => /rev/i.test(c))) { wiTable = true; continue; }
    if (wiTable && row[0]?.match(/WI[.\s-]/i)) {
      const currentCode = wiId.match(/WI[.\s-]*\d{3}[.\s-]*\d+/i)?.[0];
      if (currentCode && normalized(row[0]).includes(normalized(currentCode))) { details.wiRevision = row[1] || ""; details.wiDescription = row[2] || ""; }
      else warnings.push(`El documento incluye ${row[0]}. Solo se importan los datos de la WI abierta.`);
    }
  }
  const all = rows.flat().join(" ");
  for (const label of ["Producción formal", "Producción Piloto", "Prototipos / R&D", "Retrabajo"]) {
    const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "\\s*");
    if (new RegExp(`(?:☒|☑|\\[x\\]|\\bx\\s)\\s*${escaped}`, "i").test(all)) details.orderType = label;
  }
  if (/(?:☒|☑|\[x\])\s*Subensambles/i.test(all)) details.outputType = "Subensambles";
  if (/(?:☒|☑|\[x\])\s*Dispositivo\s*terminado/i.test(all)) details.outputType = "Dispositivo terminado";
  if (!rows.some(row => row.some(c => normalized(c) === "cantidadrequerida"))) throw new Error("No se encontró la tabla del formato oficial de orden de producción.");
  return { details, totalUnits: /^\d+$/.test(totalUnits) ? totalUnits : "", warnings: [...warnings, "Revisa los datos importados y completa el número de PDO, las casillas y los campos faltantes antes de guardar."] };
}
