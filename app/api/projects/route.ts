import { NextRequest, NextResponse } from "next/server";
import { identify, projectCatalog } from "@/lib/operacional/server";
export const dynamic = "force-dynamic";
export async function GET(req: NextRequest) { if (!await identify(req))
    return NextResponse.json({ error: "Inicia sesión." }, { status: 401 }); try {
    return NextResponse.json({ projects: await projectCatalog() });
}
catch {
    return NextResponse.json({ error: "No se pudieron cargar los proyectos." }, { status: 500 });
} }
