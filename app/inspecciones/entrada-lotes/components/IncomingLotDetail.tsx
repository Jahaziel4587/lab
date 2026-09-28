"use client";

import {
  AlertTriangle,
  Camera,
  Plus,
  ShieldAlert,
} from "lucide-react";
import { useMemo, useState } from "react";

import type {
  IncomingInspectionContext,
  IncomingInspectionLot,
  IncomingLotFindingKind,
  IncomingLotReport,
} from "../types";
import { useIncomingLotReports } from "../hooks/useIncomingLotReports";
import IncomingLotReportForm from "./IncomingLotReportForm";

type Props = {
  context: IncomingInspectionContext;
  lot: IncomingInspectionLot;
};

function ReportCard({
  report,
  disabled,
  onAddQuantity,
}: {
  report: IncomingLotReport;
  disabled: boolean;
  onAddQuantity: (report: IncomingLotReport) => void;
}) {
  return (
    <article className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-white/35">
            {report.kind === "anomaly" ? "Anormalidad" : "Rechazo por SPEC"}
          </p>
          <h4 className="mt-1 font-semibold text-white">{report.title}</h4>
        </div>
        <span className="rounded-full border border-white/10 px-3 py-1 text-xs text-white/55">
          {report.mode === "quantity"
            ? `${report.quantity || 0} piezas`
            : `Muestra #${report.sampleNumber}`}
        </span>
      </div>
      <p className="mt-3 whitespace-pre-wrap text-sm text-white/60">{report.description}</p>
      {report.photos.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-2">
          {report.photos.map((photo) => (
            <a key={photo.storagePath} href={photo.url} target="_blank" rel="noreferrer" className="block h-20 w-20 overflow-hidden rounded-xl border border-white/10">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={photo.url} alt={photo.name} className="h-full w-full object-cover" />
            </a>
          ))}
        </div>
      )}
      {report.mode === "quantity" && !disabled && (
        <button type="button" onClick={() => onAddQuantity(report)} className="mt-4 inline-flex items-center gap-2 rounded-xl border border-emerald-400/20 px-3 py-2 text-xs font-medium text-emerald-200 hover:bg-emerald-400/10">
          <Plus size={14} /> Agregar piezas
        </button>
      )}
    </article>
  );
}

