import { PDFDocument, PDFFont, PDFImage, PDFPage, StandardFonts, rgb } from "pdf-lib";
import type { IncomingInspectionContext, IncomingInspectionLot, IncomingLotAnomalyMessage, IncomingLotReport } from "../types";

export type IncomingLotPdfMode = "summary" | "spec" | "anomalies" | "anomaly";

type Params = {
  mode: IncomingLotPdfMode;
  context: IncomingInspectionContext;
  lot: IncomingInspectionLot;
  reports: IncomingLotReport[];
  messagesByReport: Record<string, IncomingLotAnomalyMessage[]>;
  idToken: string;
  anomalyId?: string;
};

const WIDTH = 595.28;
const HEIGHT = 841.89;
const MX = 46;
const TOP = 50;
const BOTTOM = 48;
const CONTENT = WIDTH - MX * 2;
const GREEN = rgb(0.04, 0.38, 0.29);
const RED = rgb(0.67, 0.12, 0.12);
const DARK = rgb(0.08, 0.1, 0.1);
const GRAY = rgb(0.34, 0.37, 0.37);

function clean(value: unknown) {
  return String(value ?? "").replace(/[“”]/g, '"').replace(/[‘’]/g, "'").replace(/[–—]/g, "-").replace(/\t/g, " ").trim();
}
function safeName(value: string) {
  return value.replace(/[^a-zA-Z0-9áéíóúÁÉÍÓÚñÑ._-]/g, "_").replace(/_+/g, "_");
}
function time(value: unknown) {
  const item = value as { toDate?: () => Date; seconds?: number } | undefined;
  const date = typeof item?.toDate === "function" ? item.toDate() : typeof item?.seconds === "number" ? new Date(item.seconds * 1000) : new Date(String(value || ""));
  return Number.isNaN(date.getTime()) ? "Sin fecha" : new Intl.DateTimeFormat("es-MX", { dateStyle: "medium", timeStyle: "short" }).format(date);
}
function stamp(value: unknown) {
  const item = value as { toMillis?: () => number; seconds?: number } | undefined;
  if (typeof item?.toMillis === "function") return item.toMillis();
  if (typeof item?.seconds === "number") return item.seconds * 1000;
  const parsed = new Date(String(value || "")).getTime();
  return Number.isNaN(parsed) ? 0 : parsed;
}
function wrap(text: string, font: PDFFont, size: number, maxWidth: number) {
  const lines: string[] = [];
  clean(text).split(/\r?\n/).forEach((paragraph) => {
    const words = paragraph.split(/\s+/).filter(Boolean);
    if (!words.length) { lines.push(""); return; }
    let line = "";
    words.forEach((word) => {
      const candidate = line ? `${line} ${word}` : word;
      if (!line || font.widthOfTextAtSize(candidate, size) <= maxWidth) line = candidate;
      else { lines.push(line); line = word; }
    });
    if (line) lines.push(line);
  });
  return lines;
}
async function toJpeg(blob: Blob) {
  const url = URL.createObjectURL(blob);
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => { const element = new Image(); element.onload = () => resolve(element); element.onerror = reject; element.src = url; });
    const canvas = document.createElement("canvas");
    canvas.width = image.naturalWidth; canvas.height = image.naturalHeight;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("No fue posible convertir la fotografía.");
    context.fillStyle = "#fff"; context.fillRect(0, 0, canvas.width, canvas.height); context.drawImage(image, 0, 0);
    const result = await new Promise<Blob>((resolve, reject) => canvas.toBlob((value) => value ? resolve(value) : reject(new Error("No fue posible convertir la fotografía.")), "image/jpeg", 0.9));
    return new Uint8Array(await result.arrayBuffer());
  } finally { URL.revokeObjectURL(url); }
}
async function loadImage(pdf: PDFDocument, path: string, token: string): Promise<PDFImage> {
  const response = await fetch(`/api/inspections/incoming-lots/image?${new URLSearchParams({ path })}`, { headers: { Authorization: `Bearer ${token}` } });
  if (!response.ok) throw new Error("No fue posible descargar una fotografía.");
  const blob = await response.blob();
  const bytes = new Uint8Array(await blob.arrayBuffer());
  if (blob.type.toLowerCase().includes("png")) return pdf.embedPng(bytes);
  if (/jpe?g/i.test(blob.type)) return pdf.embedJpg(bytes);
  return pdf.embedJpg(await toJpeg(blob));
}
function download(bytes: Uint8Array, filename: string) {
  const buffer = new ArrayBuffer(bytes.byteLength); new Uint8Array(buffer).set(bytes);
  const url = URL.createObjectURL(new Blob([buffer], { type: "application/pdf" }));
  const link = document.createElement("a"); link.href = url; link.download = filename; document.body.appendChild(link); link.click(); link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function generateIncomingLotPdf({ mode, context, lot, reports, messagesByReport, idToken, anomalyId }: Params) {
  const spec = reports.filter((report) => report.kind === "spec_rejection").sort((a, b) => stamp(a.createdAt) - stamp(b.createdAt));
  const anomalies = reports.filter((report) => report.kind === "anomaly" && (mode !== "anomaly" || report.id === anomalyId)).sort((a, b) => stamp(a.createdAt) - stamp(b.createdAt));
  if (mode === "spec" && !spec.length) throw new Error("Este lote no tiene rechazos por SPEC.");
  if ((mode === "anomalies" || mode === "anomaly") && !anomalies.length) throw new Error("No hay anormalidades para incluir.");

  const pdf = await PDFDocument.create();
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  let page: PDFPage;
  let y = 0;
  const addPage = () => { page = pdf.addPage([WIDTH, HEIGHT]); y = HEIGHT - TOP; };
  const space = (height: number) => { if (y - height < BOTTOM) addPage(); };
  const text = (value: string, options: { size?: number; font?: PDFFont; color?: ReturnType<typeof rgb>; indent?: number; gap?: number } = {}) => {
    const size = options.size || 10.5; const font = options.font || regular; const indent = options.indent || 0; const lineHeight = size + 4;
    const lines = wrap(value, font, size, CONTENT - indent); space(Math.max(lineHeight, lines.length * lineHeight));
    lines.forEach((line, index) => { if (line) page.drawText(line, { x: MX + indent, y: y - index * lineHeight, size, font, color: options.color || DARK }); });
    y -= Math.max(lineHeight, lines.length * lineHeight) + (options.gap ?? 4);
  };
  const rule = () => { space(18); page.drawLine({ start: { x: MX, y }, end: { x: WIDTH - MX, y }, thickness: 0.7, color: rgb(0.84, 0.86, 0.86) }); y -= 18; };
  const section = (title: string, color = GREEN) => { space(34); text(title.toUpperCase(), { size: 14, font: bold, color, gap: 10 }); };
  const photos = async (report: IncomingLotReport) => {
    for (let index = 0; index < report.photos.length; index += 2) {
      const images = (await Promise.all(report.photos.slice(index, index + 2).map(async (photo) => { try { return await loadImage(pdf, photo.storagePath, idToken); } catch (error) { console.error(error); return null; } }))).filter((item): item is PDFImage => item !== null);
      if (!images.length) continue;
      const cell = (CONTENT - 12) / 2;
      const sizes = images.map((image) => { const scale = Math.min(cell / image.width, 175 / image.height, 1); return { width: image.width * scale, height: image.height * scale }; });
      const row = Math.max(...sizes.map((size) => size.height)); space(row + 15);
      images.forEach((image, imageIndex) => { const size = sizes[imageIndex]; const x = MX + imageIndex * (cell + 12) + (cell - size.width) / 2; page.drawImage(image, { x, y: y - size.height, width: size.width, height: size.height }); });
      y -= row + 15;
    }
  };
  const drawSpec = async () => {
    section("Rechazos por SPEC", RED);
    text(`Total acumulado en reportes: ${lot.reportedRejectedQuantity} | Cantidad única confirmada: ${lot.confirmedUniqueRejectedQuantity ?? "Sin confirmar"} | Límite permitido: ${lot.allowedRejectedQuantity}`, { font: bold });
    const clarifications = lot.rejectionClarifications || (typeof lot.confirmedUniqueRejectedQuantity === "number" ? [{ reportedQuantity: lot.lastReviewedReportedQuantity || lot.reportedRejectedQuantity, confirmedUniqueQuantity: lot.confirmedUniqueRejectedQuantity, allowedQuantity: lot.allowedRejectedQuantity, repeatedSamples: lot.confirmedUniqueRejectedQuantity < (lot.lastReviewedReportedQuantity || lot.reportedRejectedQuantity), createdByName: lot.failureConfirmedByName || lot.createdByName, createdAt: lot.failureNotificationSentAt }] : []);
    if (clarifications.length) {
      text("Historial de aclaraciones", { size: 11.5, font: bold, color: GREEN });
      clarifications.forEach((item, index) => text(`${index + 1}. La suma reportada era ${item.reportedQuantity}. Se confirmaron ${item.confirmedUniqueQuantity} piezas únicas frente a ${item.allowedQuantity} permitidas.${item.repeatedSamples ? " Se aclaró que había piezas repetidas entre los reportes." : " Se confirmó que correspondían a piezas diferentes."} ${item.createdByName} - ${time(item.createdAt)}`, { indent: 8, color: GRAY }));
      rule();
    }
    for (let index = 0; index < spec.length; index += 1) {
      const report = spec[index]; space(90); text(`SPEC ${index + 1}: ${report.title}`, { size: 12.5, font: bold, color: RED });
      text(report.mode === "quantity" ? `Cantidad reportada: ${report.quantity || 0} piezas` : `Número de muestra: ${report.sampleNumber}`, { font: bold });
      if (report.description) text(report.description, { color: GRAY });
      text(`Reportó: ${report.createdByName} | ${time(report.createdAt)}`, { size: 9, color: GRAY });
      await photos(report); if (index < spec.length - 1) rule();
    }
  };
  const drawAnomalies = async () => {
    section(mode === "anomaly" ? "Anormalidad" : "Anormalidades", rgb(0.68, 0.43, 0.04));
    for (let index = 0; index < anomalies.length; index += 1) {
      const report = anomalies[index]; const failed = report.decision === "fail"; space(100);
      text(`${index + 1}. ${report.title || "Pendiente de título"}`, { size: 13, font: bold, color: failed ? RED : GREEN });
      text(`Decisión: ${report.decision === "pass" ? "Pasó" : failed ? "No pasó" : "Pendiente"} | ${report.mode === "quantity" ? `Cantidad reportada: ${report.quantity || 0}` : `Muestra: ${report.sampleNumber}`}${typeof report.finalRejectedQuantity === "number" ? ` | Cantidad final rechazada: ${report.finalRejectedQuantity}` : ""}`, { font: bold, color: failed ? RED : DARK });
      if (report.description) text(report.description, { color: GRAY });
      text(`Reportó: ${report.createdByName} | ${time(report.createdAt)}${report.decidedByName ? ` | Decidió: ${report.decidedByName}` : ""}`, { size: 9, color: GRAY });
      await photos(report);
      const conversation = messagesByReport[report.id] || [];
      if (conversation.length) { text("Conversación", { size: 11, font: bold }); conversation.forEach((message) => text(`${message.createdByName} (${time(message.createdAt)}): ${message.text}`, { size: 9.5, indent: 8, color: message.type === "decision" && failed ? RED : GRAY })); }
      if (index < anomalies.length - 1) rule();
    }
  };

  addPage();
  const titles: Record<IncomingLotPdfMode, string> = { summary: "RESUMEN GENERAL DE INSPECCIÓN", spec: "REPORTE DE RECHAZOS POR SPEC", anomalies: "REPORTE DE ANORMALIDADES", anomaly: "REPORTE INDIVIDUAL DE ANORMALIDAD" };
  text(titles[mode], { size: 17, font: bold, color: GREEN, gap: 12 });
  text(lot.lotName, { size: 20, font: bold, gap: 8 });
  text(`Componente: ${context.componentTitle}`, { font: bold });
  text(`Cantidad inspeccionada: ${lot.inspectedQuantity} | Cantidad total del lote: ${lot.totalLotQuantity}`);
  text(`Inspección: ${lot.inspectionType === "special" ? "Especial" : "Normal"} | Nivel: ${lot.inspectionLevel} | AQL: ${lot.aql} | Rechazos permitidos: ${lot.allowedRejectedQuantity}`);
  text(`Estado: ${lot.status === "finalized" ? "Finalizado" : "En curso"} | Resultado: ${lot.inspectionResult === "will_fail" ? "No pasará" : lot.inspectionResult === "within_limit" ? "Dentro del límite" : "Pendiente"}`, { color: lot.inspectionResult === "will_fail" ? RED : GRAY });
  rule();
  if (mode === "summary" || mode === "spec") await drawSpec();
  if (mode === "summary" && spec.length && reports.some((report) => report.kind === "anomaly")) rule();
  if (mode === "summary" || mode === "anomalies" || mode === "anomaly") await drawAnomalies();

  const pages = pdf.getPages();
  pages.forEach((current, index) => current.drawText(`Página ${index + 1} de ${pages.length}`, { x: WIDTH - MX - 65, y: 24, size: 8.5, font: regular, color: GRAY }));
  const bytes = await pdf.save();
  const suffix = mode === "summary" ? "Resumen_general" : mode === "spec" ? "Rechazos_SPEC" : mode === "anomalies" ? "Anormalidades" : `Anormalidad_${anomalies[0]?.title || "individual"}`;
  download(bytes, `${safeName(suffix)}_${safeName(lot.lotName)}.pdf`);
}
