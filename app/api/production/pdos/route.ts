import { after, NextRequest, NextResponse } from "next/server";
import { identify } from "@/lib/operacional/server";
import { adminDB } from "@/lib/firebaseAdmin";
import { inventoryCollections, inventorySite } from "@/lib/inventario/sites";
import { mexicoToday } from "@/lib/inventario/selection";
import { cleanPdoDetails, pdoUnits, productionCapacity, type ProductionPdo, type ProductionRequest, type LotChoice } from "@/lib/production/pdo";
import { requiredQuantity } from "@/lib/production/calculate";
import { productionRecipeKey } from "@/lib/production/key";
import type { InventoryComponent } from "@/lib/inventario/types";
import { warehouseRecipients } from "@/lib/inventario/storage-server";
import { sendPushToEmails } from "@/lib/pushNotifications";
import { canMoveInventory } from "@/lib/inventario/warehouse-access";
import { FieldValue } from "firebase-admin/firestore";
import { createHash } from "node:crypto";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
function text(v: unknown) { if (typeof v !== "string" || !v.trim() || v.length > 300 || v.includes("/")) throw new Error("Completa la información requerida."); return v.trim(); }
function operation(v: unknown) { const id = text(v); if (!/^[a-zA-Z0-9-]{10,100}$/.test(id)) throw new Error("Identificador inválido."); return id; }
export async function GET(req: NextRequest) {
  if (!await identify(req)) return NextResponse.json({ error: "Inicia sesión." }, { status: 401 });
  try {
    const site = inventorySite(req.nextUrl.searchParams.get("site")), projectId = text(req.nextUrl.searchParams.get("projectId")), wiId = text(req.nextUrl.searchParams.get("wiId"));
    const recipeId = productionRecipeKey(site, projectId, wiId);
    const [pdos, all] = await Promise.all([adminDB.collection("production_pdos").where("recipeId", "==", recipeId).get(), adminDB.collection("production_orders").where("site", "==", site).get()]);
    const own = all.docs.filter(d => d.data().recipeId === recipeId);
    const ops = own.length ? await adminDB.getAll(...own.map(d => adminDB.collection(inventoryCollections(site).operations).doc(d.id))) : [];
    return NextResponse.json({
      pdos: pdos.docs.map(d => ({ ...d.data(), id: d.id })).sort((a, b) => String((b as ProductionPdo).createdAt).localeCompare(String((a as ProductionPdo).createdAt))),
      requests: own.map((d, i) => ({ ...d.data(), id: d.id, voucherIds: ops[i]?.data()?.voucherIds || [] })),
      pending: all.docs.filter(d => d.data().pdoId && d.data().status === "pending").map(d => ({ ...d.data(), id: d.id })),
    });
  } catch (e) { return NextResponse.json({ error: (e as Error).message }, { status: 400 }); }
}
export async function POST(req: NextRequest) {
  const user = await identify(req); if (!user) return NextResponse.json({ error: "Inicia sesión." }, { status: 401 });
  try {
    const b = await req.json(), site = inventorySite(b.site), projectId = text(b.projectId), wiId = text(b.wiId);
    const recipeId = productionRecipeKey(site, projectId, wiId), now = new Date().toISOString(), names = inventoryCollections(site);
    const pdos = adminDB.collection("production_pdos"), orders = adminDB.collection("production_orders");
    if (b.action === "create") {
      const id = operation(b.operationId), pdo = text(b.pdo), totalUnits = pdoUnits(b.totalUnits), details = cleanPdoDetails(b.details);
      const fingerprint = createHash("sha256").update(JSON.stringify({ recipeId, pdo, totalUnits, details, uid: user.uid })).digest("hex");
      const unique = adminDB.collection("production_pdo_numbers").doc(createHash("sha256").update(JSON.stringify([recipeId, pdo.toUpperCase()])).digest("hex"));
      await adminDB.runTransaction(async t => {
        const [prior, number, recipeSnap] = await Promise.all([t.get(pdos.doc(id)), t.get(unique), t.get(adminDB.collection("production_recipes").doc(recipeId))]);
        if (prior.exists) { if (prior.data()?.fingerprint !== fingerprint) throw new Error("La operación ya se usó con otros datos."); return; }
        if (number.exists) throw new Error("Esta PDO ya existe en esta WI y almacén. Ábrela para solicitar material.");
        const recipe = recipeSnap.data(); if (!recipe?.lines?.length) throw new Error("Guarda primero una receta para esta WI y almacén.");
        const cs = await t.getAll(...recipe.lines.map((l: { componentId: string }) => adminDB.collection(names.components).doc(l.componentId)));
        const lines = recipe.lines.map((l: { componentId: string; perUnit: number; extraPercent: number }, i: number) => {
          const c = cs[i].data() as InventoryComponent | undefined; if (!c) throw new Error("Un componente ya no existe.");
          requiredQuantity(l.perUnit, 1, l.extraPercent, c.unit);
          return { ...l, code: c.code, name: c.name, unit: c.unit };
        });
        t.create(pdos.doc(id), { recipeId, site, projectId, projectName: recipe.projectName, wiId, wiTitle: recipe.wiTitle, pdo, totalUnits, requestedUnits: 0, recipeVersion: recipe.version, lines, lots: {}, details, createdAt: now, createdBy: user.uid, fingerprint });
        t.create(unique, { pdoId: id });
      });
      return NextResponse.json({ pdoId: id });
    }
    if (b.action === "details") {
      const ref = pdos.doc(operation(b.pdoId)), details = cleanPdoDetails(b.details);
      await adminDB.runTransaction(async t => { const p = await t.get(ref); if (!p.exists || p.data()?.recipeId !== recipeId) throw new Error("PDO no encontrada."); t.update(ref, { details, updatedAt: now, updatedBy: user.uid }); });
      return NextResponse.json({ ok: true });
    }
    if (b.action === "cancel") {
      const ref = orders.doc(operation(b.requestId));
      await adminDB.runTransaction(async t => {
        const order = await t.get(ref), r = order.data();
        if (!r?.pdoId || r.recipeId !== recipeId) throw new Error("Solicitud no encontrada.");
        const [parent, op, profile] = await Promise.all([t.get(pdos.doc(r.pdoId)), t.get(adminDB.collection(names.operations).doc(ref.id)), t.get(adminDB.collection("users").doc(user.uid))]);
        if (r.createdBy !== user.uid && parent.data()?.createdBy !== user.uid && !canMoveInventory(profile.data(), site)) throw new Error("Solo el solicitante o el almacenista puede cancelar.");
        if (r.status === "cancelled") return;
        if (op.exists || r.status !== "pending") throw new Error("El retiro ya fue atendido.");
        t.update(ref, { status: "cancelled", cancelledAt: now, cancelledBy: user.uid });
        t.update(parent.ref, { requestedUnits: Math.max(0, (parent.data()?.requestedUnits || 0) - r.units) });
      });
      return NextResponse.json({ ok: true });
    }
    if (b.action !== "request") throw new Error("Acción inválida.");
    const pdoId = operation(b.pdoId), id = operation(b.operationId), units = pdoUnits(b.units);
    const rawChoices = b.choices;
    if (!rawChoices || typeof rawChoices !== "object" || Array.isArray(rawChoices)) throw new Error("Selecciona un lote por componente.");
    const choices: Record<string, LotChoice> = {};
    for (const [componentId, value] of Object.entries(rawChoices)) { const c = value as LotChoice; choices[text(componentId)] = { lotId: operation(c?.lotId), origin: text(c?.origin) }; }
    const fingerprint = createHash("sha256").update(JSON.stringify({ pdoId, units, choices, uid: user.uid })).digest("hex");
    const emails = await warehouseRecipients(site);
    const created = await adminDB.runTransaction(async t => {
      const [previous, parent] = await Promise.all([t.get(orders.doc(id)), t.get(pdos.doc(pdoId))]);
      if (previous.exists) { if (previous.data()?.fingerprint !== fingerprint || previous.data()?.recipeId !== recipeId) throw new Error("La operación ya se usó con otros datos."); return false; }
      const p = parent.data() as ProductionPdo | undefined;
      if (!p || p.recipeId !== recipeId) throw new Error("PDO no encontrada.");
      if (units > p.totalUnits - p.requestedUnits) throw new Error("La solicitud excede las unidades pendientes de la PDO.");
      if (Object.keys(choices).length !== p.lines.length) throw new Error("Selecciona un lote por cada componente.");
      for (const l of p.lines) { const c = choices[l.componentId], locked = p.lots[l.componentId]; if (!c || (locked && c.lotId !== locked.lotId)) throw new Error(`${l.code}: esta PDO ya tiene lote asignado. Crea otra PDO para cambiarlo.`); }
      const [cs, pending] = await Promise.all([t.getAll(...p.lines.map(l => adminDB.collection(names.components).doc(l.componentId))), t.get(orders.where("site", "==", site))]);
      const components = cs.map(d => ({ ...d.data(), id: d.id } as InventoryComponent));
      const capacity = productionCapacity(p.lines, components, p.projectName, mexicoToday(), pending.docs.map(d => ({ ...d.data(), id: d.id } as ProductionRequest)), choices);
      if (units > capacity.units) throw new Error(`Las existencias disponibles permiten ${capacity.units} unidades con estos lotes. Actualiza la disponibilidad.`);
      const lines = capacity.rows.map(l => ({ componentId: l.componentId, code: l.code, name: l.name, unit: l.unit, perUnit: l.perUnit, extraPercent: l.extraPercent, ...requiredQuantity(l.perUnit, units, l.extraPercent, l.unit), lotId: l.selected!.lotId, lot: l.selected!.lot, origin: l.selected!.origin }));
      const request = { recipeId, site, projectId, projectName: p.projectName, wiId, wiTitle: p.wiTitle, recipeVersion: p.recipeVersion, pdo: p.pdo, pdoId, units, lines, status: "pending", createdAt: now, createdBy: user.uid, fingerprint };
      t.create(orders.doc(id), request);
      t.update(parent.ref, { lots: { ...p.lots, ...choices }, requestedUnits: p.requestedUnits + units, updatedAt: now });
      // All requests sharing a component contend on this document, including requests from another PDO.
      // This prevents simultaneous capacity checks from promising the same stock twice.
      cs.forEach(d => t.update(d.ref, { productionReservationVersion: (d.data()?.productionReservationVersion || 0) + 1 }));
      const url = `/inventario/solicitudes?site=${site}`, message = `PDO ${p.pdo} · ${units} unidades · ${p.projectName} · ${p.wiTitle}`;
      for (const email of emails) t.create(adminDB.collection("notifications").doc(), { userEmail: email, tipo: "production_withdrawal", mensaje: message, requestId: id, url, createdAt: FieldValue.serverTimestamp(), leido: false });
      return true;
    });
    if (created) after(async () => { try { await sendPushToEmails({ emails, title: `Solicitud de retiro · Almacén ${site}`, body: `PDO · ${units} unidades solicitadas`, url: new URL(`/inventario/solicitudes?site=${site}`, req.url).toString() }); } catch (e) { console.error("PDO warehouse push", e); } });
    return NextResponse.json({ requestId: id });
  } catch (e) { return NextResponse.json({ error: (e as Error).message }, { status: 400 }); }
}
