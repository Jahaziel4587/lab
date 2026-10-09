import { auth } from "@/src/firebase/firebaseConfig";
export async function inventoryRequest<T>(body?: unknown, query = ""): Promise<T> {
  const user = auth.currentUser;
  if (!user) throw new Error("Inicia sesión para usar el inventario.");
  const response = await fetch(`/api/inventario${query}`, {
    method: body ? "POST" : "GET", cache: "no-store",
    headers: { Authorization: `Bearer ${await user.getIdToken()}`, "Content-Type": "application/json" },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || "No se pudo guardar el inventario.");
  return result;
}
