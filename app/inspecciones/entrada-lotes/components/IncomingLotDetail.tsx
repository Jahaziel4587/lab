"use client";

import { AlertTriangle, Camera, CheckCircle2, ChevronDown, ImagePlus, LoaderCircle, Plus, Send, ShieldAlert, X } from "lucide-react";
import { ChangeEvent, FormEvent, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useAuth } from "@/src/Context/AuthContext";
import type {
  IncomingInspectionContext,
  IncomingInspectionLot,
  IncomingLotAnomalyMessage,
  IncomingLotFindingKind,
  IncomingLotReport,
  IncomingLotReportMode,
} from "../types";
import { useIncomingLotReports } from "../hooks/useIncomingLotReports";
import IncomingLotReportForm from "./IncomingLotReportForm";

type Props = { context: IncomingInspectionContext; lot: IncomingInspectionLot };

function formatDate(value: unknown) {
  if (!value) return "";
  const candidate = value as { toDate?: () => Date; seconds?: number };
  const date = typeof candidate.toDate === "function"
    ? candidate.toDate()
    : typeof candidate.seconds === "number"
      ? new Date(candidate.seconds * 1000)
      : new Date(String(value));
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("es-MX", { dateStyle: "short", timeStyle: "short" }).format(date);
}

function AnomalyChat({ messages, sending, onSend }: {
  messages: IncomingLotAnomalyMessage[];
  sending: boolean;
  onSend: (text: string) => Promise<void>;
}) {
  const { user } = useAuth();
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!message.trim()) return;
    try {
      setError("");
      await onSend(message);
      setMessage("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No fue posible enviar el mensaje.");
    }
  };

  return <div className="h-full overflow-hidden rounded-2xl border border-white/10 bg-black/15">
    <div className="max-h-64 space-y-3 overflow-y-auto bg-gradient-to-b from-emerald-950/10 to-black/10 p-4">
      {messages.length === 0 && <p className="py-4 text-center text-xs text-white/35">Todavía no hay mensajes en esta anormalidad.</p>}
      {messages.map((entry) => {
        const isDecision = entry.type === "decision";
        const isOwn = Boolean(user?.uid && entry.createdByUid === user.uid);
        if (isDecision) return <div key={entry.id} className="flex justify-center"><div className="max-w-xl rounded-2xl border border-emerald-400/25 bg-emerald-400/[0.09] px-4 py-3 text-center"><p className="text-[11px] font-semibold uppercase tracking-wider text-emerald-300">Decisión registrada</p><p className="mt-1 whitespace-pre-wrap text-sm text-white/80">{entry.text}</p><p className="mt-1 text-[11px] text-white/35">{entry.createdByName} · {formatDate(entry.createdAt)}</p></div></div>;
        return <div key={entry.id} className={`flex ${isOwn ? "justify-end" : "justify-start"}`}><div className={`max-w-[85%] px-4 py-3 text-sm sm:max-w-[72%] ${isOwn ? "rounded-2xl rounded-tr-md bg-emerald-500/20" : "rounded-2xl rounded-tl-md border border-white/10 bg-white/[0.065]"}`}><div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1"><p className={`text-xs font-medium ${isOwn ? "text-emerald-200" : "text-white/60"}`}>{isOwn ? "Tú" : entry.createdByName}</p><p className="text-[11px] text-white/30">{formatDate(entry.createdAt)}</p></div><p className="mt-1.5 whitespace-pre-wrap leading-relaxed text-white/80">{entry.text}</p></div></div>;
      })}
    </div>
    <form onSubmit={submit} className="border-t border-white/10 bg-black/20 p-3">
      <div className="flex items-end gap-2"><textarea value={message} onChange={(event) => setMessage(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); event.currentTarget.form?.requestSubmit(); } }} rows={1} disabled={sending} placeholder="Escribe un mensaje..." className="max-h-28 min-h-11 flex-1 resize-y rounded-xl border border-white/15 bg-white/[0.045] px-3 py-2.5 text-sm text-white outline-none placeholder:text-white/30 focus:border-emerald-400/45" /><button type="submit" disabled={sending || !message.trim()} aria-label="Enviar mensaje" className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-emerald-400/30 bg-emerald-400/15 text-emerald-200 disabled:opacity-40">{sending ? <LoaderCircle size={16} className="animate-spin" /> : <Send size={16} />}</button></div>
      {error && <p className="mt-2 text-xs text-red-200">{error}</p>}
    </form>
  </div>;
}

