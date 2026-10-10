import { NextRequest, NextResponse } from "next/server";
import { createHash, randomUUID } from "node:crypto";
import { adminDB } from "@/lib/firebaseAdmin";
import { identify, canOperate, projectCatalog } from "@/lib/operacional/server";
import { parseComponentCode } from "@/lib/operacional/catalog";
import { WAREHOUSES } from "@/lib/inventario/catalogs";
import type { InventoryComponent } from "@/lib/inventario/types";
export const dynamic = "force-dynamic";
export async function POST(req: NextRequest) { const u = await identify(req); if (!u)
    return NextResponse.json({ error: "Inicia sesión." }, { status: 401 }); if (!canOperate(u.email))
    return NextResponse.json({ error: "Sin acceso a importaciones." }, { status: 403 }); try {
    const b = await req.json();
    if (!Array.isArray(b.rows) || !b.rows.length || b.rows.length > 200)
        throw new Error("Selecciona entre 1 y 200 filas por importación.");
    const projects = await projectCatalog();
    const keys = new Set<string>();
    const rows: any[] = b.rows.map((r: any) => { const parsed = parseComponentCode(String(r.code || "")); const project = projects.find(p => p.code === parsed.projectCode); if (parsed.projectCode && !project)
        throw new Error(`${parsed.code}: registra el proyecto en Operacional.`); const name = String(r.name || "").trim(), lot = String(r.lot || "").trim(), unit = String(r.unit || "pz"), quantity = Number(r.quantity), expiry = String(r.expiry || ""); if (!name || name.length > 200 || !lot || lot.length > 100 || !["pz", "caja", "roll", "m", "kg", "g", "L", "mL"].includes(unit) || !Number.isFinite(quantity) || quantity <= 0 || quantity > 1e9 || (unit === "pz" && !Number.isInteger(quantity)) || !WAREHOUSES.some(w => w.id === r.warehouse))
        throw new Error(`${parsed.code}: revisa nombre, lote, unidad, cantidad y almacén.`); if (expiry && (!/^\d{4}-\d{2}-\d{2}$/.test(expiry) || !Number.isFinite(Date.parse(expiry)) || new Date(expiry).toISOString().slice(0, 10) !== expiry))
        throw new Error(`${parsed.code}: caducidad inválida; usa AAAA-MM-DD.`); const key = `${parsed.code}|${lot.toUpperCase()}`; if (keys.has(key))
        throw new Error(`${parsed.code}: lote repetido. Revisa las filas antes de importar.`); keys.add(key); return { code: parsed.code, type: parsed.type, project: project?.label || "", name, lot, unit, quantity, expiry, warehouse: r.warehouse }; });
    const hash = createHash("sha256").update(JSON.stringify(rows)).digest("hex"), receipt = adminDB.collection("inventario_importaciones").doc(hash), now = new Date().toISOString();
    await adminDB.runTransaction(async (t) => { const previous = await t.get(receipt); if (previous.exists)
        return; const ids: string[] = [...new Set<string>(rows.map((r: any) => createHash("sha256").update(r.code).digest("hex")))]; const docs = await t.getAll(...ids.map(id => adminDB.collection("inventario_componentes").doc(id))); const changed = new Map<string, InventoryComponent>(); docs.forEach(d => { if (d.exists)
        changed.set(d.id, { ...d.data(), id: d.id } as InventoryComponent); }); for (const r of rows) {
        const id = createHash("sha256").update(r.code).digest("hex");
        const c: InventoryComponent = changed.get(id) || { id, code: r.code, name: r.name, project: r.project, type: r.type, unit: r.unit, lots: [], createdAt: now };
        if (c.unit !== r.unit || c.name !== r.name)
            throw new Error(`${r.code}: nombre o unidad diferentes al artículo existente.`);
        if (c.lots.some(l => l.name.toUpperCase() === r.lot.toUpperCase()))
            throw new Error(`${r.code}: el lote ${r.lot} ya existe. No se sumaron cantidades.`);
        if (c.lots.length >= 500)
            throw new Error("Límite de lotes alcanzado.");
        c.lots.push({ id: randomUUID(), name: r.lot, expiry: r.expiry, supplier: "", notes: "Saldo inicial importado de Excel", createdAt: now, stock: { [r.warehouse]: r.quantity } });
        changed.set(id, c);
    } for (const [id, c] of changed)
        t.set(adminDB.collection("inventario_componentes").doc(id), c); t.create(receipt, { actor: u.uid, at: now, rows }); });
    return NextResponse.json({ ok: true, count: rows.length });
}
catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "No se pudo importar." }, { status: 400 });
} }
