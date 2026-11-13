import { NextResponse } from "next/server";
import { authenticateDhr } from "@/lib/box/dhrAuth";
import { normalizeDhrName, searchDmrPdfs } from "@/lib/box/dhr";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;
export async function POST(request: Request) {
  if (!await authenticateDhr(request)) return NextResponse.json({ error: "Inicia sesión para consultar el DMR." }, { status: 401 });
  let body;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Solicitud inválida." }, { status: 400 }); }
  const { projectId, queries } = body ?? {};
  if (typeof projectId !== "string" || !/^\d+$/.test(projectId) || !Array.isArray(queries) || !queries.length || queries.length > 50 || queries.some(q => typeof q !== "string" || q.length > 200 || normalizeDhrName(q).length < 2)) {
    return NextResponse.json({ error: "Selecciona un proyecto y escribe de 1 a 50 nombres o códigos (mínimo 2 caracteres)." }, { status: 400 });
  }
  try {
    return NextResponse.json(await searchDmrPdfs(projectId, [...new Set<string>(queries.map(q => q.trim()))]), { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("DHR search failed", error);
    return NextResponse.json({ error: "No se pudo completar la búsqueda. Revisa los permisos de Box y vuelve a intentar." }, { status: 502 });
  }
}
