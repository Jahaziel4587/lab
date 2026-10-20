import { validateVoucherTitle } from "@/lib/inventario/voucher-title";
import { kivLots } from "@/lib/inventario/kiv";
import { validateCart } from "@/lib/inventario/cart";
import { recipePeriod, type FixedRecipe } from "@/lib/inventario/fixed-recipes";
import { storageConditions, componentConditionsFromLot } from "@/lib/inventario/storage";
import { applyStorage, warehouseRecipients, pushStorageAlerts } from "@/lib/inventario/storage-server";
import { after, NextRequest, NextResponse } from "next/server";
import { adminAuth, adminDB } from "@/lib/firebaseAdmin";
import { LOCATIONS, LEGACY_LOCATIONS, WAREHOUSES, TYPES } from "@/lib/inventario/catalogs";
import { mexicoToday, selectLot, lotAvailableForProject } from "@/lib/inventario/selection";
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
function location(value: unknown, allowLegacy = false) { const id = str(value); if (![...LOCATIONS, ...(allowLegacy ? LEGACY_LOCATIONS : [])].some(l => l.id === id)) fail("Ubicación inválida."); return id; }
function isWarehouse(id: string) { return [...WAREHOUSES, ...LEGACY_LOCATIONS].some(w => w.id === id); }
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
    if (req.nextUrl.searchParams.get("view") === "kiv") {
      const cs = await components.get(), today = mexicoToday();
      return NextResponse.json({ today, lots: kivLots(cs.docs.map(d => ({ ...d.data(), id: d.id } as InventoryComponent)), today) });
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
    if (b.action === "voucher-title") {
      const voucherId = str(b.voucherId), title = validateVoucherTitle(b.title), expectedTitle = validateVoucherTitle(b.expectedTitle);
      if (!/^[a-zA-Z0-9]{10,100}$/.test(voucherId)) fail("Folio inválido.");
      await adminDB.runTransaction(async transaction => {
        const ref = vouchers.doc(voucherId), snapshot = await transaction.get(ref);
        if (!snapshot.exists) fail("Vale no encontrado.");
        if ((snapshot.data()?.title || "") !== expectedTitle) fail("Otro usuario cambió el título. Recarga el vale antes de editarlo.");
        transaction.update(ref, { title, titleUpdatedAt: now, titleUpdatedBy: user.uid });
      });
      return NextResponse.json({ title });
    }
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
    if (["storage", "lot-storage"].includes(b.action)) {
      const componentId = str(b.componentId), next = storageConditions(b.temperatureCondition, b.humidityCondition, b.action === "lot-storage");
      const emails = await warehouseRecipients(site), alerts: Array<{id:string;message:string;url:string}> = [];
      await adminDB.runTransaction(async t => {
        alerts.length = 0;
        const snap = await t.get(components.doc(componentId)); if (!snap.exists) fail("Artículo inexistente.");
        const c = { ...snap.data(), id: snap.id } as InventoryComponent;
        if (b.action === "lot-storage") {
          const lot = c.lots.find(l => l.id === b.lotId); if (!lot) fail("Lote inexistente.");
          Object.assign(lot, next);
        }
        applyStorage(t, c, b.action === "lot-storage" ? componentConditionsFromLot(c, next, (c.lots.find(l=>l.id===b.lotId)?.stock.rechazado || 0) > 0 ? "rechazado" : undefined) : next, site, actor, emails, alerts); t.set(snap.ref, c);
      });
      after(() => pushStorageAlerts(alerts, emails, req.url));
      return NextResponse.json({ saved: true });
    }
    if (!b.requestId && ["lot", "movement"].includes(b.action)) {
      const selected = str(b.project || "000.General");
      if (selected !== "000.General" && !(await projectCatalog()).some(p => p.label === selected)) fail("Selecciona un proyecto del catálogo.");
      b.project = selected;
    }
    const emails = b.action === "lot" ? await warehouseRecipients(site) : [];
    const storageAlerts: Array<{id:string;message:string;url:string}> = [];
    let recipeVersion = 0;
    if (b.recipeId) {
      const snap = await adminDB.collection(`${names.components}_fixed_recipes`).doc(str(b.recipeId)).get();
      const recipe = snap.data() as FixedRecipe | undefined;
      if (!recipe?.active || b.action !== "movement" || b.kind !== "salida") fail("Receta inactiva o movimiento inválido.");
      recipeVersion = recipe.version;
      const period = recipePeriod(recipe, mexicoToday());
      if (b.operationId !== `recipe-${snap.id}-${period}` || !Array.isArray(b.lines) || b.lines.length !== recipe.lines.length || recipe.lines.some(l => !b.lines.some((line: CartLine) => line.componentId === l.componentId && line.quantity === l.quantity && line.destination === "externo:produccion")) || new Set(b.lines.map((l:CartLine)=>l.componentId)).size !== b.lines.length) fail("El retiro no coincide con la receta.");
    }
    const operationId = str(b.operationId);
    if (!/^[a-zA-Z0-9-]{10,100}$/.test(operationId)) fail("Identificador de operación inválido.");
    const operationRef = operations.doc(operationId);
    const fingerprint = createHash("sha256").update(JSON.stringify(b)).digest("hex");
    if (b.requestId) {
      if (b.requestId !== operationId || b.action !== "movement" || b.kind !== "salida") fail("Solicitud inválida.");
      const [order, profile] = await Promise.all([adminDB.collection("production_orders").doc(operationId).get(), adminDB.collection("users").doc(user.uid).get()]);
      const o = order.data();
      if (!o || o.site !== site || !(profile.data()?.warehouseSites || []).includes(site)) fail("Solo el almacenista asignado puede atender esta solicitud.");
      if (b.project !== o.projectName || !Array.isArray(b.lines) || b.lines.length !== o.lines.length || new Set(b.lines.map((l: CartLine)=>l.componentId)).size !== b.lines.length || o.lines.some((l: {componentId:string;total:number})=>!b.lines.some((x:CartLine)=>x.componentId===l.componentId && x.quantity===l.total && x.destination==="externo:produccion"))) fail("El retiro no coincide con la solicitud.");
    } else if ((await adminDB.collection("production_orders").doc(operationId).get()).exists) fail("Atiende esta solicitud desde Solicitudes de retiro.");
    const result = await adminDB.runTransaction(async t => {
      storageAlerts.length = 0;
      const previous = await t.get(operationRef);
      if (previous.exists) {
        if (previous.data()?.uid !== user.uid || previous.data()?.fingerprint !== fingerprint) fail("La operación ya se usó con otros datos.");
        return previous.data()?.voucherIds as string[];
      }
      if (b.recipeId) {
        const current = await t.get(adminDB.collection(`${names.components}_fixed_recipes`).doc(b.recipeId));
        if (!current.data()?.active || current.data()?.version !== recipeVersion) fail("La receta cambió. Recarga antes de confirmar.");
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
        const conditions = storageConditions(b.temperatureCondition ?? c.temperatureCondition, b.humidityCondition ?? c.humidityCondition, true);
        applyStorage(t, c, componentConditionsFromLot(c, conditions, destination), site, actor, emails, storageAlerts); Object.assign(l, conditions);
        c.lots.push(l); changed.set(id, c); addLine(origin, destination, c, l, q);
      } else if (b.action === "movement") {
        if (!["salida", "entrada", "traslado"].includes(b.kind)) fail("Movimiento inválido.");
        if (!Array.isArray(b.lines) || !b.lines.length || b.lines.length > 50) fail("Agrega entre 1 y 50 artículos.");
        const lines = b.lines as CartLine[];
        if (b.cart === true) validateCart(lines);
        const ids = [...new Set(lines.map(l => str(l.componentId)))];
        const snaps = await t.getAll(...ids.map(id => components.doc(id)));
        snaps.forEach(s => { if (!s.exists) fail("Artículo inexistente."); changed.set(s.id, { ...s.data(), id: s.id } as InventoryComponent); });
        for (const line of lines) {
          const c = changed.get(line.componentId)!;
          const q = quantity(line.quantity), origin = location(line.origin, true), destination = location(line.destination);
          if (c.unit === "pz" && !Number.isInteger(q)) fail("Las piezas deben ser cantidades enteras.");
          if (origin === destination) fail("El origen y destino deben ser diferentes.");
          if (b.kind === "salida" && (!isWarehouse(origin) || isWarehouse(destination))) fail("La salida debe ir desde un almacén a un destino externo.");
          if (b.kind === "entrada" && (isWarehouse(origin) || !isWarehouse(destination))) fail("La entrada debe ir desde un origen externo a un almacén.");
          if (b.kind === "traslado" && (!isWarehouse(origin) || !isWarehouse(destination))) fail("El traslado debe ser entre almacenes.");
          let lot: Lot | undefined;
          if (b.kind === "salida") {
            if (!WAREHOUSES.find(w => w.id === origin)?.usable) fail("Este almacén no está habilitado para retiros de uso. Usa Traslado para cambiar su ubicación.");
            lot = selectLot(c.lots.filter(l => lotAvailableForProject(l, b.project)), origin, q, mexicoToday(), line.lotId);
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
      const requestedBy = str(b.requestedBy || "", false), receivedBy = str(b.receivedBy || "", false), project = str(b.project || "", false), notes = b.action === "lot" ? "" : str(b.notes || "", false);
      const supplier = str(b.supplier || "", false);
      const originOther = str(b.originOther || ([...groups.values()].some(g => g.origin === "externo:recepcion") ? supplier : b.action === "lot" ? b.notes || "" : ""), false), destinationOther = str(b.destinationOther || "", false);
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
    after(() => pushStorageAlerts(storageAlerts, emails, req.url));
    return NextResponse.json({ voucherIds: result });
  } catch (e) {
    const message = e instanceof Error ? e.message : "No se pudo registrar el movimiento.";
    console.error("Inventario POST", message);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
