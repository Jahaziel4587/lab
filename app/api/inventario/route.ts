import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminDB } from "@/lib/firebaseAdmin";
import { LOCATIONS, WAREHOUSES, TYPES } from "@/lib/inventario/catalogs";
import { mexicoToday, selectLot } from "@/lib/inventario/selection";
import type { InventoryComponent, Lot, Voucher, VoucherLine, CartLine } from "@/lib/inventario/types";
import { inventorySite, inventoryCollections } from "@/lib/inventario/sites";
import { parseComponentCode } from "@/lib/operacional/catalog";
import { projectCatalog } from "@/lib/operacional/server";
import { createHash, randomUUID } from "node:crypto";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
function fail(message: string): never { throw new Error(message); }
function str(value: unknown, required = true): string {
  if (typeof value !== "string" || value.length > 1000) fail("Texto inválido.");
  const result = value.trim(); if (required && !result) fail("Completa los campos obligatorios."); return result;
}
function quantity(value: unknown): number { if (typeof value !== "number" || !Number.isFinite(value) || value <= 0 || value > 1e9) fail("La cantidad debe ser mayor que cero."); return value; }
function date(value: unknown): string { const v = str(value, false); if (v && (!/^\d{4}-\d{2}-\d{2}$/.test(v) || new Date(v).toISOString().slice(0, 10) !== v)) fail("Fecha inválida."); return v; }
function location(value: unknown) { const id = str(value); if (!LOCATIONS.some(l => l.id === id)) fail("Ubicación inválida."); return id; }
function isWarehouse(id: string) { return WAREHOUSES.some(w => w.id === id); }
async function identity(req: NextRequest) {
  const header = req.headers.get("authorization") || "";
  if (!header.startsWith("Bearer ")) return null;
  try { return await adminAuth.verifyIdToken(header.slice(7), true); } catch { return null; }
}
export async function GET(req: NextRequest) {
  if (!await identity(req)) return NextResponse.json({ error: "Inicia sesión." }, { status: 401 });
  try {
    const site = inventorySite(req.nextUrl.searchParams.get("site"));
    const names = inventoryCollections(site);
    const components = adminDB.collection(names.components), vouchers = adminDB.collection(names.vouchers);
    const voucherId = req.nextUrl.searchParams.get("voucherId");
    if (voucherId) {
      if (!/^[a-zA-Z0-9]{10,100}$/.test(voucherId)) return NextResponse.json({ error: "Folio inválido." }, { status: 400 });
      const doc = await vouchers.doc(voucherId).get();
      if (!doc.exists) return NextResponse.json({ error: "Vale no encontrado." }, { status: 404 });
      return NextResponse.json({ voucher: { ...doc.data(), id: doc.id } });
    }
    const historyComponent = req.nextUrl.searchParams.get("historyComponent");
    if (historyComponent) {
      if (!/^[a-zA-Z0-9]{10,100}$/.test(historyComponent)) return NextResponse.json({ error: "Componente inválido." }, { status: 400 });
      // Include legacy vouchers too: their component IDs exist only inside lines.
      const history = await vouchers.orderBy("createdAt", "desc").get();
      return NextResponse.json({ vouchers: history.docs.map(d => ({ ...d.data(), id: d.id } as Voucher)).filter(v => v.lines.some(l => l.componentId === historyComponent)) });
    }
    const [cs, vs] = await Promise.all([components.get(), vouchers.orderBy("createdAt", "desc").limit(300).get()]);
    return NextResponse.json({ components: cs.docs.map(d => ({ ...d.data(), id: d.id })), vouchers: vs.docs.map(d => ({ ...d.data(), id: d.id })) });
  } catch (e) { console.error("Inventario GET", e); return NextResponse.json({ error: "No se pudo cargar el inventario." }, { status: 500 }); }
}
export async function POST(req: NextRequest) {
  const user = await identity(req);
  if (!user) return NextResponse.json({ error: "Inicia sesión." }, { status: 401 });
  try {
    const b = await req.json();
    const site = inventorySite(b.site);
    const querySite = req.nextUrl?.searchParams.get("site");
    if (querySite && inventorySite(querySite) !== site) fail("El almacén de la operación no coincide.");
    const names = inventoryCollections(site);
    const components = adminDB.collection(names.components), vouchers = adminDB.collection(names.vouchers), operations = adminDB.collection(names.operations);
    const now = new Date().toISOString();
    const actor = user.name || user.email || user.uid;
    if (b.action === "component") {
      const parsed = parseComponentCode(str(b.code));
      const { code, type } = parsed;
      const catalog = await projectCatalog();
      const found = catalog.find(p => p.code === parsed.projectCode);
      if (parsed.projectCode && !found) fail("Registra primero el proyecto en Operacional.");
      const project = found?.label || "", name = str(b.name), unit = str(b.unit);
      if (!(type in TYPES)) fail("Tipo de artículo inválido.");
      const id = createHash("sha256").update(code.toUpperCase()).digest("hex");
      const ref = components.doc(id);
      await adminDB.runTransaction(async t => {
        if ((await t.get(ref)).exists) fail("Ya existe un artículo con ese código.");
        t.create(ref, { site, code, name, project, unit, type, lots: [], createdAt: now, createdBy: user.uid });
      });
      return NextResponse.json({ id });
    }
    const operationId = str(b.operationId);
    if (!/^[a-zA-Z0-9-]{10,100}$/.test(operationId)) fail("Identificador de operación inválido.");
    const operationRef = operations.doc(operationId);
    const fingerprint = createHash("sha256").update(JSON.stringify(b)).digest("hex");
    const result = await adminDB.runTransaction(async t => {
      const previous = await t.get(operationRef);
      if (previous.exists) {
        if (previous.data()?.uid !== user.uid || previous.data()?.fingerprint !== fingerprint) fail("La operación ya se usó con otros datos.");
        return previous.data()?.voucherIds as string[];
      }
      const groups = new Map<string, { origin: string; destination: string; lines: VoucherLine[] }>();
      const changed = new Map<string, InventoryComponent>();
      const addLine = (origin: string, destination: string, c: InventoryComponent, l: Lot, q: number) => {
        const key = `${origin}|${destination}`;
        const group = groups.get(key) || { origin, destination, lines: [] };
        group.lines.push({ componentId: c.id, code: c.code, name: c.name, project: c.project, unit: c.unit, lot: l.name, lotId: l.id, expiry: l.expiry, quantity: q, comments: l.notes }); groups.set(key, group);
      };
      if (b.action === "lot") {
        const id = str(b.componentId), destination = location(b.destination), origin = location(b.origin);
        if (!isWarehouse(destination) || isWarehouse(origin)) fail("La entrada debe ir desde un origen externo a un almacén.");
        const snap = await t.get(components.doc(id)); if (!snap.exists) fail("Artículo inexistente.");
        const c = { ...snap.data(), id } as InventoryComponent;
        const name = str(b.name), expiry = date(b.expiry), q = quantity(b.quantity);
        if (c.unit === "pz" && !Number.isInteger(q)) fail("Las piezas deben ser cantidades enteras.");
        if (c.lots.some(l => l.name.toUpperCase() === name.toUpperCase())) fail("El lote ya existe. Usa Registrar entrada para agregar existencias.");
        const l: Lot = { id: randomUUID(), name, expiry, supplier: str(b.supplier || "", false), notes: str(b.notes || "", false), createdAt: now, stock: { [destination]: q } };
        c.lots.push(l); changed.set(id, c); addLine(origin, destination, c, l, q);
      } else if (b.action === "movement") {
        if (!["salida", "entrada", "traslado"].includes(b.kind)) fail("Movimiento inválido.");
        if (!Array.isArray(b.lines) || !b.lines.length || b.lines.length > 50) fail("Agrega entre 1 y 50 artículos.");
        const lines = b.lines as CartLine[];
        const ids = [...new Set(lines.map(l => str(l.componentId)))];
        const snaps = await t.getAll(...ids.map(id => components.doc(id)));
        snaps.forEach(s => { if (!s.exists) fail("Artículo inexistente."); changed.set(s.id, { ...s.data(), id: s.id } as InventoryComponent); });
        for (const line of lines) {
          const c = changed.get(line.componentId)!;
          const q = quantity(line.quantity), origin = location(line.origin), destination = location(line.destination);
          if (c.unit === "pz" && !Number.isInteger(q)) fail("Las piezas deben ser cantidades enteras.");
          if (origin === destination) fail("El origen y destino deben ser diferentes.");
          if (b.kind === "salida" && (!isWarehouse(origin) || isWarehouse(destination))) fail("La salida debe ir desde un almacén a un destino externo.");
          if (b.kind === "entrada" && (isWarehouse(origin) || !isWarehouse(destination))) fail("La entrada debe ir desde un origen externo a un almacén.");
          if (b.kind === "traslado" && (!isWarehouse(origin) || !isWarehouse(destination))) fail("El traslado debe ser entre almacenes.");
          let lot: Lot | undefined;
          if (b.kind === "salida") {
            if (!WAREHOUSES.find(w => w.id === origin)?.usable) fail("Este almacén no está habilitado para retiros de uso. Usa Traslado para cambiar su ubicación.");
            lot = selectLot(c.lots, origin, q, mexicoToday(), line.lotId);
            if (!lot) fail(`${c.code}: ningún lote vigente tiene ${q} ${c.unit} en el almacén seleccionado. No se combinaron lotes.`);
          } else {
            lot = c.lots.find(l => l.id === line.lotId); if (!lot) fail("Selecciona el lote al que pertenecen las piezas.");
          }
          if (isWarehouse(origin)) {
            if ((lot.stock[origin] || 0) < q) fail(`${c.code}: existencias insuficientes.`);
            lot.stock[origin] = Math.round(((lot.stock[origin] || 0) - q) * 1e6) / 1e6;
          }
          if (isWarehouse(destination)) lot.stock[destination] = Math.round(((lot.stock[destination] || 0) + q) * 1e6) / 1e6;
          addLine(origin, destination, c, lot, q);
        }
      } else fail("Acción inválida.");
      const requestedBy = str(b.requestedBy || "", false), receivedBy = str(b.receivedBy || "", false), project = str(b.project || "", false), notes = str(b.notes || "", false);
      const originOther = str(b.originOther || "", false), destinationOther = str(b.destinationOther || "", false);
      if ([...groups.values()].some(g => g.origin === "externo:otro") && !originOther && !notes) fail("Especifica el origen Otro.");
      if ([...groups.values()].some(g => g.destination === "externo:otro") && !destinationOther && !notes) fail("Especifica el destino Otro.");
      const voucherIds: string[] = [];
      for (const c of changed.values()) {
        if (c.lots.length > 500) fail("Este artículo alcanzó el límite de 500 lotes de esta versión.");
        t.set(components.doc(c.id), c);
      }
      for (const g of groups.values()) {
        const ref = vouchers.doc(); voucherIds.push(ref.id);
        const v: Voucher = { id: ref.id, site, operationId, kind: b.action === "lot" ? "entrada" : b.kind, origin: g.origin, destination: g.destination, createdAt: now, actor, actorUid: user.uid, requestedBy, receivedBy, project, notes, originOther, destinationOther, lines: g.lines };
        t.create(ref, v);
      }
      t.create(operationRef, { uid: user.uid, fingerprint, site, voucherIds, createdAt: now });
      return voucherIds;
    });
    return NextResponse.json({ voucherIds: result });
  } catch (e) {
    const message = e instanceof Error ? e.message : "No se pudo registrar el movimiento.";
    console.error("Inventario POST", message);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
