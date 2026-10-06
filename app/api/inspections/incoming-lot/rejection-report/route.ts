export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import fs from "fs/promises";
import path from "path";
import PizZip from "pizzip";
import { NextRequest, NextResponse } from "next/server";

import { extractIncomingPartInfo } from "@/app/inspecciones/entrada-lotes/qmsReportData";
import type { IncomingInspectionContext } from "@/app/inspecciones/entrada-lotes/types";
import { adminAuth, adminDB } from "@/lib/firebaseAdmin";
import { getDisplayNameForUid } from "@/lib/pushNotifications";

import { loadReportPhotos, addRejectionPhotoSheets } from "@/lib/inspections/officialReportPhotos";
import type { IncomingLotReport } from "@/app/inspecciones/entrada-lotes/types";

function clean(value: unknown) {
  return String(value ?? "").trim();
}

function escapeXml(value: unknown) {
  return clean(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
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
    const [scopeSnapshot, lotSnapshot] = await Promise.all([
      scopeReference.get(),
      lotReference.get(),
    ]);
    if (!scopeSnapshot.exists || !lotSnapshot.exists) {
      return NextResponse.json({ error: "No se encontró el lote." }, { status: 404 });
    }

    const scope = scopeSnapshot.data() || {};
    const lot = lotSnapshot.data() || {};
    const finalRejectedPieces = Number(lot.finalRejectedPieces || 0);
    if (lot.status !== "finalized" || !Number.isInteger(finalRejectedPieces) || finalRejectedPieces < 1) {
      return NextResponse.json({ error: "El lote finalizado no tiene piezas rechazadas." }, { status: 409 });
    }

    const rejectionSummary = clean(body.rejectionSummary);
    const disposition = body.disposition === "other" ? "other" : "scrap";
    const otherDisposition = clean(body.otherDisposition);
    if (!rejectionSummary) {
      return NextResponse.json({ error: "Agrega la descripción general de defectos." }, { status: 400 });
    }
    if (disposition === "other" && !otherDisposition) {
      return NextResponse.json({ error: "Especifica la otra disposición." }, { status: 400 });
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
    const { partNumber, partName } = extractIncomingPartInfo(context);
    const generatedBy = await getDisplayNameForUid(decoded.uid, decoded.email);
    const replacements: Record<string, string> = {
      generatedBy,
      generatedDate: generatedDate(),
      poNumber: clean(lot.purchaseOrder) || "NA",
      partNumber,
      partName,
      lotName: clean(lot.lotName) || "NA",
      totalLotQuantity: String(Number(lot.totalLotQuantity || 0)),
      finalRejectedPieces: String(finalRejectedPieces),
      rejectionSummary,
      scrapMark: disposition === "scrap" ? "X" : "",
      otherDispositionMark: disposition === "other" ? "X" : "",
      otherDisposition: disposition === "other" ? otherDisposition : "",
      rejectionObservations: clean(body.rejectionObservations),
    };

    const templatePath = path.join(process.cwd(), "public", "templates", "Rejection Report Inpec Entrada.xlsx");
    const zip = new PizZip(await fs.readFile(templatePath));
    Object.keys(zip.files)
      .filter((name) => name.startsWith("xl/") && name.endsWith(".xml"))
      .forEach((name) => {
        const file = zip.file(name);
        if (!file) return;
        let xml = file.asText();
        Object.entries(replacements).forEach(([key, value]) => {
          xml = xml.split(`{${key}}`).join(escapeXml(value));
        });
        zip.file(name, xml);
      });

    const reportsSnapshot = await lotReference.collection("reports").get();
    const reports = reportsSnapshot.docs.map(entry => ({ ...entry.data(), id: entry.id })) as IncomingLotReport[];
    const photos = await loadReportPhotos(body.selectedPhotos, reports);
    addRejectionPhotoSheets(zip, photos, clean(lot.lotName));

    const result = zip.generate({ type: "nodebuffer", compression: "DEFLATE" });
    const fileName = `Reporte_rechazo_${safeFileName(clean(lot.lotName) || lotId)}.xlsx`;
    return new NextResponse(new Uint8Array(result), {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${fileName}"`,
      },
    });
  } catch (error) {
    console.error("[incoming rejection report]", error);
    return NextResponse.json({
      error: "No se pudo generar el reporte de rechazo.",
      detail: error instanceof Error ? error.message : String(error),
    }, { status: 500 });
  }
}
