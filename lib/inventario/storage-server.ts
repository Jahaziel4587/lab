import { adminDB } from "@/lib/firebaseAdmin";
import { FieldValue, type Transaction } from "firebase-admin/firestore";
import { sendPushToEmails } from "@/lib/pushNotifications";
import { inventoryCollections, inventoryHref, type InventorySite } from "./sites";
import { affectedLots, conditionsDiffer } from "./storage";
import type { InventoryComponent, Lot } from "./types";

export async function warehouseRecipients(site: InventorySite) {
  const users = await adminDB.collection("users").where("warehouseSites", "array-contains", site).get();
  return [...new Set(users.docs.map(d => String(d.data().email || d.data().correo || "").toLowerCase()).filter(Boolean))];
}
export function applyStorage(t: Transaction, component: InventoryComponent, next: Pick<Lot, "temperatureCondition" | "humidityCondition">, site: InventorySite, actor: string, emails: string[], alerts: Array<{id: string; message: string; url: string}>) {
  if (!conditionsDiffer(component, next)) return;
  const lots = affectedLots(component, next);
  if (lots.length) {
    const ref = adminDB.collection(`${inventoryCollections(site).components}_storage_reviews`).doc();
    const url = inventoryHref(`/inventario/components/${component.id}`, site) + "&section=storage";
    const message = `${component.code}: revisar ${lots.length} lotes por cambio de almacenamiento. Temperatura: ${next.temperatureCondition}; humedad: ${next.humidityCondition}.`;
    t.create(ref, { componentId: component.id, site, actor, before: { temperatureCondition: component.temperatureCondition || "", humidityCondition: component.humidityCondition || "" }, after: next, lots: lots.map(l => ({ id: l.id, name: l.name, temperatureCondition: l.temperatureCondition || "", humidityCondition: l.humidityCondition || "" })), message, status: "pending", createdAt: new Date().toISOString() });
    for (const email of emails) {
      const notification = adminDB.collection("notifications").doc();
      t.create(notification, { userEmail: email, tipo: "inventory_storage_review", mensaje: message, url, createdAt: FieldValue.serverTimestamp(), leido: false });
    }
    alerts.push({ id: ref.id, message, url });
  }
  Object.assign(component, next);
}
export async function pushStorageAlerts(alerts: Array<{message: string; url: string}>, emails: string[], requestUrl: string) {
  for (const alert of alerts) {
    try { await sendPushToEmails({ emails, title: "Revisar condiciones de almacenamiento", body: alert.message, url: new URL(alert.url, requestUrl).toString() }); }
    catch (error) { console.error("Inventory storage push", error); }
  }
}
