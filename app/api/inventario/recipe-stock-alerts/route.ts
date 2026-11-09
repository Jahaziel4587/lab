import { timingSafeEqual } from "node:crypto";
import { FieldValue } from "firebase-admin/firestore";
import { adminDB } from "@/lib/firebaseAdmin";
import { sendPushToEmails } from "@/lib/pushNotifications";
import { forecastRecipeStock } from "@/lib/inventario/recipe-stock-forecast";
import { mexicoToday } from "@/lib/inventario/selection";
import { INVENTORY_SITES, inventoryCollections, inventoryHref } from "@/lib/inventario/sites";
import { warehouseRecipients } from "@/lib/inventario/storage-server";
import type { FixedRecipe } from "@/lib/inventario/fixed-recipes";
import type { InventoryComponent } from "@/lib/inventario/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const received = Buffer.from(request.headers.get("authorization") || "");
  const expected = Buffer.from(`Bearer ${secret || ""}`);
  if (!secret || received.length !== expected.length || !timingSafeEqual(received, expected)) {
    return Response.json({ error: "No autorizado." }, { status: 401 });
  }

  const today = mexicoToday();
  const sites = await Promise.allSettled(INVENTORY_SITES.map(async ({ id: site }) => {
    const { components } = inventoryCollections(site);
    const state = adminDB.collection(`${components}_recipe_stock_alerts`);
    const [recipes, materials, open, emails] = await Promise.all([
      adminDB.collection(`${components}_fixed_recipes`).where("active", "==", true).get(),
      adminDB.collection(components).get(),
      state.where("active", "==", true).get(),
      warehouseRecipients(site),
    ]);
    const warnings = forecastRecipeStock(
      materials.docs.map(doc => ({ ...doc.data(), id: doc.id } as InventoryComponent)),
      recipes.docs.map(doc => ({ ...doc.data(), id: doc.id } as FixedRecipe)),
      today,
    );
    const warningIds = new Set(warnings.map(warning => warning.componentId));
    // Re-arm the alert after replenishment or a change in forecast removes the risk.
    for (const doc of open.docs) {
      if (!warningIds.has(doc.id)) await doc.ref.update({ active: false, resolvedOn: today });
    }

    let sent = 0;
    for (const warning of warnings) {
      if (!emails.length) break;
      const ref = state.doc(warning.componentId);
      const date = warning.date.split("-").reverse().join("/");
      const message = `${site} · ${warning.code} ${warning.name}: según el consumo de las recetas fijas, ${warning.shortfall ? `el ${date} faltarán ${warning.shortfall} ${warning.unit}` : `las existencias se agotarán el ${date}`}. Revisa la reposición.`;
      const url = inventoryHref(`/inventario/components/${warning.componentId}`, site);
      const created = await adminDB.runTransaction(async transaction => {
        if ((await transaction.get(ref)).data()?.active) return false;
        transaction.set(ref, { active: true, forecastDate: warning.date, alertedOn: today });
        for (const email of emails) {
          transaction.create(adminDB.collection("notifications").doc(), {
            userEmail: email, tipo: "inventory_recipe_stock_warning", mensaje: message, url,
            createdAt: FieldValue.serverTimestamp(), leido: false,
          });
        }
        return true;
      });
      if (!created) continue;
      sent++;
      try {
        await sendPushToEmails({ emails, title: "Faltante previsto de inventario", body: message, url: new URL(url, request.url).toString() });
      } catch (error) {
        console.error("Inventory recipe stock warning push", error);
      }
    }
    return { site, warnings: warnings.length, sent };
  }));
  const failed = sites.some(result => result.status === "rejected");
  for (const result of sites) if (result.status === "rejected") console.error("Inventory recipe stock forecast", result.reason);
  return Response.json({ sites: sites.flatMap(result => result.status === "fulfilled" ? [result.value] : []), failed }, { status: failed ? 500 : 200 });
}
