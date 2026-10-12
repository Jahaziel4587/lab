import { auth } from "@/src/firebase/firebaseConfig";
export async function productionCatalog<T>(site: string, body?: object, projectId?: string, scope?: string): Promise<T> {
  if (!auth.currentUser) throw new Error("Inicia sesión.");
  const q = new URLSearchParams({ site }); if (scope) q.set("scope",scope); if (projectId) q.set("projectId", projectId);
  const r = await fetch(`/api/production/catalog?${q}`, { method: body ? "POST" : "GET", headers: { Authorization: `Bearer ${await auth.currentUser.getIdToken()}`, "Content-Type": "application/json" }, ...(body ? { body: JSON.stringify({ ...body, site }) } : {}) });
  const d = await r.json(); if (!r.ok) throw new Error(d.error); return d;
}