function ReportCard({ report, messages, disabled, canDecide, saving, onAddQuantity, onOpenDecision, onSendMessage, onAddPhotos }: {
  report: IncomingLotReport;
  messages: IncomingLotAnomalyMessage[];
  disabled: boolean;
  canDecide: boolean;
  saving: boolean;
  onAddQuantity: (report: IncomingLotReport) => void;
  onOpenDecision: (report: IncomingLotReport) => void;
  onSendMessage: (reportId: string, text: string) => Promise<void>;
  onAddPhotos: (report: IncomingLotReport, files: File[]) => Promise<void>;
}) {
  const [expanded, setExpanded] = useState(report.kind !== "anomaly");
  const [photoError, setPhotoError] = useState("");
  const photoInput = useRef<HTMLInputElement | null>(null);
  const decisionLabel = report.decision === "pass" ? "Pasa" : report.decision === "fail" ? "No pasa" : "Decisión pendiente";
  const addPhotos = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []).filter((file) => file.type.startsWith("image/"));
    event.target.value = "";
    if (files.length === 0) return;
    try {
      setPhotoError("");
      await onAddPhotos(report, files);
    } catch (cause) {
      setPhotoError(cause instanceof Error ? cause.message : "No fue posible agregar las fotografías.");
    }
  };
  return <article className="rounded-2xl border border-white/10 bg-white/[0.035] p-4 sm:p-5">
    <button type="button" onClick={() => report.kind === "anomaly" && setExpanded((current) => !current)} className={`flex w-full items-start justify-between gap-3 text-left ${report.kind === "anomaly" ? "cursor-pointer" : "cursor-default"}`}><div className="min-w-0"><p className="text-xs font-semibold uppercase tracking-wider text-white/35">{report.kind === "anomaly" ? "Anormalidad" : "Rechazo por SPEC"}</p><h4 className="mt-1 break-words font-semibold text-white">{report.title || "Pendiente de título"}</h4>{report.kind === "anomaly" && <span className={`mt-2 inline-block rounded-full border px-2.5 py-1 text-xs ${report.decision === "pass" ? "border-emerald-400/25 text-emerald-200" : report.decision === "fail" ? "border-red-400/25 text-red-200" : "border-amber-400/25 text-amber-200"}`}>{decisionLabel}</span>}</div><div className="flex shrink-0 items-center gap-2"><span className="rounded-full border border-white/10 px-3 py-1 text-xs text-white/55">{report.mode === "quantity" ? `${report.quantity || 0} piezas` : `Muestra #${report.sampleNumber}`}</span>{report.kind === "anomaly" && <ChevronDown size={18} className={`text-white/40 transition-transform ${expanded ? "rotate-180" : ""}`} />}</div></button>
    {expanded && <div className={`mt-4 grid gap-5 ${report.kind === "anomaly" ? "lg:grid-cols-[minmax(260px,0.8fr)_minmax(380px,1.2fr)]" : "grid-cols-1"}`}><div className="min-w-0">{report.description && <p className="whitespace-pre-wrap text-sm text-white/60">{report.description}</p>}{report.photos.length > 0 && <div className="mt-4 flex flex-wrap gap-2">{report.photos.map((photo) => <a key={photo.storagePath} href={photo.url} target="_blank" rel="noreferrer" className="block h-20 w-20 overflow-hidden rounded-xl border border-white/10">{/* eslint-disable-next-line @next/next/no-img-element */}<img src={photo.url} alt={photo.name} className="h-full w-full object-cover" /></a>)}</div>}<div className="mt-4 flex flex-wrap gap-2">{report.mode === "quantity" && !disabled && <button type="button" onClick={() => onAddQuantity(report)} className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-emerald-400/20 px-3 py-2 text-xs font-medium text-emerald-200"><Plus size={14} /> Agregar piezas</button>}{!disabled && <button type="button" onClick={() => photoInput.current?.click()} disabled={saving} className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-sky-400/20 px-3 py-2 text-xs font-medium text-sky-100 disabled:opacity-50"><ImagePlus size={14} /> Agregar fotos</button>}{report.kind === "anomaly" && report.decision == null && (canDecide ? <button type="button" onClick={() => onOpenDecision(report)} className="inline-flex min-h-10 items-center rounded-xl border border-amber-400/25 bg-amber-400/10 px-4 py-2 text-xs font-medium text-amber-100">Tomar decisión</button> : <span className="self-center text-xs text-amber-200/60">Decisión pendiente del PM</span>)}{report.kind === "anomaly" && report.decision != null && <span className={`inline-flex min-h-10 items-center gap-2 rounded-xl border px-3 py-2 text-xs font-medium ${report.decision === "pass" ? "border-emerald-400/25 text-emerald-200" : "border-red-400/25 text-red-200"}`}><CheckCircle2 size={14} /> {decisionLabel}</span>}<input ref={photoInput} type="file" accept="image/*" multiple className="hidden" onChange={addPhotos} /></div>{photoError && <p className="mt-2 text-xs text-red-200">{photoError}</p>}</div>{report.kind === "anomaly" && <div className="min-h-56 min-w-0"><AnomalyChat messages={messages} sending={saving} onSend={(text) => onSendMessage(report.id, text)} /></div>}</div>}
  </article>;
}

