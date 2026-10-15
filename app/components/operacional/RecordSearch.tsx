"use client";
import { useEffect, useState } from "react";
import { opsRequest } from "@/lib/operacional/client";
import type { RecordFilter } from "@/lib/operacional/record-search";
import { Field, inputClass, buttonClass, panelClass, secondaryButtonClass } from "@/app/components/inventario/InventoryShell";
type RecordResult = { id: string; path: string; data: Record<string, unknown> };
export default function RecordSearch() {
  const [collections, setCollections] = useState<string[]>([]), [collection, setCollection] = useState("");
  const [filters, setFilters] = useState<RecordFilter[]>([{ field: "", value: "" }]);
  const [fields, setFields] = useState<string[]>([]), [records, setRecords] = useState<RecordResult[]>([]);
  const [cursor, setCursor] = useState<string | null>(null), [scanned, setScanned] = useState(0);
  const [searched, setSearched] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState(""), [notice, setNotice] = useState("");
  useEffect(() => { void opsRequest("/api/operacional/registros").then(d => { setCollections(d.collections); setCollection(d.collections.includes("inventario_componentes") ? "inventario_componentes" : d.collections[0] || ""); }).catch(e => setError(e.message)); }, []);
  function reset() { setSearched(false); setRecords([]); setCursor(null); setScanned(0); setError(""); setNotice(""); }
  async function search(more = false) {
    setBusy(true); setError(""); setNotice("");
    try {
      const d = await opsRequest("/api/operacional/registros", { collection, filters, ...(more && cursor ? { cursor } : {}) });
      setRecords(previous => more ? [...previous, ...d.records] : d.records);
      setFields(previous => [...new Set<string>([...(more ? previous : []), ...d.fields])].sort());
      setSearched(true); setScanned(previous => (more ? previous : 0) + d.scanned); setCursor(d.cursor);
    } catch (e) { setError(e instanceof Error ? e.message : "No se pudo buscar."); } finally { setBusy(false); }
  }
  async function copy(value: string) { try { await navigator.clipboard.writeText(value); setNotice("Copiado."); } catch { setError("No se pudo copiar. Selecciona el texto para copiarlo manualmente."); } }
  function changeFilter(index: number, patch: Partial<RecordFilter>) { reset(); setFilters(filters.map((f, i) => i === index ? { ...f, ...patch } : f)); }
  return <section className={`${panelClass} space-y-5`}><div><h2 className="text-xl font-semibold">Buscador de registros</h2><p className="mt-2 text-sm text-white/60">Selecciona una colección y combina filtros. La búsqueda ignora mayúsculas y acentos. Consulta de solo lectura.</p></div>
    <form className="space-y-4" onSubmit={e => { e.preventDefault(); void search(); }}>
      <Field label="Colección"><select className={inputClass} disabled={busy} value={collection} onChange={e => { setCollection(e.target.value); setFields([]); reset(); setFilters([{ field: "", value: "" }]); }}>{collections.map(c => <option key={c}>{c}</option>)}</select></Field>
      <datalist id="record-fields"><option value="__id__">ID del documento</option>{fields.map(f => <option key={f} value={f}/>)}</datalist>
      {filters.map((f, i) => <div key={i} className="grid items-end gap-3 sm:grid-cols-[1fr_1fr_auto]"><Field label="Campo (vacío = todos)"><input list="record-fields" className={inputClass} disabled={busy} value={f.field} placeholder="code, name, lots.name o __id__" onChange={e => changeFilter(i, { field: e.target.value })}/></Field><Field label="Contiene"><input className={inputClass} disabled={busy} value={f.value} maxLength={200} placeholder="Ej. Tyvek, MTS-012 o 1526B" onChange={e => changeFilter(i, { value: e.target.value })}/></Field><button type="button" className={secondaryButtonClass} disabled={busy || filters.length === 1} aria-label={`Quitar filtro ${i + 1}`} onClick={() => { reset(); setFilters(filters.filter((_, n) => n !== i)); }}>Quitar</button></div>)}
      <div className="flex flex-wrap gap-3"><button type="button" className={secondaryButtonClass} disabled={busy || filters.length >= 10} onClick={() => { reset(); setFilters([...filters, { field: "", value: "" }]); }}>Agregar filtro</button><button className={buttonClass} disabled={busy || !collection}>{busy ? "Buscando…" : "Buscar registros"}</button></div>
      <p className="text-xs text-white/50">Todos los filtros deben cumplirse. Puedes escribir campos anidados, como lots.name. Los campos sugeridos aparecen al revisar documentos.</p>
    </form>
    {error && <p role="alert" className="text-red-300">{error}</p>}{notice && <p role="status" className="text-emerald-300">{notice}</p>}
    {searched && <p role="status" className="text-sm text-white/70">{records.length} coincidencias en {scanned} documentos revisados. {cursor ? "Búsqueda parcial: quedan documentos por revisar." : "Colección revisada por completo."}</p>}
    {!busy && !searched && !error && <p className="text-sm text-white/50">Selecciona los filtros y presiona Buscar registros.</p>}
    <div className="space-y-3">{records.map(r => <article key={r.path} className="space-y-3 rounded-xl border border-white/15 p-4"><h3 className="font-semibold break-words">{String(r.data.code || r.data.folio || "")} {String(r.data.name || r.data.nombre || r.data.title || r.data.titulo || r.id)}</h3><p className="break-all text-xs text-white/60">ID: {r.id}<br/>Ruta: {r.path}</p><div className="flex flex-wrap gap-2"><button className={secondaryButtonClass} onClick={() => void copy(r.id)}>Copiar ID</button><button className={secondaryButtonClass} onClick={() => void copy(r.path)}>Copiar ruta</button></div><details><summary className="cursor-pointer text-sm text-emerald-300">Ver campos y lotes</summary><pre className="mt-3 max-h-96 overflow-auto whitespace-pre-wrap break-all text-xs text-white/75">{JSON.stringify(r.data, null, 2)}</pre></details></article>)}</div>
    {cursor && <button className={buttonClass} disabled={busy} onClick={() => void search(true)}>{busy ? "Revisando…" : "Revisar siguientes 200 documentos"}</button>}
    {searched && records.length === 0 && <p className="text-sm text-white/60">Sin coincidencias en los documentos revisados.{cursor ? " Continúa revisando la colección." : " Prueba otros filtros."}</p>}
  </section>;
}
