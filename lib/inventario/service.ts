import { inventorySite, type InventorySite } from "./sites";
import { auth } from "@/src/firebase/firebaseConfig";
export async function inventoryRequest<T>(body?: unknown, query = "", selectedSite?: InventorySite): Promise<T> {
  const user = auth.currentUser;
  if (!user) throw new Error("Inicia sesión para usar el inventario.");
  const bodySite = body && typeof body === "object" && "site" in body ? inventorySite(body.site) : undefined;
  const site = selectedSite || bodySite || inventorySite(typeof window === "undefined" ? null : new URLSearchParams(window.location.search).get("site"));
  const params = new URLSearchParams(query); params.set("site", site);
  const response = await fetch(`/api/inventario?${params}`, {
    method: body ? "POST" : "GET", cache: "no-store",
    headers: { Authorization: `Bearer ${await user.getIdToken()}`, "Content-Type": "application/json" },
    ...(body ? { body: JSON.stringify({ ...(body as Record<string, unknown>), site }) } : {}),
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || "No se pudo guardar el inventario.");
  return result;
}
