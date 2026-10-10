import { NextRequest, NextResponse } from "next/server";
import { adminDB } from "@/lib/firebaseAdmin";
import { identify, projectCatalog, canOperate } from "@/lib/operacional/server";
import { PROCESSES, DEFAULT_PROJECTS } from "@/lib/operacional/catalog";
export const dynamic = "force-dynamic";
export async function GET(req: NextRequest) { const u = await identify(req); if (!u)
    return NextResponse.json({ error: "Inicia sesión." }, { status: 401 }); if (!canOperate(u.email))
    return NextResponse.json({ error: "Sin acceso al apartado operacional." }, { status: 403 }); try {
    const [projects, users] = await Promise.all([projectCatalog(), adminDB.collection("users").get()]);
    return NextResponse.json({ projects, users: users.docs.map(d => { const x = d.data(); return { id: d.id, email: x.email || x.correo || "", name: x.displayName || [x.nombre, x.apellido].filter(Boolean).join(" "), role: x.role || "user", isDesigner: !!x.isDesigner, isQualityManager: !!x.isQualityManager, processOwnerOf: x.processOwnerOf || [], pmProjects: x.pmProjects || [], version: x.opsVersion || 0 }; }) });
}
catch {
    return NextResponse.json({ error: "No se pudo cargar Operacional." }, { status: 500 });
} }
export async function POST(req: NextRequest) { const u = await identify(req); if (!u)
    return NextResponse.json({ error: "Inicia sesión." }, { status: 401 }); if (!canOperate(u.email))
    return NextResponse.json({ error: "Sin acceso." }, { status: 403 }); try {
    const b = await req.json();
    const audit = adminDB.collection("operacional_auditoria").doc();
    const at = new Date().toISOString();
    if (b.action === "user") {
        if (typeof b.id !== "string" || !b.id || b.id.includes("/") || typeof b.isDesigner !== "boolean" || typeof b.isQualityManager !== "boolean" || !Array.isArray(b.processOwnerOf) || b.processOwnerOf.some((v: unknown) => typeof v !== "string" || !PROCESSES.includes(v)))
            throw new Error("Categorías inválidas.");
        const ref = adminDB.collection("users").doc(b.id);
        await adminDB.runTransaction(async (t) => { const s = await t.get(ref); if (!s.exists)
            throw new Error("Usuario inexistente."); if ((s.data()?.opsVersion || 0) !== b.version)
            throw new Error("El usuario cambió. Recarga antes de guardar."); const fields = { isDesigner: b.isDesigner, isQualityManager: b.isQualityManager, processOwnerOf: [...new Set(b.processOwnerOf)], opsVersion: b.version + 1 }; t.update(ref, fields); t.create(audit, { action: "user", target: b.id, fields, before: { isDesigner: !!s.data()?.isDesigner, isQualityManager: !!s.data()?.isQualityManager, processOwnerOf: s.data()?.processOwnerOf || [] }, actor: u.uid, at }); });
    }
    else if (b.action === "project") {
        const code = String(b.code || "").trim().toUpperCase(), name = String(b.name || "").trim();
        if (!/^(?:\d{3}|E\d{3}|OTRO)$/.test(code) || !name || name.length > 100 || typeof b.active !== "boolean" || !Array.isArray(b.pmIds) || b.pmIds.some((id: unknown) => typeof id !== "string" || !id || id.includes("/")))
            throw new Error("Proyecto inválido.");
        const ref = adminDB.collection("operacional_proyectos").doc(code);
        await adminDB.runTransaction(async (t) => { const [s, users] = await Promise.all([t.get(ref), t.get(adminDB.collection("users"))]); const prior = s.exists ? s.data() : DEFAULT_PROJECTS.find(p => p.code === code); if ((prior?.version || 0) !== b.version)
            throw new Error("El proyecto cambió. Recarga antes de guardar."); if (b.pmIds.some((id: string) => !users.docs.some(d => d.id === id)))
            throw new Error("PM inexistente."); const label = prior?.label || (code === "OTRO" ? name : `${code}.${name}`); const changed = users.docs.filter(d => { const current = (d.data().pmProjects || []).includes(label); return current !== b.pmIds.includes(d.id); }); if (changed.length > 450)
            throw new Error("Demasiados PMs en una operación."); const fields = { code, name, label, image: prior?.image || "/Bioana.jpeg", active: b.active, version: b.version + 1 }; t.set(ref, fields); for (const d of changed) {
            const x = d.data();
            const labels = (x.pmProjects || []).filter((p: string) => p !== label);
            if (b.pmIds.includes(d.id))
                labels.push(label);
            t.update(d.ref, { pmProjects: labels, opsVersion: (x.opsVersion || 0) + 1 });
        } t.create(audit, { action: "project", target: code, fields, pmIds: b.pmIds, actor: u.uid, at }); });
    }
    else
        throw new Error("Acción inválida.");
    return NextResponse.json({ ok: true });
}
catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "No se pudo guardar." }, { status: 400 });
} }
