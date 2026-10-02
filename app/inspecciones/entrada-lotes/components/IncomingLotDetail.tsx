"use client";

import {
  AlertTriangle,
  Camera,
  ChevronDown,
  FileDown,
  ImagePlus,
  LoaderCircle,
  Plus,
  Send,
  ShieldAlert,
  X,
} from "lucide-react";
import { ChangeEvent, FormEvent, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useAuth } from "@/src/Context/AuthContext";
import type {
  IncomingInspectionContext,
  IncomingInspectionLot,
  IncomingLotAnomalyMessage,
  IncomingLotFindingKind,
  IncomingNonconformanceDetails,
  IncomingLotReport,
  IncomingLotReportMode,
} from "../types";
import { useIncomingLotReports } from "../hooks/useIncomingLotReports";
import IncomingLotReportForm from "./IncomingLotReportForm";
import IncomingNonconformanceFields from "./IncomingNonconformanceFields";
import {
  generateIncomingLotPdf,
  type IncomingLotPdfMode,
} from "../pdf/generateIncomingLotPdf";
import {
  buildSuggestedRejectionSummary,
  buildNonconformanceDescription,
} from "../qmsReportData";

type Props = { context: IncomingInspectionContext; lot: IncomingInspectionLot };

function formatDate(value: unknown) {
  if (!value) return "";
  const candidate = value as { toDate?: () => Date; seconds?: number };
  const date =
    typeof candidate.toDate === "function"
      ? candidate.toDate()
      : typeof candidate.seconds === "number"
        ? new Date(candidate.seconds * 1000)
        : new Date(String(value));
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("es-MX", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(date);
}

function AnomalyChat({
  messages,
  sending,
  rejected,
  onSend,
}: {
  messages: IncomingLotAnomalyMessage[];
  sending: boolean;
  rejected: boolean;
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
      setError(
        cause instanceof Error
          ? cause.message
          : "No fue posible enviar el mensaje.",
      );
    }
  };

  return (
    <div className="h-full overflow-hidden rounded-2xl border border-white/10 bg-black/15">
      <div className="max-h-64 space-y-3 overflow-y-auto bg-gradient-to-b from-emerald-950/10 to-black/10 p-4">
        {messages.length === 0 && (
          <p className="py-4 text-center text-xs text-white/35">
            Todavía no hay mensajes en esta anormalidad.
          </p>
        )}
        {messages.map((entry) => {
          const isDecision = entry.type === "decision";
          const isOwn = Boolean(user?.uid && entry.createdByUid === user.uid);
          if (isDecision)
            return (
              <div key={entry.id} className="flex justify-center">
                <div
                  className={`max-w-xl rounded-2xl border px-4 py-3 text-center ${rejected ? "border-red-400/30 bg-red-400/[0.10]" : "border-emerald-400/25 bg-emerald-400/[0.09]"}`}
                >
                  <p
                    className={`text-[11px] font-semibold uppercase tracking-wider ${rejected ? "text-red-300" : "text-emerald-300"}`}
                  >
                    Decisión registrada
                  </p>
                  <p className="mt-1 whitespace-pre-wrap text-sm text-white/80">
                    {entry.text}
                  </p>
                  <p className="mt-1 text-[11px] text-white/35">
                    {entry.createdByName} · {formatDate(entry.createdAt)}
                  </p>
                </div>
              </div>
            );
          return (
            <div
              key={entry.id}
              className={`flex ${isOwn ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[85%] px-4 py-3 text-sm sm:max-w-[72%] ${isOwn ? "rounded-2xl rounded-tr-md bg-emerald-500/20" : "rounded-2xl rounded-tl-md border border-white/10 bg-white/[0.065]"}`}
              >
                <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
                  <p
                    className={`text-xs font-medium ${isOwn ? "text-emerald-200" : "text-white/60"}`}
                  >
                    {isOwn ? "Tú" : entry.createdByName}
                  </p>
                  <p className="text-[11px] text-white/30">
                    {formatDate(entry.createdAt)}
                  </p>
                </div>
                <p className="mt-1.5 whitespace-pre-wrap leading-relaxed text-white/80">
                  {entry.text}
                </p>
              </div>
            </div>
          );
        })}
      </div>
      <form
        onSubmit={submit}
        className="border-t border-white/10 bg-black/20 p-3"
      >
        <div className="flex items-end gap-2">
          <textarea
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                event.currentTarget.form?.requestSubmit();
              }
            }}
            rows={1}
            disabled={sending}
            placeholder="Escribe un mensaje..."
            className="max-h-28 min-h-11 flex-1 resize-y rounded-xl border border-white/15 bg-white/[0.045] px-3 py-2.5 text-sm text-white outline-none placeholder:text-white/30 focus:border-emerald-400/45"
          />
          <button
            type="submit"
            disabled={sending || !message.trim()}
            aria-label="Enviar mensaje"
            className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-emerald-400/30 bg-emerald-400/15 text-emerald-200 disabled:opacity-40"
          >
            {sending ? (
              <LoaderCircle size={16} className="animate-spin" />
            ) : (
              <Send size={16} />
            )}
          </button>
        </div>
        {error && <p className="mt-2 text-xs text-red-200">{error}</p>}
      </form>
    </div>
  );
}

