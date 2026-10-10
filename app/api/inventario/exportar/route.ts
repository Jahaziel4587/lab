import { NextRequest, NextResponse } from "next/server";
import { adminDB } from "@/lib/firebaseAdmin";
import { identify } from "@/lib/operacional/server";
import { inventoryCollections, inventorySite } from "@/lib/inventario/sites";
import { exportInventory } from "@/lib/inventario/excel";
import type { InventoryComponent } from "@/lib/inventario/types";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(req: NextRequest) {
    if (!await identify(req))
        return NextResponse.json({ error: "Inicia sesión." }, { status: 401 });
    try {
        const site = inventorySite(req.nextUrl.searchParams.get("site"));
        const snap = await adminDB.collection(inventoryCollections(site).components).get();
        const { buffer, filename } = exportInventory(snap.docs.map(d => ({ ...d.data(), id: d.id } as InventoryComponent)), site);
        return new NextResponse(new Uint8Array(buffer), { headers: { "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "Content-Disposition": `attachment; filename="${filename}"`, "Cache-Control": "private, no-store" } });
    }
    catch (e) {
        return NextResponse.json({ error: e instanceof Error ? e.message : "No se pudo descargar el inventario." }, { status: 400 });
    }
}
