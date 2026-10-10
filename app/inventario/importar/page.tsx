"use client";
import { useEffect, useState } from "react";
import * as XLSX from "xlsx";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/src/firebase/firebaseConfig";
import { canOperate, parseComponentCode } from "@/lib/operacional/catalog";
import { opsRequest } from "@/lib/operacional/client";
import { WAREHOUSES } from "@/lib/inventario/catalogs";
import InventoryShell, { inputClass, buttonClass, panelClass, Field } from "@/app/components/inventario/InventoryShell";
const fields = [['code', 'Código'], ['name', 'Nombre'], ['lot', 'Lote'], ['quantity', 'Cantidad'], ['expiry', 'Caducidad'], ['unit', 'Unidad']] as const;
type Row = {
    source: number;
    code: string;
    name: string;
    lot: string;
    quantity: number;
    expiry: string;
    unit: string;
    warehouse: string;
    error: string;
    selected: boolean;
};
export default function Page() { const [access, setAccess] = useState<boolean | null>(null), [book, setBook] = useState<XLSX.WorkBook | null>(null), [sheet, setSheet] = useState(""), [header, setHeader] = useState(1), [mapping, setMapping] = useState<Record<string, string>>({}), [warehouse, setWarehouse] = useState("aprobado"), [rows, setRows] = useState<Row[]>([]), [error, setError] = useState(""), [notice, setNotice] = useState(""), [busy, setBusy] = useState(false); useEffect(() => onAuthStateChanged(auth, u => setAccess(canOperate(u?.email))), []); const grid: unknown[][] = book && sheet ? XLSX.utils.sheet_to_json(book.Sheets[sheet], { header: 1, raw: true, defval: "" }) : []; const headers = (grid[header - 1] || []).map(String); function preview() { setError(""); setNotice(""); try {
    if (fields.slice(0, 4).some(([key]) => mapping[key] === undefined || mapping[key] === ""))
        throw new Error("Relaciona código, nombre, lote y cantidad con sus columnas.");
    const keys = new Set<string>();
    const result: Row[] = [];
    grid.slice(header).forEach((cells, index) => { const value = (key: string) => mapping[key] !== undefined && mapping[key] !== "" ? cells[Number(mapping[key])] : ""; if (!value("code") && !value("quantity"))
        return; let code = String(value("code") || "").trim(), issue = ""; try {
        code = parseComponentCode(code).code;
    }
    catch (e) {
        issue = e instanceof Error ? e.message : "Código inválido";
    } const lot = String(value("lot") || "").trim(), name = String(value("name") || "").trim(), quantity = Number(String(value("quantity") || "").replace(/,/g, "")), unit = String(value("unit") || "pz").trim(); let expiry = String(value("expiry") || "").trim(); if (typeof value("expiry") === "number") {
        const date = XLSX.SSF.parse_date_code(Number(value("expiry")));
        expiry = date ? `${date.y}-${String(date.m).padStart(2, "0")}-${String(date.d).padStart(2, "0")}` : expiry;
    } if (!lot || !name || !Number.isFinite(quantity) || quantity <= 0)
        issue = issue || "Revisa nombre, lote y cantidad"; if (expiry && !/^\d{4}-\d{2}-\d{2}$/.test(expiry))
        issue = issue || "Caducidad: usa AAAA-MM-DD"; const key = `${code}|${lot.toUpperCase()}`; if (keys.has(key))
        issue = issue || "Código y lote repetidos"; keys.add(key); result.push({ source: header + index + 1, code, name, lot, quantity, expiry, unit, warehouse, error: issue, selected: !issue }); });
    setRows(result);
}
catch (e) {
    setError(e instanceof Error ? e.message : "Error.");
} } if (access === null)
    return <InventoryShell>Cargando…</InventoryShell>; if (!access)
    return <InventoryShell>Esta cuenta no tiene acceso a importaciones.</InventoryShell>; const selected = rows.filter(r => r.selected && !r.error); return <InventoryShell><div><h1 className="text-3xl font-bold">Importar inventario</h1><p className="mt-2 text-sm text-white/50">Carga saldos iniciales desde Excel, una hoja y un almacén por vez. Revisa las filas antes de guardar.</p></div><section className={`${panelClass} space-y-5`}><Field label="Archivo Excel"><input type="file" accept=".xlsx,.xls,.csv" className={inputClass} disabled={busy} onChange={async (e) => { setRows([]); setMapping({}); setError(""); setNotice(""); try {
    const f = e.target.files?.[0];
    if (!f)
        return;
    if (f.size > 10 * 1024 * 1024)
        throw new Error("El archivo debe pesar menos de 10 MB.");
    const b = XLSX.read(await f.arrayBuffer(), { type: "array" });
    setBook(b);
    setSheet(b.SheetNames[0] || "");
}
catch (e) {
    setBook(null);
    setError(e instanceof Error ? e.message : "Archivo inválido.");
} }}/></Field>{book && <><div className="grid gap-4 sm:grid-cols-3"><Field label="Hoja"><select className={inputClass} value={sheet} onChange={e => { setSheet(e.target.value); setRows([]); setMapping({}); }}>{book.SheetNames.map(s => <option key={s}>{s}</option>)}</select></Field><Field label="Fila de encabezados"><input type="number" min={1} max={grid.length || 1} className={inputClass} value={header} onChange={e => { setHeader(Math.max(1, Number(e.target.value))); setRows([]); setMapping({}); }}/></Field><Field label="Almacén de estas existencias"><select className={inputClass} value={warehouse} onChange={e => { setWarehouse(e.target.value); setRows([]); }}>{WAREHOUSES.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}</select></Field></div><div className="grid gap-4 sm:grid-cols-3">{fields.map(([key, label]) => <Field key={key} label={`${label}${key === "expiry" || key === "unit" ? " (opcional)" : ""}`}><select value={mapping[key] ?? ""} className={inputClass} onChange={e => { setMapping({ ...mapping, [key]: e.target.value }); setRows([]); }}><option value="">Seleccionar columna</option>{headers.map((h, i) => <option key={i} value={i}>{XLSX.utils.encode_col(i)} · {h || "Sin título"}</option>)}</select></Field>)}</div><p className="text-xs text-white/50">Sin columna de unidad se usará pz. Sin caducidad se dejará vacía. Verifica que hojas como SSC no repitan existencias de otros almacenes.</p><button className={buttonClass} onClick={preview}>Revisar filas</button></>}</section>{error && <p role="alert" className="text-red-300">{error}</p>}{notice && <p role="status" className="text-emerald-300">{notice}</p>}{rows.length > 0 && <section className={`${panelClass} space-y-4`}><h2 className="font-semibold">Revisión · {selected.length} filas seleccionadas</h2><div className="max-h-[500px] overflow-auto"><table className="w-full text-left text-sm"><thead><tr>{['Incluir', 'Fila', 'Código / Nombre', 'Lote', 'Cantidad', 'Caducidad', 'Revisión'].map(h => <th className="p-3" key={h}>{h}</th>)}</tr></thead><tbody>{rows.map((r, i) => <tr className="border-t border-white/10" key={r.source}><td className="p-3"><input aria-label={`Incluir fila ${r.source}`} type="checkbox" checked={r.selected} disabled={!!r.error || busy} onChange={e => setRows(rows.map((x, j) => j === i ? { ...x, selected: e.target.checked } : x))}/></td><td className="p-3">{r.source}</td><td className="p-3">{r.code}<small className="block text-white/45">{r.name}</small></td><td className="p-3">{r.lot}</td><td className="p-3">{r.quantity} {r.unit}</td><td className="p-3">{r.expiry || "Sin fecha"}</td><td className="p-3 text-red-300">{r.error}</td></tr>)}</tbody></table></div><p className="text-xs text-white/45">Máximo 200 filas por carga. Los lotes existentes se rechazan para evitar duplicar saldos. Esta carga queda registrada como saldo inicial.</p><button disabled={busy || !selected.length || selected.length > 200} className={buttonClass} onClick={async () => { setBusy(true); setError(""); try {
    await opsRequest("/api/inventario/importar", { rows: selected.map(({ source, error, selected, ...r }) => r) });
    setNotice(`${selected.length} filas importadas.`);
    setRows(rows.filter(r => !r.selected));
}
catch (e) {
    setError(e instanceof Error ? e.message : "Error.");
}
finally {
    setBusy(false);
} }}>{busy ? "Importando…" : `Importar ${selected.length} filas seleccionadas`}</button></section>}</InventoryShell>; }