function ReportCard({
  report,
  messages,
  disabled,
  canDecide,
  saving,
  generatingPdf,
  onAddQuantity,
  onOpenDecision,
  onSendMessage,
  onAddPhotos,
  onGeneratePdf,
}: {
  report: IncomingLotReport;
  messages: IncomingLotAnomalyMessage[];
  disabled: boolean;
  canDecide: boolean;
  saving: boolean;
  generatingPdf: boolean;
  onAddQuantity: (report: IncomingLotReport) => void;
  onOpenDecision: (report: IncomingLotReport) => void;
  onSendMessage: (reportId: string, text: string) => Promise<void>;
  onAddPhotos: (report: IncomingLotReport, files: File[]) => Promise<void>;
  onGeneratePdf: (report: IncomingLotReport) => Promise<void>;
}) {
  const [expanded, setExpanded] = useState(report.kind !== "anomaly");
  const [photoError, setPhotoError] = useState("");
  const photoInput = useRef<HTMLInputElement | null>(null);
  const decisionLabel =
    report.decision === "pass"
      ? "Pasa"
      : report.decision === "fail"
        ? "No pasa"
        : "Decisión pendiente";
  const methodLabel = report.inspectionMethod === "documentary" ? "Documental" : report.inspectionMethod === "dimensional" ? "Dimensional" : report.inspectionMethod === "functional" ? "Funcional" : "Visual";
  const addPhotos = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []).filter((file) =>
      file.type.startsWith("image/"),
    );
    event.target.value = "";
    if (files.length === 0) return;
    try {
      setPhotoError("");
      await onAddPhotos(report, files);
    } catch (cause) {
      setPhotoError(
        cause instanceof Error
          ? cause.message
          : "No fue posible agregar las fotografías.",
      );
    }
  };
  return (
    <article
      className={`rounded-2xl border p-4 sm:p-5 ${report.decision === "fail" ? "border-red-400/25 bg-red-400/[0.055]" : "border-white/10 bg-white/[0.035]"}`}
    >
      <button
        type="button"
        onClick={() =>
          report.kind === "anomaly" && setExpanded((current) => !current)
        }
        className={`flex w-full items-start justify-between gap-3 text-left ${report.kind === "anomaly" ? "cursor-pointer" : "cursor-default"}`}
      >
        <div className="min-w-0">
          <p
            className={`text-xs font-semibold uppercase tracking-wider ${report.decision === "fail" ? "text-red-300/70" : "text-white/35"}`}
          >
            {report.kind === "anomaly" ? "Anormalidad" : "Rechazo por SPEC"}
          </p>
          <h4 className="mt-1 break-words font-semibold text-white">
            {report.title || "Pendiente de título"}
          </h4>
          <p className="mt-1 text-xs text-white/40">Método: {methodLabel}</p>
          {report.kind === "anomaly" && (
            <span
              className={`mt-2 inline-block rounded-full border px-2.5 py-1 text-xs ${report.decision === "pass" ? "border-emerald-400/25 text-emerald-200" : report.decision === "fail" ? "border-red-400/25 bg-red-400/10 text-red-200" : "border-amber-400/25 text-amber-200"}`}
            >
              {decisionLabel}
            </span>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span
            className={`rounded-full border px-3 py-1 text-xs ${typeof report.finalRejectedQuantity === "number" ? "border-red-400/25 text-red-200" : "border-white/10 text-white/55"}`}
          >
            {typeof report.finalRejectedQuantity === "number"
              ? `${report.finalRejectedQuantity} piezas finales`
              : report.mode === "quantity"
                ? `${report.quantity || 0} piezas`
                : `Muestra #${report.sampleNumber}`}
          </span>
          {report.kind === "anomaly" && (
            <ChevronDown
              size={18}
              className={`text-white/40 transition-transform ${expanded ? "rotate-180" : ""}`}
            />
          )}
        </div>
      </button>
      {expanded && (
        <div
          className={`mt-4 grid gap-5 ${report.kind === "anomaly" ? "lg:grid-cols-[minmax(260px,0.8fr)_minmax(380px,1.2fr)]" : "grid-cols-1"}`}
        >
          <div className="min-w-0">
            {report.description && (
              <p className="whitespace-pre-wrap text-sm text-white/60">
                {report.description}
              </p>
            )}
            {report.photos.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-2">
                {report.photos.map((photo) => (
                  <a
                    key={photo.storagePath}
                    href={photo.url}
                    target="_blank"
                    rel="noreferrer"
                    className="block h-20 w-20 overflow-hidden rounded-xl border border-white/10"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={photo.url}
                      alt={photo.name}
                      className="h-full w-full object-cover"
                    />
                  </a>
                ))}
              </div>
            )}
            <div className="mt-4 flex flex-wrap gap-2">
              {report.mode === "quantity" && !disabled && (
                <button
                  type="button"
                  onClick={() => onAddQuantity(report)}
                  className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-emerald-400/20 px-3 py-2 text-xs font-medium text-emerald-200"
                >
                  <Plus size={14} /> Agregar piezas
                </button>
              )}
              {!disabled && (
                <button
                  type="button"
                  onClick={() => photoInput.current?.click()}
                  disabled={saving}
                  className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-sky-400/20 px-3 py-2 text-xs font-medium text-sky-100 disabled:opacity-50"
                >
                  <ImagePlus size={14} /> Agregar fotos
                </button>
              )}
              {report.kind === "anomaly" && (
                <button
                  type="button"
                  onClick={() => onGeneratePdf(report)}
                  disabled={generatingPdf}
                  className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-white/15 px-3 py-2 text-xs font-medium text-white/70 disabled:opacity-50"
                >
                  {generatingPdf ? (
                    <LoaderCircle size={14} className="animate-spin" />
                  ) : (
                    <FileDown size={14} />
                  )}{" "}
                  PDF
                </button>
              )}
              {report.kind === "anomaly" &&
                report.decision == null &&
                (canDecide ? (
                  <button
                    type="button"
                    onClick={() => onOpenDecision(report)}
                    className="inline-flex min-h-10 items-center rounded-xl border border-amber-400/25 bg-amber-400/10 px-4 py-2 text-xs font-medium text-amber-100"
                  >
                    Tomar decisión
                  </button>
                ) : (
                  <span className="self-center text-xs text-amber-200/60">
                    Decisión pendiente del PM
                  </span>
                ))}
              <input
                ref={photoInput}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={addPhotos}
              />
            </div>
            {photoError && (
              <p className="mt-2 text-xs text-red-200">{photoError}</p>
            )}
          </div>
          {report.kind === "anomaly" && (
            <div className="min-h-56 min-w-0">
              <AnomalyChat
                messages={messages}
                sending={saving}
                rejected={report.decision === "fail"}
                onSend={(text) => onSendMessage(report.id, text)}
              />
            </div>
          )}
        </div>
      )}
    </article>
  );
}

