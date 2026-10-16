import { formatQmsDate } from "@/lib/inspections/qmsDate";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import fs from "fs/promises";
import path from "path";
import Docxtemplater from "docxtemplater";
import PizZip from "pizzip";
import { NextRequest, NextResponse } from "next/server";

import {
  buildNonconformanceDescription,
  extractIncomingPartInfo,
} from "@/app/inspecciones/entrada-lotes/qmsReportData";
import { mapIncomingLot } from "@/app/inspecciones/entrada-lotes/utils";
import type {
  IncomingInspectionContext,
  IncomingLotReport,
  IncomingNonconformanceDetails,
} from "@/app/inspecciones/entrada-lotes/types";
import { adminAuth, adminDB } from "@/lib/firebaseAdmin";
import { getDisplayNameForUid } from "@/lib/pushNotifications";

import { loadReportPhotos, addNonconformancePhotos, PHOTO_MARKER } from "@/lib/inspections/officialReportPhotos";

function clean(value: unknown) {
  return String(value ?? "").trim();
}

function safeFileName(value: string) {
  return value.replace(/[^a-zA-Z0-9áéíóúÁÉÍÓÚñÑ._-]/g, "_").replace(/_+/g, "_");
}

function generatedDate() {
  return formatQmsDate(new Date());
}