export default function IncomingLotDetail({ context, lot }: Props) {
  const [activeKind, setActiveKind] = useState<IncomingLotFindingKind>("anomaly");
  const [formOpen, setFormOpen] = useState(false);
  const [decisionReport, setDecisionReport] = useState<IncomingLotReport | null>(null);
  const [finalizeOpen, setFinalizeOpen] = useState(false);
  const [finalQuantities, setFinalQuantities] = useState<Record<string, string>>({});
  const reportsState = useIncomingLotReports({ context, lot });
  const [quantityReport, setQuantityReport] = useState<IncomingLotReport | null>(null);
  const [quantityToAdd, setQuantityToAdd] = useState("");
  const [uniqueQuantity, setUniqueQuantity] = useState("");
  const [decisionTitle, setDecisionTitle] = useState("");
  const [decisionComment, setDecisionComment] = useState("");
  const [actionError, setActionError] = useState("");
  const visibleReports = useMemo(() => reportsState.reports.filter((report) => report.kind === activeKind), [activeKind, reportsState.reports]);
  const counts = useMemo(() => ({ anomaly: reportsState.reports.filter((r) => r.kind === "anomaly").length, spec: reportsState.reports.filter((r) => r.kind === "spec_rejection").length }), [reportsState.reports]);
  const needsThresholdReview = lot.reportedRejectedQuantity > lot.allowedRejectedQuantity && lot.inspectionResult !== "will_fail" && lot.reportedRejectedQuantity > Number(lot.lastReviewedReportedQuantity || 0);
  const run = async (action: () => Promise<void>, fallback: string) => { try { setActionError(""); await action(); } catch (cause) { setActionError(cause instanceof Error ? cause.message : fallback); } };
  const openDecision = (report: IncomingLotReport) => { setActionError(""); setDecisionReport(report); setDecisionTitle(report.title === "Pendiente de título" ? "" : report.title); setDecisionComment(""); };
  const saveDecision = async (decision: "pass" | "fail") => { if (!decisionReport) return; await run(async () => { await reportsState.resolveAnomaly(decisionReport.id, decisionTitle, decision, decisionComment); setDecisionReport(null); }, "No fue posible guardar la decisión."); };
  const initialMode: IncomingLotReportMode = activeKind === "spec_rejection" && lot.specCountingMode ? lot.specCountingMode : "quantity";
  const pendingAnomalies = reportsState.reports.filter((report) => report.kind === "anomaly" && report.decision == null);
  const failedAnomalyTitles = Array.from(new Set(reportsState.reports.filter((report) => report.kind === "anomaly" && report.decision === "fail").map((report) => report.title.trim()).filter(Boolean)));
  const finalize = async () => {
    await run(async () => {
      await reportsState.finalizeLot(Object.fromEntries(Object.entries(finalQuantities).map(([title, quantity]) => [title, Number(quantity)])));
      setFinalizeOpen(false);
    }, "No fue posible finalizar el lote.");
  };

  return <section className="space-y-6">
    <div className="rounded-2xl border border-emerald-400/20 bg-emerald-400/[0.06] p-5"><div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between"><div><p className="text-xs font-semibold uppercase tracking-wider text-emerald-300">{lot.status === "in_progress" ? "Lote en curso" : "Lote finalizado"}</p><h2 className="mt-2 text-2xl font-semibold text-white">{lot.lotName}</h2><p className="mt-2 text-sm text-white/55">{lot.inspectedQuantity} por inspeccionar · {lot.totalLotQuantity} totales · {lot.allowedRejectedQuantity} rechazos permitidos</p><p className="mt-1 text-xs text-white/40">Inspección {lot.inspectionType === "special" ? "especial" : "normal"} · Nivel {lot.inspectionLevel} · AQL {lot.aql}</p></div>{lot.status === "in_progress" && <button type="button" disabled={reportsState.loading} onClick={() => { setActionError(""); setFinalizeOpen(true); }} className="shrink-0 rounded-xl border border-emerald-400/30 bg-emerald-400/15 px-5 py-3 text-sm font-medium text-emerald-100 disabled:opacity-40">Finalizar lote</button>}</div></div>
    <div className="rounded-2xl border border-white/10 bg-black/15 p-3 sm:p-4"><div className="grid grid-cols-2 gap-2"><button type="button" onClick={() => setActiveKind("anomaly")} className={`rounded-xl px-3 py-3 text-sm font-medium ${activeKind === "anomaly" ? "bg-amber-400/15 text-amber-100 ring-1 ring-amber-400/30" : "text-white/45"}`}>Anormalidades <span className="opacity-60">({counts.anomaly})</span></button><button type="button" onClick={() => setActiveKind("spec_rejection")} className={`rounded-xl px-3 py-3 text-sm font-medium ${activeKind === "spec_rejection" ? "bg-red-400/15 text-red-100 ring-1 ring-red-400/30" : "text-white/45"}`}>Rechazos por SPEC <span className="opacity-60">({counts.spec})</span></button></div>{lot.status === "in_progress" && <button type="button" onClick={() => setFormOpen(true)} className={`mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl border px-4 py-3 text-sm font-medium sm:w-auto ${activeKind === "anomaly" ? "border-amber-400/25 bg-amber-400/10 text-amber-100" : "border-red-400/25 bg-red-400/10 text-red-100"}`}>{activeKind === "anomaly" ? <Camera size={16} /> : <ShieldAlert size={16} />}{activeKind === "anomaly" ? "Reportar anormalidad" : "Reportar rechazo por SPEC"}</button>}</div>
    {activeKind === "spec_rejection" && needsThresholdReview && <div className="rounded-2xl border border-red-400/30 bg-red-400/[0.08] p-5"><div className="flex gap-3"><AlertTriangle className="mt-0.5 shrink-0 text-red-300" size={22} /><div className="flex-1"><h3 className="font-semibold text-red-100">Confirma la cantidad de piezas rechazadas</h3><p className="mt-2 text-sm text-red-100/70">La suma actual es {lot.reportedRejectedQuantity} y la cantidad permitida es {lot.allowedRejectedQuantity}. Si son piezas diferentes, se notificará al PM y a Quality Management que el lote no pasará. ¿Es correcto?</p><div className="mt-4 flex flex-col gap-3"><button type="button" onClick={() => run(() => reportsState.confirmUniqueRejectedQuantity(lot.reportedRejectedQuantity), "No fue posible confirmar o notificar.")} className="rounded-xl bg-red-400/15 px-4 py-3 text-sm font-medium text-red-100">Sí, enviar notificación</button><div><p className="mb-2 text-xs text-white/50">No, hay piezas repetidas entre los reportes:</p><div className="flex flex-col gap-2 sm:flex-row"><input type="number" min="0" max={lot.reportedRejectedQuantity} value={uniqueQuantity} onChange={(e) => setUniqueQuantity(e.target.value)} placeholder="Cantidad real de piezas sin repetir" className="min-w-0 flex-1 rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-white" /><button type="button" onClick={() => run(async () => { await reportsState.confirmUniqueRejectedQuantity(Number(uniqueQuantity)); setUniqueQuantity(""); }, "No fue posible confirmar o notificar.")} className="rounded-xl border border-white/10 px-4 py-2 text-sm text-white/70">Confirmar cantidad real</button></div></div></div></div></div></div>}
    {lot.inspectionResult === "will_fail" && <div className="rounded-2xl border border-red-400/25 bg-red-400/[0.07] p-4 text-sm font-medium text-red-100">Este lote está marcado como que no pasará la inspección por exceder los rechazos permitidos.</div>}
    {(reportsState.error || actionError) && <p className="rounded-xl border border-red-400/20 bg-red-400/10 p-3 text-sm text-red-100">{reportsState.error || actionError}</p>}
    {quantityReport && <div className="rounded-2xl border border-emerald-400/20 bg-emerald-400/[0.05] p-4"><p className="font-medium text-white">Agregar piezas a “{quantityReport.title}”</p><p className="mt-1 text-xs text-white/40">La cantidad existente no se sustituirá ni podrá disminuirse.</p><div className="mt-3 flex flex-col gap-2 sm:flex-row"><input type="number" min="1" value={quantityToAdd} onChange={(e) => setQuantityToAdd(e.target.value)} placeholder="¿Cuántas piezas agregarás?" className="min-w-0 flex-1 rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-white" /><button type="button" onClick={() => run(async () => { await reportsState.addQuantity(quantityReport, Number(quantityToAdd)); setQuantityReport(null); setQuantityToAdd(""); }, "No fue posible agregar la cantidad.")} className="rounded-xl bg-emerald-400/15 px-4 py-3 text-sm text-emerald-100">Sumar</button><button type="button" onClick={() => setQuantityReport(null)} className="rounded-xl border border-white/10 px-4 py-3 text-sm text-white/50">Cancelar</button></div></div>}
    <div><div className="mb-3 flex items-center justify-between"><h3 className="text-lg font-semibold text-white">{activeKind === "anomaly" ? "Anormalidades" : "Rechazos por SPEC"}</h3><span className="text-sm text-white/35">{visibleReports.length}</span></div>{reportsState.loading ? <p className="text-sm text-white/45">Cargando reportes...</p> : <div className="space-y-4">{visibleReports.length === 0 ? <p className="rounded-2xl border border-dashed border-white/10 p-5 text-sm text-white/35">No hay reportes registrados.</p> : visibleReports.map((report) => <ReportCard key={report.id} report={report} messages={reportsState.messagesByReport[report.id] || []} disabled={lot.status !== "in_progress"} canDecide={reportsState.canDecideAnomalies} saving={reportsState.saving} onAddQuantity={setQuantityReport} onOpenDecision={openDecision} onSendMessage={reportsState.addAnomalyMessage} onAddPhotos={reportsState.addReportPhotos} />)}</div>}</div>
    {formOpen && <IncomingLotReportForm initialKind={activeKind} initialMode={initialMode} lockedSpecMode={lot.specCountingMode} inspectedQuantity={lot.inspectedQuantity} saving={reportsState.saving} onSubmit={async (input) => { await reportsState.createReport(input); setFormOpen(false); }} onCancel={() => setFormOpen(false)} />}
    {decisionReport && typeof document !== "undefined" && createPortal(<div className="fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto bg-black/75 p-4 backdrop-blur-sm"><div className="max-h-[calc(100dvh-2rem)] w-full max-w-lg overflow-y-auto rounded-3xl border border-white/10 bg-[#0d1512] p-5 shadow-2xl sm:p-7"><div className="flex items-start justify-between gap-4"><div><p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-300">Anormalidad</p><h2 className="mt-2 text-xl font-semibold text-white">Tomar decisión</h2></div><button type="button" onClick={() => setDecisionReport(null)} className="rounded-xl border border-white/10 p-2 text-white/60"><X size={18} /></button></div><div className="mt-6 space-y-4"><label className="block text-sm text-white/70">Título de la anormalidad<input value={decisionTitle} onChange={(e) => setDecisionTitle(e.target.value)} className="mt-2 w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-white" placeholder="Asigna un título" /></label><label className="block text-sm text-white/70">Comentario (opcional)<textarea value={decisionComment} onChange={(e) => setDecisionComment(e.target.value)} rows={3} className="mt-2 w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-white" /></label>{actionError && <p className="rounded-xl border border-red-400/20 bg-red-400/10 p-3 text-sm text-red-100">{actionError}</p>}<div className="grid grid-cols-2 gap-3"><button type="button" onClick={() => saveDecision("pass")} className="rounded-xl border border-emerald-400/25 bg-emerald-400/10 px-4 py-3 text-sm font-medium text-emerald-100">Pasa</button><button type="button" onClick={() => saveDecision("fail")} className="rounded-xl border border-red-400/25 bg-red-400/10 px-4 py-3 text-sm font-medium text-red-100">No pasa</button></div></div></div></div>, document.body)}
    {finalizeOpen && typeof document !== "undefined" && createPortal(<div className="fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto bg-black/75 p-4 backdrop-blur-sm"><div className="max-h-[calc(100dvh-2rem)] w-full max-w-xl overflow-y-auto rounded-3xl border border-white/10 bg-[#0d1512] p-5 shadow-2xl sm:p-7"><div className="flex items-start justify-between gap-4"><div><p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-300">Cierre de inspección</p><h2 className="mt-2 text-xl font-semibold text-white">Finalizar lote</h2></div><button type="button" onClick={() => setFinalizeOpen(false)} className="rounded-xl border border-white/10 p-2 text-white/60"><X size={18} /></button></div>{pendingAnomalies.length > 0 ? <div className="mt-6 rounded-xl border border-amber-400/25 bg-amber-400/10 p-4 text-sm text-amber-100">No puedes finalizar todavía. Faltan {pendingAnomalies.length} anormalidades por recibir una decisión.</div> : <div className="mt-6 space-y-4"><p className="text-sm text-white/60">Captura la cantidad exacta de piezas rechazadas para cada título de anormalidad que no pasó.</p>{failedAnomalyTitles.length === 0 ? <p className="rounded-xl border border-white/10 p-4 text-sm text-white/45">No hay anormalidades rechazadas. El lote puede finalizarse.</p> : failedAnomalyTitles.map((title) => <label key={title} className="block text-sm text-white/70">{title}<input type="number" min="1" max={lot.totalLotQuantity} step="1" value={finalQuantities[title] || ""} onChange={(event) => setFinalQuantities((current) => ({ ...current, [title]: event.target.value }))} placeholder="Cantidad exacta" className="mt-2 w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-white" /></label>)}{actionError && <p className="rounded-xl border border-red-400/20 bg-red-400/10 p-3 text-sm text-red-100">{actionError}</p>}<button type="button" onClick={finalize} disabled={reportsState.saving} className="w-full rounded-xl border border-emerald-400/30 bg-emerald-400/15 px-5 py-3 text-sm font-medium text-emerald-100 disabled:opacity-50">Confirmar y finalizar lote</button></div>}</div></div>, document.body)}
  </section>;
}