export default function IncomingLotDetail({ context, lot }: Props) {
  const { user } = useAuth();
  const [activeKind, setActiveKind] =
    useState<IncomingLotFindingKind>("anomaly");
  const [formOpen, setFormOpen] = useState(false);
  const [decisionReport, setDecisionReport] =
    useState<IncomingLotReport | null>(null);
  const [finalizeOpen, setFinalizeOpen] = useState(false);
  const [finalRejectedPieces, setFinalRejectedPieces] = useState("");
  const reportsState = useIncomingLotReports({ context, lot });
  const [quantityReport, setQuantityReport] =
    useState<IncomingLotReport | null>(null);
  const [quantityToAdd, setQuantityToAdd] = useState("");
  const [uniqueQuantity, setUniqueQuantity] = useState("");
  const [decisionTitle, setDecisionTitle] = useState("");
  const [decisionComment, setDecisionComment] = useState("");
  const [actionError, setActionError] = useState("");
  const [generatingPdf, setGeneratingPdf] = useState<string | null>(null);
  const [rejectionPdfOpen, setRejectionPdfOpen] = useState(false);
  const [nonconformancePdfOpen, setNonconformancePdfOpen] = useState(false);
  const [rejectionSummary, setRejectionSummary] = useState("");
  const [rejectionDisposition, setRejectionDisposition] = useState<"scrap" | "other">("scrap");
  const [rejectionOtherDisposition, setRejectionOtherDisposition] = useState("");
  const [rejectionObservations, setRejectionObservations] = useState("");
  const [nonconformanceExtraComment, setNonconformanceExtraComment] = useState("");
  const [nonconformanceDetails, setNonconformanceDetails] = useState<IncomingNonconformanceDetails>({
    category: "quality",
    immediateActions: "Se segregó y retuvo el lote; se notificó al PM responsable y a Quality Management.",
    riskSeverity: "",
    riskOccurrence: "",
    riskLevel: "medium",
    capaRequired: false,
    dispositions: ["return_supplier"],
    dispositionJustification: "",
  });
  const visibleReports = useMemo(
    () => reportsState.reports.filter((report) => report.kind === activeKind),
    [activeKind, reportsState.reports],
  );
  const counts = useMemo(
    () => ({
      anomaly: reportsState.reports.filter((r) => r.kind === "anomaly").length,
      spec: reportsState.reports.filter((r) => r.kind === "spec_rejection")
        .length,
    }),
    [reportsState.reports],
  );
  const specTotalsByMethod = useMemo(() => reportsState.reports.filter((report) => report.kind === "spec_rejection").reduce((totals, report) => ({ ...totals, [report.inspectionMethod || "visual"]: (totals[report.inspectionMethod || "visual"] || 0) + (report.mode === "quantity" ? report.quantity || 0 : 1) }), {} as Record<string, number>), [reportsState.reports]);
  const thresholdPlan = lot.methodPlans.find((plan) => { if(plan.isFullInspection)return false; const reported = specTotalsByMethod[plan.method] || 0; const reviewed = lot.methodReviewState?.[plan.method]?.lastReviewedReportedQuantity || 0; return reported > plan.allowedRejectedQuantity && reported > reviewed; });
  const thresholdReportedQuantity = thresholdPlan ? specTotalsByMethod[thresholdPlan.method] || 0 : 0;
  const thresholdMethodLabel = thresholdPlan?.method === "documentary" ? "documental" : thresholdPlan?.method === "dimensional" ? "dimensional" : thresholdPlan?.method === "functional" ? "funcional" : "visual";
  const run = async (action: () => Promise<void>, fallback: string) => {
    try {
      setActionError("");
      await action();
    } catch (cause) {
      setActionError(cause instanceof Error ? cause.message : fallback);
    }
  };
  const openDecision = (report: IncomingLotReport) => {
    setActionError("");
    setDecisionReport(report);
    setDecisionTitle(
      report.title === "Pendiente de título" ? "" : report.title,
    );
    setDecisionComment("");
  };
  const saveDecision = async (decision: "pass" | "fail") => {
    if (!decisionReport) return;
    await run(async () => {
      await reportsState.resolveAnomaly(
        decisionReport.id,
        decisionTitle,
        decision,
        decisionComment,
      );
      setDecisionReport(null);
    }, "No fue posible guardar la decisión.");
  };
  const initialMode: IncomingLotReportMode =
    activeKind === "spec_rejection" && lot.specCountingMode
      ? lot.specCountingMode
      : "quantity";
  const pendingAnomalies = reportsState.reports.filter(
    (report) => report.kind === "anomaly" && report.decision == null,
  );
  const failedAnomalySummary = useMemo(
    () =>
      Array.from(
        reportsState.reports
          .filter(
            (report) =>
              report.kind === "anomaly" && report.decision === "fail",
          )
          .reduce((groups, report) => {
            const title = report.title.trim() || "Sin título";
            const current = groups.get(title) || {
              title,
              quantity: 0,
              reports: [] as IncomingLotReport[],
            };
            current.quantity += report.mode === "quantity" ? report.quantity || 0 : 0;
            current.reports.push(report);
            groups.set(title, current);
            return groups;
          }, new Map<string, { title: string; quantity: number; reports: IncomingLotReport[] }>())
          .values(),
      ),
    [reportsState.reports],
  );
  const specReports = reportsState.reports.filter(
    (report) => report.kind === "spec_rejection",
  );
  const requiresNonconformance = lot.inspectionResult === "will_fail" || Object.values(lot.methodReviewState || {}).some(
    (review) => review?.result === "will_fail",
  );
  const finalize = async () => {
    await run(async () => {
      await reportsState.finalizeLot({
        finalRejectedPieces: finalRejectedPieces.trim() === ""
          ? Number.NaN
          : Number(finalRejectedPieces),
        ...(requiresNonconformance ? { nonconformanceDetails } : {}),
      });
      setFinalizeOpen(false);
    }, "No fue posible finalizar el lote.");
  };
  const generatorName = user?.displayName || user?.email || "Usuario";
  const openRejectionPdf = () => {
    setRejectionSummary(buildSuggestedRejectionSummary(reportsState.reports));
    setActionError("");
    setRejectionPdfOpen(true);
  };
  const downloadOfficialReport = async (
    endpoint: "rejection-report" | "nonconformance-report",
    payload: Record<string, unknown>,
    fallbackFileName: string,
  ) => {
    if (!user) throw new Error("No hay una sesión activa.");
    const response = await fetch(`/api/inspections/incoming-lot/${endpoint}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${await user.getIdToken()}`,
      },
      body: JSON.stringify({ scopeKey: context.scopeKey, lotId: lot.id, ...payload }),
    });
    if (!response.ok) {
      const result = await response.json().catch(() => null);
      throw new Error(result?.detail || result?.error || "No fue posible generar el formato oficial.");
    }
    const blob = await response.blob();
    const disposition = response.headers.get("content-disposition") || "";
    const headerName = disposition.match(/filename="?([^";]+)"?/i)?.[1];
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = headerName || fallbackFileName;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const generatePdf = async (
    mode: IncomingLotPdfMode,
    report?: IncomingLotReport,
  ) => {
    if (!user) return;
    const key = report?.id || mode;
    try {
      setActionError("");
      setGeneratingPdf(key);
      await generateIncomingLotPdf({
        mode,
        context,
        lot,
        reports: reportsState.reports,
        messagesByReport: reportsState.messagesByReport,
        idToken: await user.getIdToken(),
        anomalyId: report?.id,
      });
    } catch (cause) {
      setActionError(
        cause instanceof Error
          ? cause.message
          : "No fue posible generar el PDF.",
      );
    } finally {
      setGeneratingPdf(null);
    }
  };

  return (
    <section className="space-y-6">
      <div className="rounded-2xl border border-emerald-400/20 bg-emerald-400/[0.06] p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-emerald-300">
              {lot.status === "in_progress"
                ? "Lote en curso"
                : "Lote finalizado"}
            </p>
            <h2 className="mt-2 text-2xl font-semibold text-white">
              {lot.lotName}
            </h2>
            <p className="mt-2 text-sm text-white/55">{lot.totalLotQuantity} piezas totales · {lot.methodPlans.length} método{lot.methodPlans.length === 1 ? "" : "s"} de inspección</p>
            <p className="mt-1 text-sm text-white/45">PDO / PO #: {lot.purchaseOrder || "Sin registrar"}</p>
            <div className="mt-2 flex flex-wrap gap-2">{lot.methodPlans.map((plan) => <span key={plan.method} className="rounded-full border border-white/10 px-2.5 py-1 text-xs text-white/45">{plan.method === "documentary" ? "Documental" : plan.method === "visual" ? "Visual" : plan.method === "dimensional" ? "Dimensional" : "Funcional"}: {plan.isFullInspection?`100% · ${plan.inspectedQuantity} piezas`:`${plan.inspectedQuantity} muestras · ${plan.allowedRejectedQuantity} permitidos`}</span>)}</div>
            {typeof lot.finalRejectedPieces === "number" && (
              <p className="mt-2 text-sm font-medium text-red-200">
                {lot.finalRejectedPieces} piezas no pasaron la inspección
              </p>
            )}
          </div>
          <div className="flex shrink-0 flex-col gap-2 sm:flex-row">
            <button
              type="button"
              onClick={() => generatePdf("summary")}
              disabled={generatingPdf !== null}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/15 px-4 py-3 text-sm text-white/70 disabled:opacity-40"
            >
              <FileDown size={16} /> Resumen general
            </button>
            {lot.status === "finalized" && Number(lot.finalRejectedPieces || 0) > 0 && (
              <button
                type="button"
                onClick={openRejectionPdf}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-red-400/25 bg-red-400/[0.07] px-4 py-3 text-sm text-red-100"
              >
                <FileDown size={16} /> Reporte de rechazo
              </button>
            )}
            {lot.status === "finalized" && requiresNonconformance && (
              <button
                type="button"
                onClick={() => { setActionError(""); setNonconformancePdfOpen(true); }}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-red-400/35 bg-red-400/15 px-4 py-3 text-sm font-medium text-red-100"
              >
                <FileDown size={16} /> No conformidad
              </button>
            )}
            {lot.status === "in_progress" && (
              <button
                type="button"
                disabled={reportsState.loading}
                onClick={() => {
                  setActionError("");
                  setFinalizeOpen(true);
                }}
                className="rounded-xl border border-emerald-400/30 bg-emerald-400/15 px-5 py-3 text-sm font-medium text-emerald-100 disabled:opacity-40"
              >
                Finalizar lote
              </button>
            )}
          </div>
        </div>
      </div>
      <div className="rounded-2xl border border-white/10 bg-black/15 p-3 sm:p-4">
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setActiveKind("anomaly")}
            className={`rounded-xl px-3 py-3 text-sm font-medium ${activeKind === "anomaly" ? "bg-amber-400/15 text-amber-100 ring-1 ring-amber-400/30" : "text-white/45"}`}
          >
            Anormalidades <span className="opacity-60">({counts.anomaly})</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveKind("spec_rejection")}
            className={`rounded-xl px-3 py-3 text-sm font-medium ${activeKind === "spec_rejection" ? "bg-red-400/15 text-red-100 ring-1 ring-red-400/30" : "text-white/45"}`}
          >
            Rechazos por SPEC{" "}
            <span className="opacity-60">({counts.spec})</span>
          </button>
        </div>
        <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          {lot.status === "in_progress" && (
            <button
              type="button"
              onClick={() => setFormOpen(true)}
              className={`inline-flex w-full items-center justify-center gap-2 rounded-xl border px-4 py-3 text-sm font-medium sm:w-auto ${activeKind === "anomaly" ? "border-amber-400/25 bg-amber-400/10 text-amber-100" : "border-red-400/25 bg-red-400/10 text-red-100"}`}
            >
              {activeKind === "anomaly" ? (
                <Camera size={16} />
              ) : (
                <ShieldAlert size={16} />
              )}
              {activeKind === "anomaly"
                ? "Reportar anormalidad"
                : "Reportar rechazo por SPEC"}
            </button>
          )}
        </div>
      </div>
      {activeKind === "spec_rejection" && thresholdPlan && (
        <div className="rounded-2xl border border-red-400/30 bg-red-400/[0.08] p-5">
          <div className="flex gap-3">
            <AlertTriangle className="mt-0.5 shrink-0 text-red-300" size={22} />
            <div className="flex-1">
              <h3 className="font-semibold text-red-100">
                Confirma la cantidad de piezas rechazadas
              </h3>
              <p className="mt-2 text-sm text-red-100/70">
                En el método {thresholdMethodLabel}, la suma actual es {thresholdReportedQuantity} y la cantidad
                permitida es {thresholdPlan.allowedRejectedQuantity}. Si son piezas
                diferentes, se notificará al PM y a Quality Management que el
                lote no pasará. ¿Es correcto?
              </p>
              <div className="mt-4 flex flex-col gap-3">
                <button
                  type="button"
                  onClick={() =>
                    run(
                      () =>
                        reportsState.confirmUniqueRejectedQuantity(
                          thresholdPlan.method, thresholdReportedQuantity, thresholdReportedQuantity, thresholdPlan.allowedRejectedQuantity,
                        ),
                      "No fue posible confirmar o notificar.",
                    )
                  }
                  className="rounded-xl bg-red-400/15 px-4 py-3 text-sm font-medium text-red-100"
                >
                  Sí, enviar notificación
                </button>
                <div>
                  <p className="mb-2 text-xs text-white/50">
                    No, hay piezas repetidas entre los reportes:
                  </p>
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <input
                      type="number"
                      min="0"
                      max={thresholdReportedQuantity}
                      value={uniqueQuantity}
                      onChange={(e) => setUniqueQuantity(e.target.value)}
                      placeholder="Cantidad real de piezas sin repetir"
                      className="min-w-0 flex-1 rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-white"
                    />
                    <button
                      type="button"
                      onClick={() =>
                        run(async () => {
                          await reportsState.confirmUniqueRejectedQuantity(
                            thresholdPlan.method, Number(uniqueQuantity), thresholdReportedQuantity, thresholdPlan.allowedRejectedQuantity,
                          );
                          setUniqueQuantity("");
                        }, "No fue posible confirmar o notificar.")
                      }
                      className="rounded-xl border border-white/10 px-4 py-2 text-sm text-white/70"
                    >
                      Confirmar cantidad real
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      {lot.inspectionResult === "will_fail" && (
        <div className="rounded-2xl border border-red-400/25 bg-red-400/[0.07] p-4 text-sm font-medium text-red-100">
          Este lote está marcado como que no pasará la inspección por exceder
          los rechazos permitidos.
        </div>
      )}
      {(reportsState.error || actionError) && (
        <p className="rounded-xl border border-red-400/20 bg-red-400/10 p-3 text-sm text-red-100">
          {reportsState.error || actionError}
        </p>
      )}
      {quantityReport &&
        typeof document !== "undefined" &&
        createPortal(
          <div className="fixed inset-0 z-[110] flex items-center justify-center overflow-y-auto bg-black/75 p-4 backdrop-blur-sm">
            <div className="w-full max-w-md rounded-3xl border border-emerald-400/20 bg-[#0d1512] p-5 shadow-2xl sm:p-7">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-300">
                    Sumar cantidad
                  </p>
                  <h2 className="mt-2 text-xl font-semibold text-white">
                    Agregar piezas a “{quantityReport.title}”
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setQuantityReport(null);
                    setQuantityToAdd("");
                  }}
                  className="rounded-xl border border-white/10 p-2 text-white/60"
                >
                  <X size={18} />
                </button>
              </div>
              <p className="mt-5 text-sm text-white/50">
                Actualmente hay {quantityReport.quantity || 0} piezas. La
                cantidad existente no se sustituirá ni podrá disminuirse.
              </p>
              <input
                autoFocus
                type="number"
                min="1"
                value={quantityToAdd}
                onChange={(e) => setQuantityToAdd(e.target.value)}
                placeholder="¿Cuántas piezas agregarás?"
                className="mt-4 w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-white"
              />
              {actionError && (
                <p className="mt-3 rounded-xl border border-red-400/20 bg-red-400/10 p-3 text-sm text-red-100">
                  {actionError}
                </p>
              )}
              <div className="mt-5 grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setQuantityReport(null);
                    setQuantityToAdd("");
                  }}
                  className="rounded-xl border border-white/10 px-4 py-3 text-sm text-white/60"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  disabled={reportsState.saving}
                  onClick={() =>
                    run(async () => {
                      await reportsState.addQuantity(
                        quantityReport,
                        Number(quantityToAdd),
                      );
                      setQuantityReport(null);
                      setQuantityToAdd("");
                    }, "No fue posible agregar la cantidad.")
                  }
                  className="rounded-xl bg-emerald-400/15 px-4 py-3 text-sm font-medium text-emerald-100 disabled:opacity-50"
                >
                  Sumar piezas
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )}
      <div>
        <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <h3 className="text-lg font-semibold text-white">
              {activeKind === "anomaly" ? "Anormalidades" : "Rechazos por SPEC"}
            </h3>
            <span className="text-sm text-white/35">
              {visibleReports.length}
            </span>
          </div>
          {activeKind === "anomaly" ? (
            <button
              type="button"
              onClick={() => generatePdf("anomalies")}
              disabled={generatingPdf !== null || counts.anomaly === 0}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-amber-400/20 px-4 py-2.5 text-sm text-amber-100 disabled:opacity-40"
            >
              <FileDown size={16} /> Todas las anormalidades
            </button>
          ) : (
            <button
              type="button"
              onClick={() => generatePdf("spec")}
              disabled={generatingPdf !== null || counts.spec === 0}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-red-400/20 px-4 py-2.5 text-sm text-red-100 disabled:opacity-40"
            >
              <FileDown size={16} /> PDF de SPEC
            </button>
          )}
        </div>
        {reportsState.loading ? (
          <p className="text-sm text-white/45">Cargando reportes...</p>
        ) : (
          <div className="space-y-4">
            {visibleReports.length === 0 ? (
              <p className="rounded-2xl border border-dashed border-white/10 p-5 text-sm text-white/35">
                No hay reportes registrados.
              </p>
            ) : (
              visibleReports.map((report) => (
                <ReportCard
                  key={report.id}
                  report={report}
                  messages={reportsState.messagesByReport[report.id] || []}
                  disabled={lot.status !== "in_progress"}
                  canDecide={reportsState.canDecideAnomalies}
                  saving={reportsState.saving}
                  generatingPdf={generatingPdf === report.id}
                  onAddQuantity={setQuantityReport}
                  onOpenDecision={openDecision}
                  onSendMessage={reportsState.addAnomalyMessage}
                  onAddPhotos={reportsState.addReportPhotos}
                  onGeneratePdf={(item) => generatePdf("anomaly", item)}
                />
              ))
            )}
          </div>
        )}
      </div>
      {formOpen && (
        <IncomingLotReportForm
          initialKind={activeKind}
          initialMode={initialMode}
          lockedSpecMode={lot.specCountingMode}
          methodPlans={lot.methodPlans}
          saving={reportsState.saving}
          onSubmit={async (input) => {
            await reportsState.createReport(input);
            setFormOpen(false);
          }}
          onCancel={() => setFormOpen(false)}
        />
      )}
      {decisionReport &&
        typeof document !== "undefined" &&
        createPortal(
          <div className="fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto bg-black/75 p-4 backdrop-blur-sm">
            <div className="max-h-[calc(100dvh-2rem)] w-full max-w-lg overflow-y-auto rounded-3xl border border-white/10 bg-[#0d1512] p-5 shadow-2xl sm:p-7">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-300">
                    Anormalidad
                  </p>
                  <h2 className="mt-2 text-xl font-semibold text-white">
                    Tomar decisión
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={() => setDecisionReport(null)}
                  className="rounded-xl border border-white/10 p-2 text-white/60"
                >
                  <X size={18} />
                </button>
              </div>
              <div className="mt-6 space-y-4">
                <label className="block text-sm text-white/70">
                  Título de la anormalidad
                  <input
                    value={decisionTitle}
                    onChange={(e) => setDecisionTitle(e.target.value)}
                    className="mt-2 w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-white"
                    placeholder="Asigna un título"
                  />
                </label>
                <label className="block text-sm text-white/70">
                  Comentario (opcional)
                  <textarea
                    value={decisionComment}
                    onChange={(e) => setDecisionComment(e.target.value)}
                    rows={3}
                    className="mt-2 w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-white"
                  />
                </label>
                {actionError && (
                  <p className="rounded-xl border border-red-400/20 bg-red-400/10 p-3 text-sm text-red-100">
                    {actionError}
                  </p>
                )}
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => saveDecision("pass")}
                    className="rounded-xl border border-emerald-400/25 bg-emerald-400/10 px-4 py-3 text-sm font-medium text-emerald-100"
                  >
                    Pasa
                  </button>
                  <button
                    type="button"
                    onClick={() => saveDecision("fail")}
                    className="rounded-xl border border-red-400/25 bg-red-400/10 px-4 py-3 text-sm font-medium text-red-100"
                  >
                    No pasa
                  </button>
                </div>
              </div>
            </div>
          </div>,
          document.body,
        )}
      {finalizeOpen &&
        typeof document !== "undefined" &&
        createPortal(
          <div className="fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto bg-black/75 p-4 backdrop-blur-sm">
            <div className="max-h-[calc(100dvh-2rem)] w-full max-w-xl overflow-y-auto rounded-3xl border border-white/10 bg-[#0d1512] p-5 shadow-2xl sm:p-7">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-300">
                    Cierre de inspección
                  </p>
                  <h2 className="mt-2 text-xl font-semibold text-white">
                    Finalizar lote
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={() => setFinalizeOpen(false)}
                  className="rounded-xl border border-white/10 p-2 text-white/60"
                >
                  <X size={18} />
                </button>
              </div>
              {pendingAnomalies.length > 0 ? (
                <div className="mt-6 rounded-xl border border-amber-400/25 bg-amber-400/10 p-4 text-sm text-amber-100">
                  No puedes finalizar todavía. Faltan {pendingAnomalies.length}{" "}
                  anormalidades por recibir una decisión.
                </div>
              ) : (
                <div className="mt-6 space-y-4">
                  <label className="block rounded-2xl border border-red-400/20 bg-red-400/[0.06] p-4 text-sm font-medium text-red-100">
                    ¿Cuántas piezas no pasaron la inspección,
                    independientemente de anormalidades y rechazos por SPEC?
                    <input
                      type="number"
                      min="0"
                      max={lot.totalLotQuantity}
                      step="1"
                      value={finalRejectedPieces}
                      onChange={(event) =>
                        setFinalRejectedPieces(event.target.value)
                      }
                      placeholder="Cantidad total de piezas rechazadas"
                      className="mt-3 w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-white"
                    />
                    <span className="mt-2 block text-xs font-normal text-white/45">
                      Se notificará esta cantidad al PM y a Quality Management.
                    </span>
                  </label>
                  <div>
                    <h3 className="text-sm font-semibold text-amber-100">
                      Anormalidades que no pasaron
                    </h3>
                    <div className="mt-2 space-y-2">
                      {failedAnomalySummary.length === 0 ? (
                        <p className="rounded-xl border border-white/10 p-3 text-sm text-white/45">
                          No hay anormalidades rechazadas.
                        </p>
                      ) : (
                        failedAnomalySummary.map((item) => {
                          const targetReport = item.reports.find(
                            (report) => report.mode === "quantity",
                          );
                          return (
                            <div
                              key={item.title}
                              className="flex flex-col gap-3 rounded-xl border border-amber-400/15 bg-amber-400/[0.04] p-3 sm:flex-row sm:items-center sm:justify-between"
                            >
                              <div>
                                <p className="text-sm font-medium text-white">
                                  {item.title}
                                </p>
                                <p className="mt-1 text-xs text-white/45">
                                  {targetReport
                                    ? `${item.quantity} piezas registradas`
                                    : `${item.reports.length} muestras registradas`}
                                </p>
                              </div>
                              {targetReport && (
                                <button
                                  type="button"
                                  onClick={() => setQuantityReport(targetReport)}
                                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-emerald-400/20 px-3 py-2 text-xs font-medium text-emerald-200"
                                >
                                  <Plus size={14} /> Agregar piezas
                                </button>
                              )}
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-red-100">
                      Rechazos por SPEC
                    </h3>
                    <div className="mt-2 space-y-2">
                      {specReports.length === 0 ? (
                        <p className="rounded-xl border border-white/10 p-3 text-sm text-white/45">
                          No hay rechazos por SPEC registrados.
                        </p>
                      ) : (
                        specReports.map((report) => (
                          <div
                            key={report.id}
                            className="flex flex-col gap-3 rounded-xl border border-red-400/15 bg-red-400/[0.04] p-3 sm:flex-row sm:items-center sm:justify-between"
                          >
                            <div>
                              <p className="text-sm font-medium text-white">
                                {report.title}
                              </p>
                              <p className="mt-1 text-xs text-white/45">
                                {report.mode === "quantity"
                                  ? `${report.quantity || 0} piezas registradas`
                                  : `Muestra #${report.sampleNumber}`}
                              </p>
                            </div>
                            {report.mode === "quantity" && (
                              <button
                                type="button"
                                onClick={() => setQuantityReport(report)}
                                className="inline-flex items-center justify-center gap-2 rounded-xl border border-emerald-400/20 px-3 py-2 text-xs font-medium text-emerald-200"
                              >
                                <Plus size={14} /> Agregar piezas
                              </button>
                            )}
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                  {requiresNonconformance && (
                    <IncomingNonconformanceFields
                      value={nonconformanceDetails}
                      onChange={setNonconformanceDetails}
                    />
                  )}
                  {actionError && (
                    <p className="rounded-xl border border-red-400/20 bg-red-400/10 p-3 text-sm text-red-100">
                      {actionError}
                    </p>
                  )}
                  <button
                    type="button"
                    onClick={finalize}
                    disabled={reportsState.saving}
                    className="w-full rounded-xl border border-emerald-400/30 bg-emerald-400/15 px-5 py-3 text-sm font-medium text-emerald-100 disabled:opacity-50"
                  >
                    Confirmar y finalizar lote
                  </button>
                </div>
              )}
            </div>
          </div>,
          document.body,
        )}
      {rejectionPdfOpen && typeof document !== "undefined" && createPortal(
        <div className="fixed inset-0 z-[120] flex items-center justify-center overflow-y-auto bg-black/80 p-4 backdrop-blur-sm">
          <div className="max-h-[calc(100dvh-2rem)] w-full max-w-2xl overflow-y-auto rounded-3xl border border-red-400/20 bg-[#0d1512] p-5 shadow-2xl sm:p-7">
            <div className="flex items-start justify-between gap-4">
              <div><p className="text-xs font-semibold uppercase tracking-[0.2em] text-red-300">Formato oficial</p><h2 className="mt-2 text-xl font-semibold text-white">Reporte de rechazo</h2></div>
              <button type="button" onClick={() => setRejectionPdfOpen(false)} className="rounded-xl border border-white/10 p-2 text-white/60"><X size={18} /></button>
            </div>
            <div className="mt-6 space-y-4">
              <div className="grid gap-3 rounded-2xl border border-white/10 bg-black/15 p-4 text-sm text-white/60 sm:grid-cols-2">
                <p>Emitido por: <span className="text-white/85">{generatorName}</span></p><p>Fecha: <span className="text-white/85">{new Intl.DateTimeFormat("es-MX").format(new Date())}</span></p><p>PDO / PO #: <span className="text-white/85">{lot.purchaseOrder}</span></p><p>Piezas rechazadas: <span className="text-red-200">{lot.finalRejectedPieces}</span></p>
              </div>
              <label className="block text-sm text-white/70">Descripción general<textarea rows={4} value={rejectionSummary} onChange={(event) => setRejectionSummary(event.target.value)} className="mt-2 w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-white" /><span className="mt-1 block text-xs text-white/40">Se sugieren los títulos registrados; puedes redactar cómo quedará en el reporte.</span></label>
              <div><p className="text-sm text-white/70">Disposición</p><div className="mt-2 grid grid-cols-2 gap-2"><button type="button" onClick={() => setRejectionDisposition("scrap")} className={`rounded-xl border px-4 py-3 text-sm ${rejectionDisposition === "scrap" ? "border-red-400/35 bg-red-400/10 text-red-100" : "border-white/10 text-white/50"}`}>SCRAP</button><button type="button" onClick={() => setRejectionDisposition("other")} className={`rounded-xl border px-4 py-3 text-sm ${rejectionDisposition === "other" ? "border-red-400/35 bg-red-400/10 text-red-100" : "border-white/10 text-white/50"}`}>Otra</button></div>{rejectionDisposition === "other" && <input value={rejectionOtherDisposition} onChange={(event) => setRejectionOtherDisposition(event.target.value)} placeholder="Especifica la disposición" className="mt-2 w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-white" />}</div>
              <label className="block text-sm text-white/70">Observaciones (opcional)<textarea rows={3} value={rejectionObservations} onChange={(event) => setRejectionObservations(event.target.value)} className="mt-2 w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-white" /></label>
              {actionError && <p className="rounded-xl border border-red-400/20 bg-red-400/10 p-3 text-sm text-red-100">{actionError}</p>}
              <button type="button" onClick={() => run(async () => { if (!rejectionSummary.trim()) throw new Error("Agrega la descripción general."); if (rejectionDisposition === "other" && !rejectionOtherDisposition.trim()) throw new Error("Especifica la otra disposición."); await downloadOfficialReport("rejection-report", { rejectionSummary, disposition: rejectionDisposition, otherDisposition: rejectionOtherDisposition, rejectionObservations }, `Reporte_rechazo_${lot.lotName}.xlsx`); }, "No fue posible generar el reporte de rechazo.")} className="w-full rounded-xl border border-red-400/30 bg-red-400/15 px-5 py-3 text-sm font-medium text-red-100"><FileDown size={16} className="mr-2 inline" />Descargar XLSX oficial</button>
            </div>
          </div>
        </div>, document.body)}
      {nonconformancePdfOpen && typeof document !== "undefined" && createPortal(
        <div className="fixed inset-0 z-[120] flex items-center justify-center overflow-y-auto bg-black/80 p-4 backdrop-blur-sm">
          <div className="max-h-[calc(100dvh-2rem)] w-full max-w-2xl overflow-y-auto rounded-3xl border border-red-400/25 bg-[#0d1512] p-5 shadow-2xl sm:p-7">
            <div className="flex items-start justify-between gap-4"><div><p className="text-xs font-semibold uppercase tracking-[0.2em] text-red-300">Formato oficial</p><h2 className="mt-2 text-xl font-semibold text-white">Reporte de no conformidad</h2></div><button type="button" onClick={() => setNonconformancePdfOpen(false)} className="rounded-xl border border-white/10 p-2 text-white/60"><X size={18} /></button></div>
            <div className="mt-6 space-y-4">
              <div className="rounded-2xl border border-white/10 bg-black/15 p-4"><p className="text-xs font-semibold uppercase tracking-wider text-emerald-300">Descripción predeterminada</p><p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-white/65">{buildNonconformanceDescription(lot, reportsState.reports)}</p><p className="mt-2 text-xs text-white/35">Esta parte se genera con la inspección y no se puede editar.</p></div>
              <label className="block text-sm text-white/70">Comentario o detalle adicional (opcional)<textarea rows={4} value={nonconformanceExtraComment} onChange={(event) => setNonconformanceExtraComment(event.target.value)} className="mt-2 w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-white" /></label>
              {actionError && <p className="rounded-xl border border-red-400/20 bg-red-400/10 p-3 text-sm text-red-100">{actionError}</p>}
              <button type="button" onClick={() => run(() => downloadOfficialReport("nonconformance-report", { extraComment: nonconformanceExtraComment }, `No_conformidad_${lot.lotName}.docx`), "No fue posible generar la no conformidad.")} className="w-full rounded-xl border border-red-400/30 bg-red-400/15 px-5 py-3 text-sm font-medium text-red-100"><FileDown size={16} className="mr-2 inline" />Descargar DOCX oficial</button>
            </div>
          </div>
        </div>, document.body)}
    </section>
  );
}
