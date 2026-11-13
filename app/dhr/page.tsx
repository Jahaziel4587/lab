"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import PizZip from "pizzip";
import { useAuth } from "@/src/Context/AuthContext";

type Project = { id: string; title: string };
type Pdf = { id: string; name: string; path: string; queries: string[] };
type Results = { files: Pdf[]; missing: string[] };
const control = "w-full rounded-xl border border-white/20 bg-slate-900 p-3 text-white focus:outline-none focus:ring-2 focus:ring-emerald-400";
const button = "rounded-xl bg-emerald-500 px-5 py-3 font-semibold text-slate-950 disabled:cursor-not-allowed disabled:opacity-40";

export default function DhrPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectId, setProjectId] = useState("");
  const [names, setNames] = useState("");
  const [results, setResults] = useState<Results | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [error, setError] = useState("");
  const [progress, setProgress] = useState("");
  const [reload, setReload] = useState(0);

  useEffect(() => {
    if (!loading && !user) router.replace("/login");
  }, [loading, user, router]);

  useEffect(() => {
    if (!user) return;
    let active = true;
    setCatalogLoading(true);
    setError("");
    (async () => {
      try {
        const token = await user.getIdToken();
        const response = await fetch("/api/box/catalog?scope=projects", { headers: { Authorization: `Bearer ${token}` } });
        const data = await response.json();
        if (!response.ok) throw new Error("No se pudo cargar el catálogo DMR de Box.");
        if (active) setProjects(data.projects);
      } catch (err) {
        if (active) setError(err instanceof Error ? err.message : "No se pudo cargar Box.");
      } finally { if (active) setCatalogLoading(false); }
    })();
    return () => { active = false; };
  }, [user, reload]);

  function clearResults() { setResults(null); setSelected([]); setProgress(""); setError(""); }

  async function search() {
    if (!user) return;
    setBusy(true); clearResults();
    setProgress("Buscando en las carpetas y subcarpetas del DMR…");
    try {
      const token = await user.getIdToken();
      const response = await fetch("/api/dhr/search", {
        method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ projectId, queries: names.split(/\r?\n/).map(name => name.trim()).filter(Boolean) }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "No se pudo buscar.");
      setResults(data); setSelected([]);
      setProgress(`${data.files.length} PDF encontrados. Selecciona los documentos y revisiones que necesitas.`);
    } catch (err) { setError(err instanceof Error ? err.message : "Error de búsqueda."); setProgress(""); }
    finally { setBusy(false); }
  }

  async function download() {
    if (!user || !results) return;
    setBusy(true); setError("");
    try {
      const files = results.files.filter(file => selected.includes(file.id));
      const zip = new PizZip();
      const manifest = [];
      let totalBytes = 0;
      for (let index = 0; index < files.length; index++) {
        const file = files[index];
        setProgress(`Descargando ${index + 1} de ${files.length}: ${file.name}`);
        const token = await user.getIdToken();
        const response = await fetch(`/api/dhr/file?projectId=${projectId}&fileId=${file.id}`, { headers: { Authorization: `Bearer ${token}` } });
        if (!response.ok) {
          const data = await response.json();
          throw new Error(`${file.name}: ${data.error || "No se pudo descargar."} No se generó un ZIP incompleto.`);
        }
        const bytes = await response.arrayBuffer();
        if (String.fromCharCode(...new Uint8Array(bytes.slice(0, 5))) !== "%PDF-") throw new Error(`${file.name}: Box no devolvió un PDF válido.`);
        totalBytes += bytes.byteLength;
        if (totalBytes > 150 * 1024 * 1024) throw new Error("La selección supera 150 MB. Descarga los documentos en grupos más pequeños.");
        const filename = `${String(index + 1).padStart(3, "0")}-${file.id}-${file.name.replace(/[\\/:*?"<>|\u0000-\u001f]/g, "_")}`;
        zip.file(filename, bytes);
        manifest.push({ archivo: filename, nombreBox: file.name, carpeta: file.path, boxFileId: file.id, boxVersionId: response.headers.get("X-Box-Version-Id"), busquedas: file.queries });
      }
      zip.file("documentos.json", JSON.stringify({ proyecto: projects.find(p => p.id === projectId)?.title, generado: new Date().toISOString(), documentos: manifest, noEncontrados: results.missing }, null, 2));
      setProgress("Preparando ZIP…");
      const blob = zip.generate({ type: "blob", compression: "STORE" });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url; anchor.download = `DHR-${projectId}-${new Date().toISOString().slice(0, 10)}.zip`;
      document.body.appendChild(anchor); anchor.click(); anchor.remove();
      setTimeout(() => URL.revokeObjectURL(url), 60000);
      setProgress(`ZIP generado con ${files.length} PDF.`);
    } catch (err) { setError(err instanceof Error ? err.message : "No se pudo generar el ZIP."); setProgress(""); }
    finally { setBusy(false); }
  }

  if (loading || !user) return null;
  return (
    <main className="mx-auto w-full max-w-5xl space-y-6 px-4 py-8 text-white sm:px-6">
      <Link href="/" className="text-sm text-emerald-300">← Inicio</Link>
      <div><h1 className="text-3xl font-semibold">DHR</h1><p className="mt-2 text-white/70">Busca documentos del DMR y descarga los PDF originales juntos en un ZIP.</p></div>
      <section className="space-y-5 rounded-2xl border border-white/15 bg-slate-950/60 p-4 sm:p-6">
        <label className="block space-y-2"><span>Proyecto DMR</span>
          <select className={control} value={projectId} disabled={busy || catalogLoading} onChange={event => { setProjectId(event.target.value); clearResults(); }}>
            <option value="">{catalogLoading ? "Cargando proyectos…" : "Selecciona un proyecto"}</option>
            {projects.map(project => <option key={project.id} value={project.id}>{project.title}</option>)}
          </select>
        </label>
        {!catalogLoading && !projects.length && <div className="text-sm text-white/70">No hay proyectos disponibles. <button className="text-emerald-300 underline" onClick={() => setReload(value => value + 1)}>Reintentar</button></div>}
        <label className="block space-y-2"><span>Nombres o códigos de documentos</span>
          <textarea className={control} rows={6} value={names} disabled={busy} placeholder={"Escribe un nombre o código por línea"} onChange={event => { setNames(event.target.value); clearResults(); }} />
        </label>
        <p className="text-sm text-white/60">Puedes usar el nombre completo o una parte del nombre. Se buscan únicamente PDF dentro del proyecto y sus subcarpetas. Si hay varias coincidencias o revisiones, selecciona las correctas.</p>
        <button className={button} disabled={busy || !projectId || !names.trim()} onClick={search}>{busy ? "Procesando…" : "Buscar PDF"}</button>
      </section>
      {error && <p role="alert" className="rounded-xl border border-red-400/40 bg-red-950/40 p-4 text-red-200">{error}</p>}
      {progress && <p role="status" aria-live="polite" className="break-words text-emerald-200">{progress}</p>}
      {results && <section className="space-y-4">
        {results.missing.length > 0 && <div className="rounded-xl border border-amber-400/30 bg-amber-950/30 p-4"><h2 className="font-semibold text-amber-200">Sin coincidencias ({results.missing.length})</h2><ul className="mt-2 list-disc space-y-1 pl-5">{results.missing.map(name => <li className="break-words" key={name}>{name}</li>)}</ul><p className="mt-2 text-sm text-white/70">Revisa el nombre y el acceso a la carpeta. La descarga incluirá solo los PDF seleccionados.</p></div>}
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="mr-auto text-xl font-semibold">Documentos encontrados ({results.files.length})</h2>
          <button disabled={busy} className="rounded-lg border border-white/25 px-3 py-2" onClick={() => setSelected(results.files.map(file => file.id))}>Seleccionar todos</button>
          <button disabled={busy} className="rounded-lg border border-white/25 px-3 py-2" onClick={() => setSelected([])}>Limpiar selección</button>
        </div>
        {results.files.map(file => <label key={file.id} className="flex cursor-pointer items-start gap-3 rounded-xl border border-white/15 bg-slate-950/50 p-4">
          <input type="checkbox" className="mt-1 h-5 w-5 shrink-0 accent-emerald-400" checked={selected.includes(file.id)} disabled={busy} onChange={event => setSelected(previous => event.target.checked ? [...previous, file.id] : previous.filter(id => id !== file.id))} />
          <span className="min-w-0"><span className="block break-words font-medium">{file.name}</span><span className="mt-1 block break-words text-sm text-white/60">{file.path}</span><span className="mt-1 block break-words text-xs text-emerald-200">Coincide con: {file.queries.join(" · ")}</span></span>
        </label>)}
        <button className={`${button} w-full sm:w-auto`} disabled={busy || !selected.length} onClick={download}>Descargar ZIP ({selected.length} PDF)</button>
      </section>}
    </main>
  );
}