function cellText(xml: string) {
  return Array.from(xml.matchAll(/<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/g))
    .map((match) => match[1])
    .join(" ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

function setCheckboxDefault(cellXml: string, checked: boolean) {
  return cellXml.replace(
    /(<w:checkBox>[\s\S]*?<w:default\s+w:val=")[01]("\s*\/>[\s\S]*?<\/w:checkBox>)/g,
    `$1${checked ? "1" : "0"}$2`,
  );
}

function fillLegacyCheckboxes(xml: string, details: IncomingNonconformanceDetails, isProcess = false) {
  let otherCheckboxIndex = 0;
  let identificationSection = true;
  return xml.replace(/<w:p(?:\s[^>]*)?>[\s\S]*?<\/w:p>/g, (paragraphXml) => {
    const text = cellText(paragraphXml);
    if (text.includes("EVALUACIÓN Y DISPOSICIÓN")) identificationSection = false;
    if (!identificationSection) return paragraphXml;
    if (!paragraphXml.includes("<w:checkBox>")) return paragraphXml;
    if (text.includes("Etiquetado")) return setCheckboxDefault(paragraphXml, details.category === "labeling");
    if (text.includes("Calidad")) return setCheckboxDefault(paragraphXml, details.category === "quality");
    if (text.includes("Desempeño")) return setCheckboxDefault(paragraphXml, details.category === "performance");
    if (text.includes("Seguridad")) return setCheckboxDefault(paragraphXml, details.category === "safety");
    if (text.includes("Producción")) return setCheckboxDefault(paragraphXml, isProcess);
    if (text.includes("Inspecciones de entrada")) return setCheckboxDefault(paragraphXml, !isProcess);
    if (text.includes("Antes de la entrega")) return setCheckboxDefault(paragraphXml, true);
    if (text.includes("Después de la entrega")) return setCheckboxDefault(paragraphXml, false);
    if (text.startsWith("Otro:")) {
      otherCheckboxIndex += 1;
      if (otherCheckboxIndex === 1) return setCheckboxDefault(paragraphXml, details.category === "other");
      if (otherCheckboxIndex === 2) return setCheckboxDefault(paragraphXml, false);
      return paragraphXml;
    }
    return paragraphXml;
  });
}

export async function POST(request: NextRequest) {
  try {
    const authorization = request.headers.get("authorization");
    if (!authorization?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "No autorizado." }, { status: 401 });
    }
    const decoded = await adminAuth.verifyIdToken(authorization.slice(7));
    const body = await request.json();
    const scopeKey = clean(body.scopeKey);
    const lotId = clean(body.lotId);
    if (!scopeKey || !lotId) {
      return NextResponse.json({ error: "Falta la información del lote." }, { status: 400 });
    }

    const scopeReference = adminDB.collection("inspection_incoming_lots").doc(scopeKey);
    const lotReference = scopeReference.collection("lots").doc(lotId);
    const [scopeSnapshot, lotSnapshot, reportsSnapshot] = await Promise.all([
      scopeReference.get(),
      lotReference.get(),
      lotReference.collection("reports").get(),
    ]);
    if (!scopeSnapshot.exists || !lotSnapshot.exists) {
      return NextResponse.json({ error: "No se encontró el lote." }, { status: 404 });
    }

    const scope = scopeSnapshot.data() || {};
    const lotData = lotSnapshot.data() || {};
    const details = lotData.nonconformanceDetails as IncomingNonconformanceDetails | undefined;
    if (lotData.status !== "finalized" || lotData.inspectionResult !== "will_fail") {
      return NextResponse.json({ error: "Este lote no requiere o todavía no tiene completa la no conformidad." }, { status: 409 });
    }

    const context = {
      sourceType: scope.sourceType,
      scopeKey,
      projectId: scope.projectId,
      projectName: scope.projectName,
      wiCode: clean(scope.wiCode),
      wiTitle: clean(scope.wiTitle),
      componentId: clean(scope.componentId),
      componentTitle: clean(scope.componentTitle),
    } as IncomingInspectionContext;
    const lot = mapIncomingLot(lotId, lotData);
    const reports = reportsSnapshot.docs.map((entry) => ({
      id: entry.id,
      ...entry.data(),
    })) as unknown as IncomingLotReport[];
    const { partNumber, partName } = extractIncomingPartInfo(context);
    const generatedBy = await getDisplayNameForUid(decoded.uid, decoded.email);
    const photos = await loadReportPhotos(body.selectedPhotos, reports.filter(report => report.kind === "spec_rejection"));
    const description = buildNonconformanceDescription(lot, reports, scope.sourceType === "proceso_proyecto");
    const templatePath = path.join(process.cwd(), "public", "templates", scope.sourceType === "proceso_proyecto" ? "Reporte No conformidad Inspec proceso.docx" : "Reporte No conformidad Inspec Entrada.docx");
    const zip = new PizZip(await fs.readFile(templatePath));
    const templateDocument = zip.file("word/document.xml");
    if (templateDocument) {
      zip.file("word/document.xml", templateDocument.asText().replace(/<w:tc[ >][\s\S]*?<\/w:tc>/g, cell => cell.includes("nonconformanceDescription") ? cell.replace("</w:tc>", `<w:p><w:r><w:t>${PHOTO_MARKER}</w:t></w:r></w:p></w:tc>`) : cell));
    }
    const docx = new Docxtemplater(zip, { paragraphLoop: true, linebreaks: true });
    docx.render({
      generateBy: generatedBy,
      generatedBy,
      generatedDate: generatedDate(),
      patNumber: partNumber,
      partNumber,
      partName,
      lotName: clean(lot.lotName) || "NA",
      totalLotQuantity: String(Number(lot.totalLotQuantity || 0)),
      finalRejectedPieces: String(Number(lot.finalRejectedPieces || 0)),
      nonconformanceDescription: description,
      nonconformanceExtraComment: clean(body.extraComment),
      immediateActions: clean(details?.immediateActions),
    });

    const outputZip = docx.getZip();
    const documentFile = outputZip.file("word/document.xml");
    if (documentFile) {
      outputZip.file("word/document.xml", fillLegacyCheckboxes(documentFile.asText(), details ?? { category: "quality" } as IncomingNonconformanceDetails, scope.sourceType === "proceso_proyecto"));
    }
    addNonconformancePhotos(outputZip, photos);
    const result = outputZip.generate({ type: "nodebuffer", compression: "DEFLATE" });
    const fileName = `No_conformidad_${safeFileName(clean(lot.lotName) || lotId)}.docx`;
    return new NextResponse(new Uint8Array(result), {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": `attachment; filename="${fileName}"`,
      },
    });
  } catch (error) {
    console.error("[incoming nonconformance report]", error);
    return NextResponse.json({
      error: "No se pudo generar la no conformidad.",
      detail: error instanceof Error ? error.message : String(error),
    }, { status: 500 });
  }
}
