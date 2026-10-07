import { findingLabel } from "@/app/inspecciones/entrada-lotes/types";
import PizZip from "pizzip";
import sharp from "sharp";
import { adminStorage } from "@/lib/firebaseAdmin";
import type { IncomingLotReport } from "@/app/inspecciones/entrada-lotes/types";

export type ReportPhoto = { data: Buffer; width: number; height: number; caption: string };
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const relNS = "http://schemas.openxmlformats.org/package/2006/relationships";
const officeRel = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";
function append(zip: PizZip, file: string, closing: string, xml: string) {
  const original = zip.file(file)?.asText();
  if (!original?.includes(closing)) throw new Error(`No se encontró ${file} en el formato.`);
  zip.file(file, original.replace(closing, xml + closing));
}
function jpegType(zip: PizZip) {
  const xml = zip.file("[Content_Types].xml")!.asText();
  if (!/Extension="jpeg"/.test(xml)) append(zip, "[Content_Types].xml", "</Types>", '<Default Extension="jpeg" ContentType="image/jpeg"/>');
}

// Resolve references exclusively against the lot's stored reports; never fetch client URLs.
export async function loadReportPhotos(selection: unknown, reports: IncomingLotReport[]): Promise<ReportPhoto[]> {
  if (selection == null) return [];
  if (!Array.isArray(selection) || selection.length > 48) throw new Error("Selecciona como máximo 48 fotos por reporte.");
  const result: ReportPhoto[] = [];
  const seen = new Set<string>();
  for (const ref of selection) {
    if (!ref || typeof ref.reportId !== "string" || !Number.isInteger(ref.photoIndex)) throw new Error("Selección de fotos no válida.");
    const key = `${ref.reportId}:${ref.photoIndex}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const report = reports.find(r => r.id === ref.reportId);
    const photo = report?.photos?.[ref.photoIndex];
    if (!photo?.storagePath) throw new Error("Una foto seleccionada ya no está disponible. Actualiza el lote.");
    const file = adminStorage.bucket().file(photo.storagePath);
    const [metadata] = await file.getMetadata();
    if (Number(metadata.size) > 20 * 1024 * 1024) throw new Error("Una foto supera 20 MB. Selecciona una versión más pequeña.");
    const [source] = await file.download();
    const { data, info } = await sharp(source, { limitInputPixels: 40000000 }).rotate().resize({ width: 1200, height: 1200, fit: "inside", withoutEnlargement: true }).jpeg({ quality: 80 }).toBuffer({ resolveWithObject: true });
    result.push({ data, width: info.width, height: info.height, caption: `${findingLabel(report!.kind)}: ${report!.title} · Foto ${ref.photoIndex + 1}` });
  }
  return result;
}

export function addRejectionPhotoSheets(zip: PizZip, photos: ReportPhoto[], lotName: string) {
  if (!photos.length) return;
  jpegType(zip);
  const workbook = zip.file("xl/workbook.xml")!.asText();
  let sheetId = Math.max(...Array.from(workbook.matchAll(/sheetId="(\d+)"/g), m => Number(m[1]))) + 1;
  for (let start = 0; start < photos.length; start += 6, sheetId++) {
    const page = Math.floor(start / 6) + 1;
    const id = `officialPhotos${page}`;
    let anchors = "", relationships = "", rows = "";
    photos.slice(start, start + 6).forEach((photo, i) => {
      const col = (i % 2) * 5, row = Math.floor(i / 2) * 15 + 3;
      const scale = Math.min(300 / photo.width, 205 / photo.height);
      const cx = Math.round(photo.width * scale * 9525), cy = Math.round(photo.height * scale * 9525);
      const media = `official-rejection-${page}-${i}.jpeg`;
      zip.file(`xl/media/${media}`, photo.data);
      relationships += `<Relationship Id="rId${i + 1}" Type="${officeRel}/image" Target="../media/${media}"/>`;
      anchors += `<xdr:oneCellAnchor><xdr:from><xdr:col>${col}</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>${row}</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:from><xdr:ext cx="${cx}" cy="${cy}"/><xdr:pic><xdr:nvPicPr><xdr:cNvPr id="${i + 1}" name="Foto ${i + 1}"/><xdr:cNvPicPr/></xdr:nvPicPr><xdr:blipFill><a:blip r:embed="rId${i + 1}"/><a:stretch><a:fillRect/></a:stretch></xdr:blipFill><xdr:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></xdr:spPr></xdr:pic><xdr:clientData/></xdr:oneCellAnchor>`;
    });
    for (let r = 1; r <= 48; r++) {
      const cells: string[] = [];
      if (r === 1) cells.push(`<c r="A1" t="inlineStr"><is><t>${esc(`Evidencia fotográfica · Lote ${lotName} · ${page}`)}</t></is></c>`);
      photos.slice(start, start + 6).forEach((p,i) => { if (r === Math.floor(i / 2) * 15 + 18) cells.push(`<c r="${i % 2 ? "F" : "A"}${r}" t="inlineStr"><is><t>${esc(p.caption)}</t></is></c>`); });
      rows += `<row r="${r}" ht="14" customHeight="1">${cells.join("")}</row>`;
    }
    zip.file(`xl/worksheets/${id}.xml`, `<?xml version="1.0" encoding="UTF-8"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="${officeRel}"><sheetPr><pageSetUpPr fitToPage="1"/></sheetPr><dimension ref="A1:J48"/><sheetViews><sheetView workbookViewId="0"/></sheetViews><sheetFormatPr defaultRowHeight="14"/><cols><col min="1" max="10" width="9" customWidth="1"/></cols><sheetData>${rows}</sheetData><mergeCells count="7"><mergeCell ref="A1:J2"/>${[18,33,48].flatMap(r=>[`<mergeCell ref="A${r}:E${r}"/>`,`<mergeCell ref="F${r}:J${r}"/>`]).join("")}</mergeCells><printOptions horizontalCentered="1"/><pageMargins left="0.3" right="0.3" top="0.3" bottom="0.3" header="0.1" footer="0.1"/><pageSetup paperSize="1" orientation="portrait" fitToWidth="1" fitToHeight="1"/><drawing r:id="rId1"/></worksheet>`);
    zip.file(`xl/worksheets/_rels/${id}.xml.rels`, `<Relationships xmlns="${relNS}"><Relationship Id="rId1" Type="${officeRel}/drawing" Target="../drawings/${id}.xml"/></Relationships>`);
    zip.file(`xl/drawings/${id}.xml`, `<xdr:wsDr xmlns:xdr="http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="${officeRel}">${anchors}</xdr:wsDr>`);
    zip.file(`xl/drawings/_rels/${id}.xml.rels`, `<Relationships xmlns="${relNS}">${relationships}</Relationships>`);
    append(zip,"xl/workbook.xml","</sheets>",`<sheet name="Fotos ${page}" sheetId="${sheetId}" r:id="${id}"/>`);
    append(zip,"xl/_rels/workbook.xml.rels","</Relationships>",`<Relationship Id="${id}" Type="${officeRel}/worksheet" Target="worksheets/${id}.xml"/>`);
    append(zip,"[Content_Types].xml","</Types>",`<Override PartName="/xl/worksheets/${id}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/drawings/${id}.xml" ContentType="application/vnd.openxmlformats-officedocument.drawing+xml"/>`);
  }
}

