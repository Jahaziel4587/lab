import { readFile } from "node:fs/promises";
import path from "node:path";
import { NextRequest, NextResponse } from "next/server";
import { adminDB } from "@/lib/firebaseAdmin";
import { identify } from "@/lib/operacional/server";
import { LOT_LABEL_TEMPLATE, renderLotLabel } from "@/lib/inventario/lot-label";
import { inventoryCollections, inventoryHref, inventorySite } from "@/lib/inventario/sites";
import type { InventoryComponent, Voucher } from "@/lib/inventario/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, { params }: { params: Promise<{ componenteId: string; loteId: string }> }) {
  if (!await identify(req)) return NextResponse.json({ error: "Inicia sesión." }, { status: 401 });

  const { componenteId, loteId } = await params;
  const siteParam = req.nextUrl.searchParams.get("site");
  if (!/^[a-f0-9]{64}$/.test(componenteId) || !/^[a-zA-Z0-9-]{10,100}$/.test(loteId) ||
      (siteParam !== null && siteParam !== "B1" && siteParam !== "B2")) {
    return NextResponse.json({ error: "Componente, lote o almacén inválido." }, { status: 400 });
  }

  try {
    const site = inventorySite(siteParam);
    const names = inventoryCollections(site);
    const snapshot = await adminDB.collection(names.components).doc(componenteId).get();
    const component = snapshot.data() as InventoryComponent | undefined;
    const lot = component?.lots.find(entry => entry.id === loteId);
    if (!component || !lot) return NextResponse.json({ error: "Lote no encontrado en este almacén." }, { status: 404 });

    // The original receipt and lot share the same timestamp from the registration transaction.
    const [template, receipts] = await Promise.all([
      readFile(path.join(process.cwd(), LOT_LABEL_TEMPLATE)),
      lot.createdAt ? adminDB.collection(names.vouchers).where("createdAt", "==", lot.createdAt).get() : undefined,
    ]);
    const originalLine = receipts?.docs.map(doc => doc.data() as Voucher)
      .filter(voucher => voucher.kind === "entrada")
      .flatMap(voucher => voucher.lines)
      .find(line => line.componentId === componenteId && line.lotId === loteId);
    const componentUrl = new URL(inventoryHref(`/inventario/components/${componenteId}`, site), req.nextUrl.origin);
    const label = renderLotLabel(template, component, lot, originalLine?.quantity, componentUrl.href);
    return new NextResponse(new Uint8Array(label), {
      headers: { "Content-Type": "application/octet-stream", "Cache-Control": "private, no-store" },
    });
  } catch (error) {
    console.error("Etiqueta P-touch de lote", error);
    return NextResponse.json({ error: "No se pudo generar la etiqueta P-touch." }, { status: 500 });
  }
}
