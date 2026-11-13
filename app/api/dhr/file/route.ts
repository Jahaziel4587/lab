import { NextRequest, NextResponse } from "next/server";
import { authenticateDhr } from "@/lib/box/dhrAuth";
import { requireDmrProject } from "@/lib/box/dhr";
import { BoxDownloadError, downloadBoxPdf, getBoxFileDetails } from "@/lib/box/boxClient";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;
export async function GET(request: NextRequest) {
  if (!await authenticateDhr(request)) return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  const projectId = request.nextUrl.searchParams.get("projectId") ?? "";
  const fileId = request.nextUrl.searchParams.get("fileId") ?? "";
  if (!/^\d+$/.test(projectId) || !/^\d+$/.test(fileId)) return NextResponse.json({ error: "Identificadores inválidos." }, { status: 400 });
  try {
    await requireDmrProject(projectId);
    const file = await getBoxFileDetails(fileId);
    if (file.type !== "file" || !/\.pdf$/i.test(file.name) || !file.path_collection.entries.some(folder => folder.id === projectId)) {
      return NextResponse.json({ error: "El PDF no pertenece al DMR seleccionado." }, { status: 403 });
    }
    if (file.permissions?.can_download === false) {
      return NextResponse.json({ error: "La cuenta de integración puede ver este documento, pero Box no le permite descargarlo. Revisa su rol en la carpeta y las restricciones de descarga." }, { status: 403 });
    }
    if (file.size > 50 * 1024 * 1024) return NextResponse.json({ error: "Este PDF supera 50 MB. Descárgalo directamente desde Box." }, { status: 413 });
    if (!file.file_version?.id) throw new BoxDownloadError(502, "missing_version", "Box no devolvió la versión del PDF. Vuelve a buscar el documento.");
    const response = await downloadBoxPdf(fileId, file.file_version.id);
    return new Response(response.body, { headers: {
      "Content-Type": "application/pdf", "Cache-Control": "private, no-store",
      "X-Box-Version-Id": file.file_version.id,
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(file.name)}`,
    } });
  } catch (error) {
    console.error("DHR download failed", error);
    if (error instanceof BoxDownloadError) {
      return NextResponse.json({ error: error.message }, { status: error.status >= 400 && error.status <= 599 ? error.status : 502 });
    }
    if (error instanceof Error && ["TimeoutError", "AbortError"].includes(error.name)) {
      return NextResponse.json({ error: "Box tardó demasiado en responder. Vuelve a intentar la descarga." }, { status: 504 });
    }
    return NextResponse.json({ error: "No se pudo descargar el PDF. Revisa el acceso al archivo en Box." }, { status: 502 });
  }
}