export const PHOTO_MARKER = "OFFICIAL_REPORT_PHOTOS_PLACEHOLDER";
export function addNonconformancePhotos(zip: PizZip, photos: ReportPhoto[]) {
  let xml = zip.file("word/document.xml")!.asText();
  const markerParagraph = /<w:p(?:\s[^>]*)?>(?:(?!<\/w:p>)[\s\S])*?OFFICIAL_REPORT_PHOTOS_PLACEHOLDER(?:(?!<\/w:p>)[\s\S])*?<\/w:p>/;
  if (!markerParagraph.test(xml)) throw new Error("No se encontró el apartado de fotos en la descripción.");
  jpegType(zip);
  const existingIds = Array.from(xml.matchAll(/wp:docPr[^>]*\bid="(\d+)"/g), m=>Number(m[1]));
  const baseId = Math.max(0,...existingIds) + 1;
  const paragraphs = photos.map((photo,i)=> {
    const media = `official-nc-${i}.jpeg`, rid = `officialPhoto${i}`;
    zip.file(`word/media/${media}`,photo.data);
    append(zip,"word/_rels/document.xml.rels","</Relationships>",`<Relationship Id="${rid}" Type="${officeRel}/image" Target="media/${media}"/>`);
    const scale = Math.min(420/photo.width,260/photo.height);
    const cx = Math.round(photo.width*scale*9525),cy = Math.round(photo.height*scale*9525);
    return `<w:p><w:pPr><w:keepNext/></w:pPr><w:r><w:t>${esc(photo.caption)}</w:t></w:r></w:p><w:p><w:r><w:drawing><wp:inline xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" distT="0" distB="0" distL="0" distR="0"><wp:extent cx="${cx}" cy="${cy}"/><wp:docPr id="${baseId+i}" name="Foto ${i+1}"/><a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:nvPicPr><pic:cNvPr id="0" name="Foto"/><pic:cNvPicPr/></pic:nvPicPr><pic:blipFill><a:blip xmlns:r="${officeRel}" r:embed="${rid}"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill><pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r></w:p>`;
  }).join("");
  xml = xml.replace(markerParagraph,paragraphs || "<w:p/>");
  // Allow the description row to grow and flow across pages.
  xml = xml.replace(/<w:tr[ >][\s\S]*?<\/w:tr>/g,row=>row.includes("officialPhoto") ? row.replace(/<w:trHeight\b[^>]*\/>/g,"").replace(/<w:cantSplit\b[^>]*\/>/g,"") : row);
  zip.file("word/document.xml",xml);
}
