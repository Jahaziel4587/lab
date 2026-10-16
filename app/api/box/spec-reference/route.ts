import { NextRequest, NextResponse } from "next/server";
import { adminAuth } from "@/lib/firebaseAdmin";
import { getIncomingSpecReference } from "@/lib/box/specCatalog";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: NextRequest) {
  const authorization = request.headers.get("authorization");
  if (!authorization?.startsWith("Bearer ")) return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  try { await adminAuth.verifyIdToken(authorization.slice(7)); }
  catch { return NextResponse.json({ error: "No autorizado." }, { status: 401 }); }
  const source = request.nextUrl.searchParams.get("source");
  const wiCode = request.nextUrl.searchParams.get("wiCode")?.trim() || "";
  const projectId = request.nextUrl.searchParams.get("projectId") || undefined;
  if (!["mts", "project"].includes(source || "") || !/^WI[.\w -]+$/i.test(wiCode) || wiCode.length > 150 || (source === "project" && !/^\d+$/.test(projectId || ""))) {
    return NextResponse.json({ error: "Faltan datos válidos de la WI o del proyecto." }, { status: 400 });
  }
  try { return NextResponse.json(await getIncomingSpecReference({ source: source as "mts" | "project", projectId, wiCode })); }
  catch (error) {
    console.error("[Box SPEC reference]", error);
    return NextResponse.json({ error: "No se pudo consultar la SPEC en Box. Verifica los permisos de la carpeta o captura la referencia manualmente." }, { status: 502 });
  }
}
