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
  IncomingInspectionLot,
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
  return new Intl.DateTimeFormat("es-MX", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "America/Mexico_City",
  }).format(new Date());
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

function setContentControlCheckbox(controlXml: string, checked: boolean) {
  return controlXml
    .replace(
      /(<w14:checked\s+w14:val=")[01]("\s*\/>)/g,
      `$1${checked ? "1" : "0"}$2`,
    )
    .replace(
      /(<w:sdtContent>[\s\S]*?<w:t(?:\s[^>]*)?>)[☐☒](<\/w:t>[\s\S]*?<\/w:sdtContent>)/g,
      `$1${checked ? "☒" : "☐"}$2`,
    );
}

function fillRiskCheckboxes(cellXml: string, details: IncomingNonconformanceDetails) {
  return cellXml.replace(/<w:p(?:\s[^>]*)?>[\s\S]*?<\/w:p>/g, (paragraphXml) => {
    const text = cellText(paragraphXml);
    const selected =
      (text.includes("Alto") && details.riskLevel === "high") ||
      (text.includes("Medio") && details.riskLevel === "medium") ||
      (text.includes("Bajo") && details.riskLevel === "low");
    return paragraphXml.replace(
      /<w:sdt(?:\s[^>]*)?>[\s\S]*?<\/w:sdt>/,
      (controlXml) => setContentControlCheckbox(controlXml, selected),
    );
  });
}

function fillLegacyCheckboxes(xml: string, details: IncomingNonconformanceDetails) {
  const dispositions = Array.isArray(details.dispositions) ? details.dispositions : [];
  let otherCheckboxIndex = 0;
  return xml.replace(/<w:p(?:\s[^>]*)?>[\s\S]*?<\/w:p>/g, (paragraphXml) => {
    const text = cellText(paragraphXml);
    const compactText = text.replace(/\s+/g, "").toLocaleLowerCase("es-MX");
    if (text.includes("Alto") || text.includes("Medio") || text.includes("Bajo")) {
      return fillRiskCheckboxes(paragraphXml, details);
    }
    if (!paragraphXml.includes("<w:checkBox>")) return paragraphXml;
    if (text.includes("Etiquetado")) return setCheckboxDefault(paragraphXml, details.category === "labeling");
    if (text.includes("Calidad")) return setCheckboxDefault(paragraphXml, details.category === "quality");
    if (text.includes("Desempeño")) return setCheckboxDefault(paragraphXml, details.category === "performance");
    if (text.includes("Seguridad")) return setCheckboxDefault(paragraphXml, details.category === "safety");
    if (text.includes("Producción")) return setCheckboxDefault(paragraphXml, false);
    if (text.includes("Inspecciones de entrada")) return setCheckboxDefault(paragraphXml, true);
    if (text.includes("Antes de la entrega")) return setCheckboxDefault(paragraphXml, true);
    if (text.includes("Después de la entrega")) return setCheckboxDefault(paragraphXml, false);
    if (text === "Si") return setCheckboxDefault(paragraphXml, details.capaRequired);
    if (text === "No") return setCheckboxDefault(paragraphXml, !details.capaRequired);
    if (compactText.includes("re-trabajo")) return setCheckboxDefault(paragraphXml, dispositions.includes("rework"));
    if (compactText.includes("devoluciónalproveedor")) return setCheckboxDefault(paragraphXml, dispositions.includes("return_supplier"));
    if (compactText.includes("usartalcual")) return setCheckboxDefault(paragraphXml, dispositions.includes("use_as_is"));
    if (compactText.includes("usoparar&d")) return setCheckboxDefault(paragraphXml, dispositions.includes("rnd"));
    if (compactText.includes("merma")) return setCheckboxDefault(paragraphXml, dispositions.includes("scrap"));
    if (text.startsWith("Otro:")) {
      otherCheckboxIndex += 1;
      if (otherCheckboxIndex === 1) return setCheckboxDefault(paragraphXml, details.category === "other");
      if (otherCheckboxIndex === 2) return setCheckboxDefault(paragraphXml, false);
      return setCheckboxDefault(paragraphXml, dispositions.includes("other"));
    }
    return paragraphXml;
  });
}

function repairTemplateTags(xml: string) {
  const dispositionTagHasOpening = /<w:t(?:\s[^>]*)?>\{<\/w:t>(?:(?!<\/w:tc>)[\s\S])*?<w:t(?:\s[^>]*)?>dispositionOtherText<\/w:t>/.test(xml);
  if (dispositionTagHasOpening) return xml;
  return xml.replace(
    /(<w:t(?:\s[^>]*)?>)dispositionOtherText(<\/w:t>)/,
    "$1{dispositionOtherText$2",
  );
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
    if (lotData.status !== "finalized" || lotData.inspectionResult !== "will_fail" || !details) {
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
    const photos = await loadReportPhotos(body.selectedPhotos, reports);
    const description = buildNonconformanceDescription(lot, reports);
    const additionalComments = [details.additionalComments, clean(body.extraComment)]
      .filter(Boolean)
      .join("\n");
    const mark = (selected: boolean) => selected ? "X" : "";

    const templatePath = path.join(process.cwd(), "public", "templates", "Reporte No conformidad Inspec Entrada.docx");
    const zip = new PizZip(await fs.readFile(templatePath));
    const templateDocument = zip.file("word/document.xml");
    if (templateDocument) {
      zip.file("word/document.xml", repairTemplateTags(templateDocument.asText()).replace(/<w:tc[ >][\s\S]*?<\/w:tc>/g, cell => cell.includes("nonconformanceDescription") ? cell.replace("</w:tc>", `<w:p><w:r><w:t>${PHOTO_MARKER}</w:t></w:r></w:p></w:tc>`) : cell));
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
      immediateActions: clean(details.immediateActions) || "NA",
      riskSeverity: clean(details.riskSeverity) || "NA",
      riskOccurrence: clean(details.riskOccurrence) || "NA",
      riskHigh: mark(details.riskLevel === "high"),
      riskMedium: mark(details.riskLevel === "medium"),
      riskLow: mark(details.riskLevel === "low"),
      capaYes: mark(details.capaRequired),
      capaNo: mark(!details.capaRequired),
      dispositionRework: mark(details.dispositions?.includes("rework") ?? false),
      dispositionReturn: mark(details.dispositions?.includes("return_supplier") ?? false),
      dispositionUseAsIs: mark(details.dispositions?.includes("use_as_is") ?? false),
      dispositionRandD: mark(details.dispositions?.includes("rnd") ?? false),
      dispositionScrap: mark(details.dispositions?.includes("scrap") ?? false),
      dispositionOther: mark(details.dispositions?.includes("other") ?? false),
      dispositionOtherText: clean(details.dispositionOtherText),
      dispositionJustification: clean(details.dispositionJustification) || "NA",
      iifReference: clean(details.iifReference) || "NA",
      qciReference: clean(details.qciReference) || "NA",
      capaReference: clean(details.capaReference) || "NA",
      scarReference: clean(details.scarReference) || "NA",
      recallReference: clean(details.recallReference) || "NA",
      otherReferences: clean(details.otherReferences) || "NA",
      correctiveActions: clean(details.correctiveActions) || "NA",
      additionalComments: additionalComments || "NA",
    });

    const outputZip = docx.getZip();
    const documentFile = outputZip.file("word/document.xml");
    if (documentFile) {
      outputZip.file("word/document.xml", fillLegacyCheckboxes(documentFile.asText(), details));
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
