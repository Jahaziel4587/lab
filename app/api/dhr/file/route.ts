import { NextRequest, NextResponse } from "next/server";
import { authenticateDhr } from "@/lib/box/dhrAuth";
import { requireDmrProject } from "@/lib/box/dhr";
import { downloadBoxPdf, getBoxFileDetails } from "@/lib/box/boxClient";
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
    if (file.size > 50 * 1024 * 1024) return NextResponse.json({ error: "Este PDF supera 50 MB. Descárgalo directamente desde Box." }, { status: 413 });
    if (!file.file_version?.id) throw new Error("Missing Box file version");
    const response = await downloadBoxPdf(fileId, file.file_version.id);
    return new Response(response.body, { headers: {
      "Content-Type": "application/pdf", "Cache-Control": "private, no-store",
      "X-Box-Version-Id": file.file_version.id,
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(file.name)}`,
    } });
  } catch (error) {
    console.error("DHR download failed", error);
    return NextResponse.json({ error: "No se pudo descargar el PDF. Revisa el acceso al archivo en Box." }, { status: 502 });
  }
}
