import { adminAuth, adminDB } from "@/lib/firebaseAdmin";
import { DEFAULT_PROJECTS, type Project, canOperate } from "./catalog";
import { NextRequest } from "next/server";
export async function identify(req: NextRequest) { try {
    const h = req.headers.get("authorization") || "";
    if (!h.startsWith("Bearer "))
        return null;
    return await adminAuth.verifyIdToken(h.slice(7), true);
}
catch {
    return null;
} }
export async function projectCatalog(): Promise<Project[]> { const snap = await adminDB.collection("operacional_proyectos").get(); const map = new Map(DEFAULT_PROJECTS.map(p => [p.code, p])); snap.docs.forEach(d => map.set(d.id, { ...d.data(), code: d.id } as Project)); return [...map.values()].sort((a, b) => a.code.localeCompare(b.code)); }
export { canOperate };
