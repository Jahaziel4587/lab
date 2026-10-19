import QRCode from "qrcode";
import { PDFDocument, StandardFonts, type PDFFont } from "pdf-lib";
import { inventoryHref, type InventorySite } from "./sites";

type QrArticle = { id: string; code: string; name: string };
function printable(value: string, font: PDFFont) {
  return Array.from(value.replace(/\s+/g, " ").trim()).map(character => {
    try { font.encodeText(character); return character; } catch { return " "; }
  }).join("");
}
function nameLines(value: string, font: PDFFont, width: number) {
  const lines: string[] = []; let line = "";
  for (const character of printable(value, font)) {
    if (font.widthOfTextAtSize(line + character, 10) > width) { lines.push(line.trim()); line = ""; }
    line += character;
  }
  if (line.trim()) lines.push(line.trim());
  if (lines.length > 3) {
    lines.length = 3;
    while (font.widthOfTextAtSize(lines[2] + "...", 10) > width) lines[2] = lines[2].slice(0, -1);
    lines[2] += "...";
  }
  return lines;
}
export async function createMtsQrSheet(articles: QrArticle[], origin: string, site: InventorySite) {
  const pdf = await PDFDocument.create(), font = await pdf.embedFont(StandardFonts.Helvetica);
  const margin = 24, cellWidth = 282, cellHeight = 248, qrSize = 160;
  for (let index = 0; index < articles.length; index++) {
    const article = articles[index], slot = index % 6;
    const page = slot === 0 ? pdf.addPage([612, 792]) : pdf.getPages()[pdf.getPageCount() - 1];
    const left = margin + (slot % 2) * cellWidth, top = 792 - margin - Math.floor(slot / 2) * cellHeight;
    const image = await pdf.embedPng(await QRCode.toDataURL(`${origin}${inventoryHref(`/inventario/components/${article.id}`, site)}`, { width: 640, margin: 4, errorCorrectionLevel: "M" }));
    page.drawImage(image, { x: left + (cellWidth - qrSize) / 2, y: top - 170, width: qrSize, height: qrSize });
    const code = printable(`${article.code} - ${site}`, font);
    page.drawText(code, { x: left + (cellWidth - font.widthOfTextAtSize(code, 14)) / 2, y: top - 190, size: 14, font });
    nameLines(article.name, font, cellWidth - 24).forEach((line, row) => page.drawText(line, { x: left + (cellWidth - font.widthOfTextAtSize(line, 10)) / 2, y: top - 207 - row * 12, size: 10, font }));
  }
  return pdf.save();
}
