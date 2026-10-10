import PizZip from "pizzip";
import template from "./export-template.json";
import type { InventoryComponent } from "./types";
import type { InventorySite } from "./sites";
function xml(text: string) {
    return text.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}
function column(index: number) { return String.fromCharCode(65 + index); }
export function exportInventory(components: InventoryComponent[], site: InventorySite, at = new Date()) {
    const zip = new PizZip();
    for (const [path, content] of Object.entries(template.parts))
        zip.file(path, content);
    for (const sheet of template.sheets) {
        let content = template.parts[sheet.sheet as keyof typeof template.parts];
        const header = content.match(/<sheetData>(<row\b[^>]*r="1"[\s\S]*?<\/row>)/)?.[1];
        if (!header)
            throw new Error("Formato Excel inválido.");
        let rowNumber = 1;
        const rows: string[] = [];
        for (const c of [...components].sort((a, b) => a.code.localeCompare(b.code))) {
            for (const lot of [...c.lots].sort((a, b) => a.name.localeCompare(b.name))) {
                const quantity = lot.stock[sheet.id] || 0;
                if (quantity <= 0)
                    continue;
                rowNumber++;
                const fields: Record<string, string | number> = {
                    "Artículo": c.code, "Descripción": c.name, "Unidad de medida": c.unit,
                    "Cantidad": quantity, "Lote": lot.name, "Comentarios": lot.notes || "N/A",
                    "Proveedor": lot.supplier || "N/A", "Fecha de expiración(reanálisis)": lot.expiry || "N/A",
                    "Condición de temperatura (°C)": "N/A", "Condición de humedad (%HR)": "N/A",
                };
                const cells = sheet.headers.map((label, i) => {
                    const ref = `${column(i)}${rowNumber}`, style = sheet.styles[i] || "0";
                    const value = fields[label];
                    if (label === "Fecha de expiración(reanálisis)" && lot.expiry) {
                        const millis = Date.parse(`${lot.expiry}T00:00:00Z`);
                        if (Number.isFinite(millis))
                            return `<c r="${ref}" s="${style}" t="n"><v>${millis / 86400000 + 25569}</v></c>`;
                    }
                    if (typeof value === "number")
                        return `<c r="${ref}" s="${style}" t="n"><v>${value}</v></c>`;
                    return `<c r="${ref}" s="${style}" t="inlineStr"><is><t xml:space="preserve">${xml(String(value ?? ""))}</t></is></c>`;
                }).join("");
                const lines = Math.max(...sheet.headers.map((label, i) => String(fields[label] ?? "").split("\n").reduce((sum, line) => sum + Math.max(1, Math.ceil(line.length / Math.max(8, sheet.widths[i] - 3))), 0)));
                const height = Math.min(409, Math.max(30, lines * 15 + 6));
                rows.push(`<row r="${rowNumber}" ht="${height}" customHeight="1">${cells}</row>`);
            }
        }
        // Tables retain one empty data row when the warehouse has no positive balances.
        if (!rows.length)
            rows.push(`<row r="2"/>`);
        const last = Math.max(2, rowNumber), range = `A1:${column(sheet.headers.length - 1)}${last}`;
        content = content.replace(/<sheetData>[\s\S]*?<\/sheetData>/, `<sheetData>${header}${rows.join("")}</sheetData>`).replace(/<dimension ref="[^"]*"\s*\/>/, `<dimension ref="${range}"/>`);
        zip.file(sheet.sheet, content);
        const table = template.parts[sheet.table as keyof typeof template.parts].replace(/\bref="[^"]*"/g, `ref="${range}"`);
        zip.file(sheet.table, table);
    }
    zip.file("docProps/core.xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>Inventario Almacén ${site}</dc:title><dc:creator>Bioana</dc:creator><dcterms:created xsi:type="dcterms:W3CDTF">${at.toISOString()}</dcterms:created></cp:coreProperties>`);
    return { buffer: zip.generate({ type: "nodebuffer", compression: "DEFLATE" }), filename: `Almacenes-${site}-${new Intl.DateTimeFormat("en-CA", { timeZone: "America/Mexico_City", year: "numeric", month: "2-digit", day: "2-digit" }).format(at)}.xlsx` };
}
