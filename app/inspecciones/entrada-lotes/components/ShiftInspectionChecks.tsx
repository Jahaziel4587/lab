"use client";
import { useState } from "react";
import { doc, runTransaction } from "firebase/firestore";
import { db } from "@/src/firebase/firebaseConfig";
import { useAuth } from "@/src/Context/AuthContext";
import type { IncomingInspectionContext, IncomingInspectionLot, IncomingLotReport } from "../types";
import { incomingMethodLabel } from "../qmsReportData";
import { shiftInspectionKey } from "../shiftRejections";
export default function ShiftInspectionChecks({ context, lot, reports }: { context: IncomingInspectionContext; lot: IncomingInspectionLot; reports: IncomingLotReport[] }) {
 const { user } = useAuth(); const plans = lot.methodPlans.filter(p => p.perShift);
 const [method, setMethod] = useState(plans[0]?.method || "visual"), [shift, setShift] = useState(""), [number, setNumber] = useState(""), [error, setError] = useState(""); const [saving, setSaving] = useState(false);
 if (!plans.length) return null;
 const save = async () => {
  try {
   setSaving(true); setError(""); const plan = plans.find(p => p.method === method), n = Number(number);
   if (!user || !plan || !shift.trim() || !Number.isInteger(n) || n < 1 || n > Number(plan.inspectionsPerShift)) throw Error("Identifica el turno y el número de inspección válido.");
   await runTransaction(db, async t => {
    const ref = doc(db, "inspection_incoming_lots", context.scopeKey, "lots", lot.id), snap = await t.get(ref), data = snap.data();
    if (data?.status !== "in_progress") throw Error("El lote está finalizado.");
    const checks = data.shiftChecks || [];
    if (checks.some((c: { method: string; shiftIdentifier: string; inspectionNumber: number }) => c.method === method && c.shiftIdentifier === shift.trim() && c.inspectionNumber === n)) throw Error("Esta inspección ya se registró.");
    const key = shiftInspectionKey(method, shift, n);
    const oldReports = reports.filter(r => r.kind === "spec_rejection" && r.inspectionMethod === method && r.shiftIdentifier === shift.trim() && r.shiftInspectionNumber === n);
    const legacyCount = oldReports.reduce((sum, r) => sum + (r.mode === "quantity" ? r.quantity || 0 : 0), 0) + new Set(oldReports.filter(r => r.mode === "sample_number").map(r => r.sampleNumber)).size;
    const rejected = Number(data.shiftRejectionState?.[key]?.rejectedQuantity ?? legacyCount);
    if (rejected > plan.allowedRejectedQuantity) throw Error(`Esta inspección tiene ${rejected} piezas únicas rechazadas y permite ${plan.allowedRejectedQuantity}; no pasó.`);
    t.update(ref, { shiftChecks: [...checks, { method, shiftIdentifier: shift.trim(), inspectionNumber: n, result: "pass", createdBy: user!.displayName || user!.email || "Usuario", createdAt: new Date().toISOString() }] });
   }); setNumber("");
  } catch (e) { setError(e instanceof Error ? e.message : "No se pudo registrar."); } finally { setSaving(false); }
 };
 return <section className="rounded-xl border border-white/10 p-4"><h3 className="font-medium text-white">Inspecciones por turno</h3><p className="mt-2 text-xs text-white/50">Registra las inspecciones concluidas dentro del límite. Los rechazos por SPEC se acumulan por método, día/turno y número. El lote no pasa solo al superar el límite de esa inspección.</p>
 {plans.map(p => <p key={p.method} className="mt-1 text-xs text-white/50">{incomingMethodLabel(p.method)}: {p.inspectionsPerShift} inspecciones por turno · {p.allowedRejectedQuantity} piezas únicas permitidas por inspección</p>)}
 {lot.status === "in_progress" && <div className="mt-3 grid gap-2 sm:grid-cols-4"><select value={method} onChange={e => setMethod(e.target.value as typeof method)} className="rounded bg-[#111916] p-2 text-white">{plans.map(p => <option key={p.method} value={p.method}>{incomingMethodLabel(p.method)}</option>)}</select><input value={shift} onChange={e => setShift(e.target.value)} placeholder="Día / identificación de turno" className="rounded bg-black/20 p-2 text-white"/><input type="number" min="1" value={number} onChange={e => setNumber(e.target.value)} placeholder="# de inspección" className="rounded bg-black/20 p-2 text-white"/><button type="button" disabled={saving} onClick={save} className="rounded bg-emerald-500/20 p-2 text-emerald-100">Registrar: pasó</button></div>}
 {error && <p className="mt-2 text-sm text-red-200">{error}</p>}<div className="mt-3 space-y-1 text-xs text-white/60">{(lot.shiftChecks || []).map((c, i) => <p key={i}>{incomingMethodLabel(c.method)} · {c.shiftIdentifier} · #{c.inspectionNumber}: pasó</p>)}
 {Object.entries(lot.shiftRejectionState || {}).map(([key, state]) => { const limit = plans.find(p => p.method === state.method)?.allowedRejectedQuantity || 0; return <p key={key} className={state.rejectedQuantity > limit ? "text-red-200" : "text-white/60"}>{incomingMethodLabel(state.method)} · {state.shiftIdentifier} · #{state.inspectionNumber}: {state.rejectedQuantity} rechazadas únicas / {limit} permitidas · {state.rejectedQuantity > limit ? "no pasó" : "dentro del límite"}</p>; })}
 {reports.filter(r => r.shiftIdentifier && !lot.shiftRejectionState?.[shiftInspectionKey(r.inspectionMethod || "visual", r.shiftIdentifier!, r.shiftInspectionNumber!)]).map(r => <p key={r.id} className="text-red-200">{incomingMethodLabel(r.inspectionMethod)} · {r.shiftIdentifier} · #{r.shiftInspectionNumber}: reporte histórico por SPEC · {r.title}</p>)}
 </div></section>;
}