export default function IncomingLotDetail({ context, lot }: Props) {
  const reportsState = useIncomingLotReports({ context, lot });
  const [reportKind, setReportKind] = useState<IncomingLotFindingKind | null>(null);
  const [quantityReport, setQuantityReport] = useState<IncomingLotReport | null>(null);
  const [quantityToAdd, setQuantityToAdd] = useState("");
  const [uniqueQuantity, setUniqueQuantity] = useState("");
  const [actionError, setActionError] = useState("");

  const anomalies = useMemo(() => reportsState.reports.filter((report) => report.kind === "anomaly"), [reportsState.reports]);
  const specRejections = useMemo(() => reportsState.reports.filter((report) => report.kind === "spec_rejection"), [reportsState.reports]);
  const needsThresholdReview =
    lot.reportedRejectedQuantity > lot.allowedRejectedQuantity &&
    lot.inspectionResult !== "will_fail" &&
    lot.reportedRejectedQuantity > Number(lot.lastReviewedReportedQuantity || 0);

  const submitQuantity = async () => {
    if (!quantityReport) return;
    try {
      setActionError("");
      await reportsState.addQuantity(quantityReport, Number(quantityToAdd));
      setQuantityReport(null);
      setQuantityToAdd("");
    } catch (cause) {
      setActionError(cause instanceof Error ? cause.message : "No fue posible agregar la cantidad.");
    }
  };

  const confirmUnique = async (value: number) => {
    try {
      setActionError("");
      await reportsState.confirmUniqueRejectedQuantity(value);
      setUniqueQuantity("");
    } catch (cause) {
      setActionError(cause instanceof Error ? cause.message : "No fue posible confirmar la cantidad.");
    }
  };

  return (
    <section className="space-y-6">
      <div className="rounded-2xl border border-emerald-400/20 bg-emerald-400/[0.06] p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-emerald-300">{lot.status === "in_progress" ? "Lote en curso" : "Lote finalizado"}</p>
            <h2 className="mt-2 text-2xl font-semibold text-white">{lot.lotName}</h2>
            <p className="mt-2 text-sm text-white/55">
              {lot.inspectedQuantity} por inspeccionar · {lot.totalLotQuantity} totales · {lot.allowedRejectedQuantity} rechazos permitidos
            </p>
            <p className="mt-1 text-xs text-white/40">Inspección {lot.inspectionType === "special" ? "especial" : "normal"} · Nivel {lot.inspectionLevel} · AQL {lot.aql}</p>
          </div>
          {lot.status === "in_progress" && (
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => setReportKind("anomaly")} className="inline-flex items-center gap-2 rounded-xl border border-amber-400/25 bg-amber-400/10 px-4 py-3 text-sm font-medium text-amber-100">
                <Camera size={16} /> Reportar anormalidad
              </button>
              <button type="button" onClick={() => setReportKind("spec_rejection")} className="inline-flex items-center gap-2 rounded-xl border border-red-400/25 bg-red-400/10 px-4 py-3 text-sm font-medium text-red-100">
                <ShieldAlert size={16} /> Reportar rechazo por SPEC
              </button>
            </div>
          )}
        </div>
      </div>

      {needsThresholdReview && (
        <div className="rounded-2xl border border-red-400/30 bg-red-400/[0.08] p-5">
          <div className="flex gap-3">
            <AlertTriangle className="mt-0.5 shrink-0 text-red-300" size={22} />
            <div className="flex-1">
              <h3 className="font-semibold text-red-100">Confirma la cantidad de piezas rechazadas</h3>
              <p className="mt-2 text-sm text-red-100/70">
                Los reportes por SPEC suman {lot.reportedRejectedQuantity} y el máximo permitido es {lot.allowedRejectedQuantity}. ¿Las cantidades corresponden a piezas diferentes?
              </p>
              <div className="mt-4 flex flex-col gap-3 sm:flex-row">
                <button type="button" onClick={() => confirmUnique(lot.reportedRejectedQuantity)} className="rounded-xl bg-red-400/15 px-4 py-3 text-sm font-medium text-red-100">
                  Sí, son piezas diferentes
                </button>
                <div className="flex flex-1 gap-2">
                  <input type="number" min="0" max={lot.allowedRejectedQuantity} value={uniqueQuantity} onChange={(event) => setUniqueQuantity(event.target.value)} placeholder="Cantidad real sin repetir" className="min-w-0 flex-1 rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-white" />
                  <button type="button" onClick={() => confirmUnique(Number(uniqueQuantity))} className="rounded-xl border border-white/10 px-4 py-2 text-sm text-white/70">Confirmar repetidas</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {lot.inspectionResult === "will_fail" && (
        <div className="rounded-2xl border border-red-400/25 bg-red-400/[0.07] p-4 text-sm font-medium text-red-100">
          Este lote está marcado como que no pasará la inspección por exceder los rechazos permitidos.
        </div>
      )}

      {(reportsState.error || actionError) && (
        <p className="rounded-xl border border-red-400/20 bg-red-400/10 p-3 text-sm text-red-100">{reportsState.error || actionError}</p>
      )}

      {quantityReport && (
        <div className="rounded-2xl border border-emerald-400/20 bg-emerald-400/[0.05] p-4">
          <p className="font-medium text-white">Agregar piezas a “{quantityReport.title}”</p>
          <p className="mt-1 text-xs text-white/40">La cantidad existente no se sustituirá ni podrá disminuirse.</p>
          <div className="mt-3 flex gap-2">
            <input type="number" min="1" value={quantityToAdd} onChange={(event) => setQuantityToAdd(event.target.value)} placeholder="¿Cuántas piezas agregarás?" className="min-w-0 flex-1 rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-white" />
            <button type="button" onClick={submitQuantity} className="rounded-xl bg-emerald-400/15 px-4 py-3 text-sm text-emerald-100">Sumar</button>
            <button type="button" onClick={() => setQuantityReport(null)} className="rounded-xl border border-white/10 px-4 py-3 text-sm text-white/50">Cancelar</button>
          </div>
        </div>
      )}

      {reportsState.loading ? (
        <p className="text-sm text-white/45">Cargando reportes...</p>
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          <div>
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-white">Anormalidades</h3>
              <span className="text-sm text-white/35">{anomalies.length}</span>
            </div>
            <div className="space-y-3">
              {anomalies.length === 0 ? <p className="rounded-2xl border border-dashed border-white/10 p-5 text-sm text-white/35">No hay anormalidades registradas.</p> : anomalies.map((report) => <ReportCard key={report.id} report={report} disabled={lot.status !== "in_progress"} onAddQuantity={setQuantityReport} />)}
            </div>
          </div>
          <div>
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-white">Rechazos por SPEC</h3>
              <span className="text-sm text-white/35">{specRejections.length}</span>
            </div>
            <div className="space-y-3">
              {specRejections.length === 0 ? <p className="rounded-2xl border border-dashed border-white/10 p-5 text-sm text-white/35">No hay rechazos por SPEC registrados.</p> : specRejections.map((report) => <ReportCard key={report.id} report={report} disabled={lot.status !== "in_progress"} onAddQuantity={setQuantityReport} />)}
            </div>
          </div>
        </div>
      )}

      {reportKind && (
        <IncomingLotReportForm
          initialKind={reportKind}
          lockedSpecMode={lot.specCountingMode}
          inspectedQuantity={lot.inspectedQuantity}
          saving={reportsState.saving}
          onSubmit={async (input) => {
            await reportsState.createReport(input);
            setReportKind(null);
          }}
          onCancel={() => setReportKind(null)}
        />
      )}
    </section>
  );
}
