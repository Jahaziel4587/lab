import PizZip from "pizzip";
import { PDFDocument, StandardFonts } from "pdf-lib";

const escapeXml = (text: string) => text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const colNumber = (letters: string) => [...letters].reduce((n, char) => n * 26 + char.charCodeAt(0) - 64, 0);
const attr = (tag: string, name: string) => new RegExp(`\\b${name}="([^"]*)"`).exec(tag)?.[1];
const setAttr = (tag: string, name: string, value: string) => new RegExp(`\\b${name}="[^"]*"`).test(tag) ? tag.replace(new RegExp(`\\b${name}="[^"]*"`), `${name}="${value}"`) : tag.replace(/\/?>(?=$)/, match => ` ${name}="${value}"${match}`);

/** Merged Excel cells cannot auto-fit; wrap explicitly and size rows before printing. */
export async function fitRejectionDescription(zip: PizZip, summary: string): Promise<string> {
  const shared = zip.file("xl/sharedStrings.xml")?.asText() || "";
  const strings = shared.match(/<si(?:\s[^>]*)?>[\s\S]*?<\/si>/g) || [];
  const index = strings.findIndex(item => item.includes("{rejectionSummary}"));
  if (index < 0) throw new Error("El formato no contiene la descripción de defectos.");
  const sheetName = Object.keys(zip.files).find(name => /^xl\/worksheets\/sheet\d+\.xml$/.test(name) && new RegExp(`<c\\b[^>]*\\bt="s"[^>]*>[\\s\\S]*?<v>${index}<\\/v>`).test(zip.file(name)!.asText()));
  if (!sheetName) throw new Error("No se encontró la celda de descripción del formato.");
  let sheet = zip.file(sheetName)!.asText();
  const cells = sheet.match(/<c\b[^>]*?\/>|<c\b[^>]*>[\s\S]*?<\/c>/g) || [];
  const cell = cells.find(cell => attr(cell.slice(0, cell.indexOf(">") + 1), "t") === "s" && new RegExp(`<v>${index}<\\/v>`).test(cell));
  if (!cell) throw new Error("No se encontró la celda de descripción.");
  const address = attr(cell, "r")!;
  const [, column, rowString] = /^([A-Z]+)(\d+)$/.exec(address)!;
  const row = Number(rowString);
  const merged = (sheet.match(/<mergeCell\b[^>]*\/>/g) || []).map(tag => attr(tag, "ref")!).find(ref => ref.startsWith(`${address}:`));
  const endColumn = merged ? /^([A-Z]+)/.exec(merged.split(":")[1])![1] : column;
  let width = 0;
  for (let c = colNumber(column); c <= colNumber(endColumn); c++) {
    const tag = (sheet.match(/<col\b[^>]*\/>/g) || []).find(tag => Number(attr(tag, "min")) <= c && Number(attr(tag, "max")) >= c);
    width += ((Number(tag ? attr(tag, "width") : 10) * 7) + 5) * 0.75;
  }
  let styles = zip.file("xl/styles.xml")!.asText();
  const block = /<cellXfs\b[^>]*>([\s\S]*?)<\/cellXfs>/.exec(styles)!;
  const formats = block[1].match(/<xf\b[^>]*?\/>|<xf\b[^>]*>[\s\S]*?<\/xf>/g)!;
  let format = formats[Number(attr(cell, "s") || 0)];
  const fonts = /<fonts\b[^>]*>([\s\S]*?)<\/fonts>/.exec(styles)![1].match(/<font\b[^>]*>[\s\S]*?<\/font>/g)!;
  const size = Number(/<sz\s+val="([^"]+)"/.exec(fonts[Number(attr(format, "fontId") || 0)])?.[1] || 11);
  const alignment = '<alignment horizontal="left" vertical="top" wrapText="1"/>';
  format = format.includes("<alignment") ? format.replace(/<alignment\b[^>]*\/>/, alignment) : format.endsWith("/>") ? format.slice(0, -2) + `>${alignment}</xf>` : format.replace("</xf>", `${alignment}</xf>`);
  const styleId = formats.length;
  styles = styles.replace(block[0], `<cellXfs count="${styleId + 1}">${block[1]}${format}</cellXfs>`);
  zip.file("xl/styles.xml", styles);
  const font = await (await PDFDocument.create()).embedFont(StandardFonts.Helvetica);
  const widths = new Map<string, number>();
  const charWidth = (char: string) => {
    if (!widths.has(char)) { try { widths.set(char, font.widthOfTextAtSize(char, size)); } catch { widths.set(char, size); } }
    return widths.get(char)!;
  };
  const lines: string[] = [];
  const availableWidth = Math.max(30, (width - 12) * 0.87);
  for (const paragraph of summary.replace(/\r\n?/g, "\n").split("\n")) {
    let line = "", used = 0;
    for (const char of paragraph) {
      const next = charWidth(char);
      if (line && used + next > availableWidth) {
        const space = line.lastIndexOf(" ");
        if (space > 0) { lines.push(line.slice(0, space)); line = line.slice(space + 1); used = [...line].reduce((sum, item) => sum + charWidth(item), 0); }
        else { lines.push(line); line = ""; used = 0; }
        if (line && used + next > availableWidth) { lines.push(line); line = ""; used = 0; }
      }
      line += char; used += next;
    }
    lines.push(line);
  }
  // Stay below Excel's 409.5-point maximum row height and let long descriptions span pages.
  const lineHeight = size * 1.4;
  const maxLines = Math.max(1, Math.floor((340 - 12) / lineHeight));
  const chunks: string[][] = [];
  for (let i = 0; i < lines.length; i += maxLines) chunks.push(lines.slice(i, i + maxLines));
  const extra = chunks.length - 1;
  const shiftRefs = (xml: string) => xml.replace(/\b(r|ref|sqref)="([^"]*)"/g, (_all, name, value: string) => `${name}="${value.replace(/(\$?[A-Z]+\$?)(\d+)/g, (_match, col, n) => `${col}${Number(n) > row ? Number(n) + extra : n}`)}"`);
  if (extra) {
    sheet = shiftRefs(sheet).replace(/(<row\b[^>]*\br=")(\d+)(")/g, (_all, start, n, end) => `${start}${Number(n) > row ? Number(n) + extra : n}${end}`);
  }
  const rowPattern = new RegExp(`<row\\b[^>]*\\br="${row}"[^>]*>[\\s\\S]*?<\\/row>`);
  const originalRow = rowPattern.exec(sheet)![0];
  let first = originalRow.replace(cell, setAttr(cell.slice(0, cell.indexOf(">") + 1), "s", String(styleId)) + cell.slice(cell.indexOf(">") + 1));
  const sizeRow = (xml: string, count: number) => xml.replace(/<row\b[^>]*>/, tag => setAttr(setAttr(tag, "ht", String(Math.max(24, Math.ceil(count * lineHeight + 12)))), "customHeight", "1"));
  first = sizeRow(first, chunks[0].length);
  const continuation = chunks.slice(1).map((chunk, i) => `<row r="${row + i + 1}" ht="${Math.ceil(chunk.length * lineHeight + 12)}" customHeight="1"><c r="${column}${row + i + 1}" s="${styleId}" t="inlineStr"><is><t xml:space="preserve">${escapeXml(chunk.join("\n"))}</t></is></c></row>`).join("");
  sheet = sheet.replace(originalRow, first + continuation);
  if (extra && merged) sheet = sheet.replace(/<mergeCells\b[^>]*>/, tag => setAttr(tag, "count", String(Number(attr(tag, "count")) + extra))).replace("</mergeCells>", chunks.slice(1).map((_, i) => `<mergeCell ref="${column}${row + i + 1}:${endColumn}${row + i + 1}"/>`).join("") + "</mergeCells>");
  sheet = sheet.replace(/<pageSetup\b[^>]*\/>/, tag => setAttr(setAttr(tag, "fitToWidth", "1"), "fitToHeight", "0"));
  sheet = sheet.replace(/<pageSetUpPr\b[^>]*\/>/, tag => setAttr(tag, "fitToPage", "1"));
  if (!sheet.includes("<pageSetUpPr")) sheet = sheet.replace("</sheetPr>", '<pageSetUpPr fitToPage="1"/></sheetPr>');
  const contentRows = (sheet.match(/<row\b[^>]*>[\s\S]*?<\/row>/g) || []).filter(xml => /<v>[^<]+<\/v>|<t(?:\s[^>]*)?>[^<]+<\/t>/.test(xml));
  const mergedLastRows = (sheet.match(/<mergeCell\b[^>]*\/>/g) || []).map(tag => Number(/(\d+)$/.exec(attr(tag, "ref") || "")?.[1] || 0));
  const lastRow = Math.max(row + extra, ...mergedLastRows, ...contentRows.map(xml => Number(attr(xml.slice(0, xml.indexOf(">") + 1), "r"))));
  let workbook = zip.file("xl/workbook.xml")!.asText();
  const sheetLabel = attr(/<sheet\b[^>]*\/>/.exec(workbook)![0], "name")!.replace(/'/g, "''");
  const area = `<definedName name="_xlnm.Print_Area" localSheetId="0">'${sheetLabel}'!$A$1:$L$${lastRow}</definedName>`;
  if (/<definedName\b[^>]*name="_xlnm.Print_Area"[^>]*localSheetId="0"/.test(workbook)) workbook = workbook.replace(/<definedName\b[^>]*name="_xlnm.Print_Area"[^>]*localSheetId="0"[^>]*>[\s\S]*?<\/definedName>/, area);
  else if (workbook.includes("</definedNames>")) workbook = workbook.replace("</definedNames>", `${area}</definedNames>`);
  else workbook = workbook.replace(/<calcPr\b/, `<definedNames>${area}</definedNames><calcPr`);
  zip.file("xl/workbook.xml", workbook);
  zip.file(sheetName, sheet);
  return chunks[0].join("\n");
}
