import { PDFDocument, PDFFont, PDFPage, StandardFonts, rgb } from "pdf-lib";
import type { IncomingInspectionContext, IncomingInspectionLot, IncomingInspectionMethod, IncomingLotReport } from "../types";

type BaseParams = {
  context: IncomingInspectionContext;
  lot: IncomingInspectionLot;
  reports: IncomingLotReport[];
  generatedBy: string;
};

type RejectionParams = BaseParams & {
  summary: string;
  disposition: "scrap" | "other";
  otherDisposition?: string;
  observations?: string;
};

const INK = rgb(0.08, 0.08, 0.08);
const RED = rgb(0.67, 0.08, 0.08);
const GREEN = rgb(0.04, 0.34, 0.25);
const LIGHT = rgb(0.94, 0.95, 0.94);

function clean(value: unknown) {
  return String(value ?? "").replace(/[“”]/g, '"').replace(/[‘’]/g, "'").replace(/[–—]/g, "-").trim();
}

function filename(value: string) {
  return value.replace(/[^a-zA-Z0-9áéíóúÁÉÍÓÚñÑ._-]/g, "_").replace(/_+/g, "_");
}

function dateText() {
  return new Intl.DateTimeFormat("es-MX", { dateStyle: "short" }).format(new Date());
}

function download(bytes: Uint8Array, name: string) {
  const buffer = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(buffer).set(bytes);
  const url = URL.createObjectURL(new Blob([buffer], { type: "application/pdf" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function wrap(value: string, font: PDFFont, size: number, width: number) {
  const lines: string[] = [];
  clean(value).split(/\r?\n/).forEach((paragraph) => {
    const words = paragraph.split(/\s+/).filter(Boolean);
    if (!words.length) return lines.push("");
    let line = "";
    words.forEach((word) => {
      const candidate = line ? `${line} ${word}` : word;
      if (!line || font.widthOfTextAtSize(candidate, size) <= width) line = candidate;
      else { lines.push(line); line = word; }
    });
    if (line) lines.push(line);
  });
  return lines;
}

function drawWrapped(page: PDFPage, value: string, x: number, y: number, width: number, font: PDFFont, size = 8.5, color = INK, maxLines = 6) {
  const lines = wrap(value, font, size, width).slice(0, maxLines);
  lines.forEach((line, index) => page.drawText(line, { x, y: y - index * (size + 2), size, font, color }));
}

function drawCell(page: PDFPage, x: number, y: number, width: number, height: number, label: string, value: string, regular: PDFFont, bold: PDFFont, options: { fill?: boolean; valueSize?: number } = {}) {
  page.drawRectangle({ x, y: y - height, width, height, borderWidth: 0.7, borderColor: rgb(0.55, 0.57, 0.56), color: options.fill ? LIGHT : undefined });
  page.drawText(label, { x: x + 5, y: y - 11, size: 6.8, font: bold, color: GREEN });
  drawWrapped(page, value || " ", x + 5, y - 23, width - 10, regular, options.valueSize || 8.5, INK, Math.max(1, Math.floor((height - 24) / 10)));
}

function drawCheck(page: PDFPage, x: number, y: number, label: string, checked: boolean, font: PDFFont) {
  page.drawRectangle({ x, y: y - 8, width: 8, height: 8, borderWidth: 0.8, borderColor: INK });
  if (checked) {
    page.drawLine({ start: { x: x + 1, y: y - 2 }, end: { x: x + 7, y: y - 7 }, thickness: 1.1, color: RED });
    page.drawLine({ start: { x: x + 7, y: y - 2 }, end: { x: x + 1, y: y - 7 }, thickness: 1.1, color: RED });
  }
  page.drawText(label, { x: x + 12, y: y - 7, size: 7.5, font, color: INK });
}

function partInfo(context: IncomingInspectionContext) {
  const fullCode = clean(context.wiCode || context.componentId);
  const title = clean(context.componentTitle || context.wiTitle);
  const match = fullCode.match(/(?:WI(?:\.00)?[.-])?([A-Z]+-?\d+(?:-\d+)?)/i);
  const partNumber = match?.[1] || fullCode.replace(/^WI\.00[.-]?/i, "") || "N/A";
  const name = title.replace(fullCode, "").replace(/^[-–—:\s]+/, "").trim() || title;
  return { partNumber, partName: name };
}

const methodLabel = (method?: IncomingInspectionMethod) => method === "documentary" ? "Documental" : method === "dimensional" ? "Dimensional" : method === "functional" ? "Funcional" : "Visual";

export function buildSuggestedRejectionSummary(reports: IncomingLotReport[]) {
  const names = Array.from(new Set(reports.filter((report) => report.kind === "spec_rejection" || (report.kind === "anomaly" && report.decision === "fail")).map((report) => report.title.trim()).filter(Boolean)));
  return names.length ? names.join(", ") : "Piezas rechazadas durante la inspección de entrada.";
}

export function buildNonconformanceDescription(lot: IncomingInspectionLot, reports: IncomingLotReport[]) {
  const failedMethods = lot.methodPlans.filter((plan) => lot.methodReviewState?.[plan.method]?.result === "will_fail");
  const detail = failedMethods.map((plan) => {
    const review = lot.methodReviewState?.[plan.method];
    return `${methodLabel(plan.method)}: ${review?.confirmedUniqueQuantity ?? 0} piezas rechazadas únicas frente a ${plan.allowedRejectedQuantity} permitidas (muestra de ${plan.inspectedQuantity}, AQL ${plan.aql}, inspección ${plan.inspectionType === "special" ? "especial" : "normal"}, nivel ${plan.inspectionLevel}).`;
  }).join(" ");
  const defects = buildSuggestedRejectionSummary(reports);
  return `Durante la inspección de entrada del lote ${lot.lotName} se excedió el criterio de aceptación en ${failedMethods.length || 1} método(s) de inspección. ${detail} Hallazgos registrados: ${defects}. El lote se determinó no conforme y quedó sujeto a la disposición indicada.`;
}

export async function generateOfficialRejectionPdf({ context, lot, generatedBy, summary, disposition, otherDisposition, observations }: RejectionParams) {
  if (!lot.finalRejectedPieces) throw new Error("El lote no tiene piezas rechazadas para este reporte.");
  const pdf = await PDFDocument.create();
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const page = pdf.addPage([792, 612]);
  const { partNumber, partName } = partInfo(context);
  const margin = 28;
  const width = 736;
  page.drawText("BIOANA", { x: margin, y: 568, size: 16, font: bold, color: GREEN });
  page.drawText("REPORTE DE RECHAZO", { x: 285, y: 568, size: 18, font: bold, color: RED });
  page.drawText("FRM.021.03A", { x: 674, y: 571, size: 8, font: bold, color: INK });
  page.drawText("ID del documento: ____________________", { x: 620, y: 557, size: 7, font: regular, color: INK });

  let y = 540;
  const third = width / 3;
  drawCell(page, margin, y, third, 42, "Emitido por", generatedBy, regular, bold, { fill: true });
  drawCell(page, margin + third, y, third, 42, "Fecha", dateText(), regular, bold, { fill: true });
  drawCell(page, margin + third * 2, y, third, 42, "PDO / PO #", lot.purchaseOrder, regular, bold, { fill: true });
  y -= 50;
  page.drawText("FUENTE DE RECHAZOS", { x: margin, y, size: 8, font: bold, color: GREEN });
  drawCheck(page, margin + 120, y + 2, "Inspección de entrada", true, regular);
  drawCheck(page, margin + 260, y + 2, "Producción", false, regular);
  drawCheck(page, margin + 345, y + 2, "Otra", false, regular);
  y -= 18;
  const widths = [82, 132, 96, 70, 72, 70, 214];
  const labels = ["No. de parte", "Nombre", "Lote", "Cantidad total", "Cantidad rechazada", "Cantidad aceptada", "Descripción general"];
  const values = [partNumber, partName, lot.lotName, String(lot.totalLotQuantity), String(lot.finalRejectedPieces), String(Math.max(0, lot.totalLotQuantity - lot.finalRejectedPieces)), summary];
  let x = margin;
  widths.forEach((cellWidth, index) => { drawCell(page, x, y, cellWidth, 92, labels[index], values[index], regular, bold, { valueSize: index === 6 ? 8 : 8.5 }); x += cellWidth; });
  y -= 102;
  page.drawRectangle({ x: margin, y: y - 48, width, height: 48, borderWidth: 0.7, borderColor: rgb(0.55, 0.57, 0.56) });
  page.drawText("DISPOSICIÓN", { x: margin + 5, y: y - 11, size: 7, font: bold, color: GREEN });
  drawCheck(page, margin + 105, y - 2, "SCRAP", disposition === "scrap", regular);
  drawCheck(page, margin + 190, y - 2, "OTRA", disposition === "other", regular);
  drawWrapped(page, disposition === "other" ? clean(otherDisposition) : "", margin + 250, y - 7, 475, regular, 8.5, INK, 3);
  y -= 58;
  drawCell(page, margin, y, width, 66, "Observaciones", observations || "", regular, bold);
  y -= 82;
  page.drawText("Firmas (llenado manual)", { x: margin, y, size: 8, font: bold, color: GREEN });
  ["Inspector / Emitido por", "Quality Manager", "Responsable de disposición"].forEach((label, index) => {
    const start = margin + index * 245;
    page.drawLine({ start: { x: start, y: y - 38 }, end: { x: start + 190, y: y - 38 }, thickness: 0.7, color: INK });
    page.drawText(label, { x: start, y: y - 49, size: 7, font: regular, color: INK });
  });
  download(await pdf.save(), `Reporte_rechazo_${filename(lot.lotName)}.pdf`);
}

export async function generateOfficialNonconformancePdf({ context, lot, reports, generatedBy, extraComment = "" }: BaseParams & { extraComment?: string }) {
  const details = lot.nonconformanceDetails;
  if (!details || lot.inspectionResult !== "will_fail") throw new Error("Este lote no requiere un reporte de no conformidad.");
  const pdf = await PDFDocument.create();
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const page = pdf.addPage([612, 792]);
  const { partNumber, partName } = partInfo(context);
  const margin = 34;
  const width = 544;
  page.drawText("BIOANA", { x: margin, y: 754, size: 14, font: bold, color: GREEN });
  page.drawText("REPORTE DE NO CONFORMIDAD", { x: 180, y: 754, size: 16, font: bold, color: RED });
  page.drawText("FRM.021.01D", { x: 501, y: 757, size: 7, font: bold, color: INK });
  page.drawText("ID: __________________", { x: 488, y: 746, size: 6.5, font: regular });
  let y = 728;
  drawCell(page, margin, y, width / 3, 38, "Emitido por", generatedBy, regular, bold, { fill: true });
  drawCell(page, margin + width / 3, y, width / 3, 38, "Fecha", dateText(), regular, bold, { fill: true });
  drawCell(page, margin + width * 2 / 3, y, width / 3, 38, "PDO / PO #", lot.purchaseOrder, regular, bold, { fill: true });
  y -= 45;
  drawCell(page, margin, y, 112, 42, "No. de parte", partNumber, regular, bold);
  drawCell(page, margin + 112, y, 210, 42, "Nombre", partName, regular, bold);
  drawCell(page, margin + 322, y, 122, 42, "Lote", lot.lotName, regular, bold);
  drawCell(page, margin + 444, y, 100, 42, "Cantidad", String(lot.totalLotQuantity), regular, bold);
  y -= 50;
  page.drawText("CATEGORÍA", { x: margin, y, size: 7, font: bold, color: GREEN });
  const categoryItems: Array<[string, string]> = [["labeling", "Etiquetado"], ["quality", "Calidad"], ["performance", "Desempeño"], ["safety", "Seguridad"], ["other", `Otra${details.categoryOtherText ? `: ${details.categoryOtherText}` : ""}`]];
  categoryItems.forEach(([key, label], index) => drawCheck(page, margin + index * 102, y - 3, label, details.category === key, regular));
  y -= 24;
  page.drawText("FUENTE", { x: margin, y, size: 7, font: bold, color: GREEN });
  drawCheck(page, margin + 58, y - 3, "Inspección de entrada", true, regular);
  drawCheck(page, margin + 190, y - 3, "Producción", false, regular);
  drawCheck(page, margin + 275, y - 3, "Después de la entrega", false, regular);
  y -= 22;
  drawCell(page, margin, y, width, 90, "Descripción de la no conformidad (generada con la información de la inspección)", buildNonconformanceDescription(lot, reports), regular, bold, { valueSize: 8 });
  y -= 98;
  drawCell(page, margin, y, width, 60, "Acciones inmediatas", details.immediateActions, regular, bold, { valueSize: 8 });
  y -= 68;
  drawCell(page, margin, y, width / 2, 46, "Severidad", details.riskSeverity, regular, bold);
  drawCell(page, margin + width / 2, y, width / 2, 46, "Ocurrencia", details.riskOccurrence, regular, bold);
  y -= 54;
  page.drawText("NIVEL DE RIESGO", { x: margin, y, size: 7, font: bold, color: GREEN });
  drawCheck(page, margin + 100, y - 3, "Alto", details.riskLevel === "high", regular);
  drawCheck(page, margin + 170, y - 3, "Medio", details.riskLevel === "medium", regular);
  drawCheck(page, margin + 250, y - 3, "Bajo", details.riskLevel === "low", regular);
  drawCheck(page, margin + 330, y - 3, "CAPA Sí", details.capaRequired, regular);
  drawCheck(page, margin + 415, y - 3, "CAPA No", !details.capaRequired, regular);
  y -= 24;
  page.drawText("DISPOSICIÓN", { x: margin, y, size: 7, font: bold, color: GREEN });
  const dispositionItems: Array<[string, string]> = [["rework", "Retrabajo"], ["return_supplier", "Devolver"], ["use_as_is", "Usar tal cual"], ["rnd", "I+D"], ["scrap", "Scrap"], ["other", "Otra"]];
  dispositionItems.forEach(([key, label], index) => drawCheck(page, margin + index * 86, y - 3, label, details.dispositions.includes(key as never), regular));
  y -= 24;
  drawCell(page, margin, y, width, 58, "Justificación de la disposición", `${details.dispositionJustification}${details.dispositionOtherText ? ` Otra disposición: ${details.dispositionOtherText}.` : ""}`, regular, bold, { valueSize: 8 });
  y -= 66;
  const refs = [`IIF: ${details.iifReference || "N/A"}`, `QCI: ${details.qciReference || "N/A"}`, `CAPA: ${details.capaReference || "N/A"}`, `SCAR: ${details.scarReference || "N/A"}`, `Recall: ${details.recallReference || "N/A"}`, `Otros: ${details.otherReferences || "N/A"}`];
  drawCell(page, margin, y, width, 48, "Referencias relacionadas", refs.join(" | "), regular, bold, { valueSize: 7.5 });
  y -= 56;
  drawCell(page, margin, y, width, 46, "Comentarios adicionales", [details.correctiveActions, details.additionalComments, extraComment].filter(Boolean).join(" "), regular, bold, { valueSize: 8 });
  y -= 62;
  page.drawText("Firmas y aprobación (llenado manual)", { x: margin, y, size: 7.5, font: bold, color: GREEN });
  ["Emitido por", "Quality Manager", "Aprobación / disposición"].forEach((label, index) => {
    const start = margin + index * 180;
    page.drawLine({ start: { x: start, y: y - 30 }, end: { x: start + 145, y: y - 30 }, thickness: 0.7, color: INK });
    page.drawText(label, { x: start, y: y - 41, size: 6.8, font: regular });
  });
  download(await pdf.save(), `No_conformidad_${filename(lot.lotName)}.pdf`);
}
