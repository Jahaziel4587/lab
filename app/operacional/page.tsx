"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/src/firebase/firebaseConfig";
import { canOperate, PROCESSES, type Project } from "@/lib/operacional/catalog";
import { opsRequest } from "@/lib/operacional/client";
import { Field, inputClass, buttonClass, panelClass, secondaryButtonClass } from "@/app/components/inventario/InventoryShell";
type User = {
    id: string;
    email: string;
    name: string;
    role: string;
    isDesigner: boolean;
    isQualityManager: boolean;
    processOwnerOf: string[];
    pmProjects: string[];
    version: number;
};
export default function Page() { const [access, setAccess] = useState<boolean | null>(null), [projects, setProjects] = useState<Project[]>([]), [users, setUsers] = useState<User[]>([]), [project, setProject] = useState<Project | null>(null), [selected, setSelected] = useState<User | null>(null), [pmIds, setPmIds] = useState<string[]>([]), [error, setError] = useState(""), [notice, setNotice] = useState(""), [busy, setBusy] = useState(false), [tab, setTab] = useState("projects"), [search, setSearch] = useState(""); async function reload() { const d = await opsRequest("/api/operacional"); setProjects(d.projects); setUsers(d.users); } useEffect(() => onAuthStateChanged(auth, u => { const allowed = canOperate(u?.email); setAccess(allowed); if (allowed)
    void reload().catch(e => setError(e.message));
else {
    setUsers([]);
    setProjects([]);
} }), []); async function save(body: unknown) { setBusy(true); setError(""); setNotice(""); try {
    await opsRequest("/api/operacional", body);
    await reload();
    setProject(null);
    setSelected(null);
    setNotice("Cambios guardados.");
}
catch (e) {
    setError(e instanceof Error ? e.message : "Error.");
}
finally {
    setBusy(false);
} } if (access === null)
    return <main className="p-8 text-white">Cargando…</main>; if (!access)
    return <main className="p-8 text-white">Esta cuenta no tiene acceso a Operacional.</main>; return <main className="mx-auto max-w-7xl space-y-6 px-4 py-8 text-white sm:px-8"><Link href="/" className={secondaryButtonClass}>← Volver</Link><div><h1 className="text-3xl font-bold">Operacional</h1><p className="mt-2 text-sm text-white/50">Proyectos, project managers y categorías de usuarios.</p></div><nav className="flex gap-2">{[["projects", "Proyectos y PMs"], ["users", "Usuarios"]].map(([id, label]) => <button key={id} onClick={() => { setTab(id); setSearch(""); }} className={tab === id ? buttonClass : secondaryButtonClass}>{label}</button>)}</nav>{error && <p role="alert" className="text-red-300">{error}</p>}{notice && <p role="status" className="text-emerald-300">{notice}</p>}<input className={inputClass} placeholder={tab === "projects" ? "Buscar proyecto" : "Buscar usuario o correo"} value={search} onChange={e => setSearch(e.target.value)}/><div className="grid gap-6 lg:grid-cols-2"><section className={panelClass}>{tab === "projects" ? <><div className="mb-4 flex items-center justify-between"><h2 className="font-semibold">Proyectos</h2><button className={buttonClass} onClick={() => { setProject({ code: "", name: "", label: "", image: "/Bioana.jpeg", active: true, version: 0 }); setPmIds([]); }}>Nuevo proyecto</button></div><div className="max-h-[600px] overflow-auto">{projects.filter(p => `${p.code} ${p.name}`.toLowerCase().includes(search.toLowerCase())).map(p => <button key={p.code} className="block w-full border-b border-white/10 p-3 text-left hover:bg-white/5" onClick={() => { setProject(p); setPmIds(users.filter(u => u.pmProjects.includes(p.label)).map(u => u.id)); }}><div className="font-medium">{p.code} · {p.name}</div><div className="mt-1 text-xs text-white/45">{p.active ? "Activo" : "Inactivo"} · {users.filter(u => u.pmProjects.includes(p.label)).length} PMs</div></button>)}</div></> : <><h2 className="mb-4 font-semibold">Usuarios registrados</h2><div className="max-h-[600px] overflow-auto">{users.filter(u => `${u.name} ${u.email}`.toLowerCase().includes(search.toLowerCase())).map(u => <button key={u.id} className="block w-full border-b border-white/10 p-3 text-left hover:bg-white/5" onClick={() => setSelected({ ...u })}><div>{u.name || u.email}</div><div className="text-xs text-white/45">{u.email} · {u.role}</div></button>)}</div></>}</section><section className={panelClass}>{tab === "projects" && project ? <form className="space-y-5" onSubmit={e => { e.preventDefault(); void save({ action: "project", ...project, pmIds }); }}><h2 className="text-lg font-semibold">{project.label ? "Editar proyecto" : "Nuevo proyecto"}</h2><Field label="Número de proyecto"><input className={inputClass} value={project.code} disabled={!!project.label} required placeholder="001" onChange={e => setProject({ ...project, code: e.target.value })}/></Field><Field label="Nombre"><input className={inputClass} value={project.name} required maxLength={100} onChange={e => setProject({ ...project, name: e.target.value })}/></Field><label className="flex gap-2"><input type="checkbox" checked={project.active} onChange={e => setProject({ ...project, active: e.target.checked })}/>Disponible para nuevos pedidos</label><fieldset><legend className="mb-3 font-medium">Project managers</legend><div className="max-h-72 space-y-2 overflow-auto">{users.map(u => <label key={u.id} className="flex gap-3 rounded-xl bg-white/5 p-3 text-sm"><input type="checkbox" checked={pmIds.includes(u.id)} onChange={e => setPmIds(e.target.checked ? [...pmIds, u.id] : pmIds.filter(id => id !== u.id))}/><span>{u.name || u.email}<small className="block text-white/40">{u.email}</small></span></label>)}</div></fieldset><button disabled={busy} className={buttonClass}>{busy ? "Guardando…" : "Guardar proyecto"}</button></form> : tab === "users" && selected ? <form className="space-y-5" onSubmit={e => { e.preventDefault(); void save({ action: "user", ...selected }); }}><h2 className="text-lg font-semibold">{selected.name || selected.email}</h2><p className="text-sm text-white/50">{selected.email} · {selected.role} (solo lectura)</p>{([['isDesigner', 'Diseñador'], ['isQualityManager', 'Quality Manager']] as const).map(([key, label]) => <label className="flex gap-3" key={key}><input type="checkbox" checked={selected[key]} onChange={e => setSelected({ ...selected, [key]: e.target.checked })}/>{label}</label>)}<fieldset><legend className="mb-3">Encargado de proceso</legend>{PROCESSES.map(p => <label key={p} className="mb-3 flex gap-3"><input type="checkbox" checked={selected.processOwnerOf.includes(p)} onChange={e => setSelected({ ...selected, processOwnerOf: e.target.checked ? [...selected.processOwnerOf, p] : selected.processOwnerOf.filter(x => x !== p) })}/>{p}</label>)}</fieldset><p className="text-xs text-white/45">PM de: {selected.pmProjects.join(", ") || "Sin asignaciones"}. Gestiona las asignaciones en Proyectos y PMs.</p><button disabled={busy} className={buttonClass}>{busy ? "Guardando…" : "Guardar categorías"}</button></form> : <p className="text-white/45">Selecciona {tab === "projects" ? "un proyecto" : "un usuario"} para editarlo.</p>}</section></div></main>; }
