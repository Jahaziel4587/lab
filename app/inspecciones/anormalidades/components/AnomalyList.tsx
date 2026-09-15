"use client";

import {
  AlertCircle,
  ChevronRight,
  CircleAlert,
  LoaderCircle,
} from "lucide-react";
import type { InspectionAnomaly } from "../types";

type AnomalyListProps = {
  anomalies: InspectionAnomaly[];
  loading?: boolean;
  error?: string | null;
  onSelect: (anomaly: InspectionAnomaly) => void;
};

function decisionLabel(anomaly: InspectionAnomaly) {
  if (!anomaly.title.trim()) return "Título pendiente";
  if (anomaly.status !== "resolved") return "Decisión pendiente";
  if (anomaly.decision === "pass") return "Pasa";
  if (anomaly.decision === "fail") return "No pasa";
  return "Sin decisión";
}

function decisionClass(anomaly: InspectionAnomaly) {
  if (!anomaly.title.trim() || anomaly.status !== "resolved") {
    return "border-amber-400/20 bg-amber-400/10 text-amber-200";
  }

  if (anomaly.decision === "pass") {
    return "border-emerald-400/20 bg-emerald-400/10 text-emerald-200";
  }

  if (anomaly.decision === "fail") {
    return "border-red-400/20 bg-red-400/10 text-red-200";
  }

  return "border-white/10 bg-white/5 text-white/50";
}

export default function AnomalyList({
  anomalies,
  loading = false,
  error,
  onSelect,
}: AnomalyListProps) {
  if (loading) {
    return (
      <div className="flex min-h-36 items-center justify-center rounded-2xl border border-white/10 bg-black/15">
        <LoaderCircle
          size={24}
          className="animate-spin text-emerald-300"
        />
        <span className="ml-3 text-sm text-white/55">
          Cargando anormalidades...
        </span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-red-400/20 bg-red-400/[0.06] p-5">
        <div className="flex items-start gap-3">
          <AlertCircle
            size={20}
            className="mt-0.5 shrink-0 text-red-300"
          />
          <div>
            <p className="font-medium text-red-100">
              No fue posible cargar las anormalidades
            </p>
            <p className="mt-1 text-sm text-red-100/65">
              {error}
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (anomalies.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-white/10 bg-black/10 p-8 text-center">
        <p className="text-sm text-white/45">
          Todavía no hay anormalidades reportadas.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {anomalies.map((anomaly, index) => (
        <button
          key={anomaly.id}
          type="button"
          onClick={() => onSelect(anomaly)}
          className="group flex min-h-20 w-full items-center justify-between gap-4 rounded-2xl border border-white/10 bg-white/[0.035] px-5 py-4 text-left transition hover:border-emerald-400/25 hover:bg-emerald-400/[0.055]"
        >
          <div className="flex min-w-0 items-start gap-3">
            <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-amber-400/20 bg-amber-400/10 text-amber-200">
              <CircleAlert size={17} />
            </div>

            <div className="min-w-0">
              <p className="font-medium text-white">
                {anomaly.title.trim() ||
                  `Reporte pendiente de título #${anomalies.length - index}`}
              </p>

              <p className="mt-1 text-xs text-white/40">
                Responsable:{" "}
                {anomaly.responsiblePmName ||
                  anomaly.responsiblePmEmail ||
                  "Sin asignar"}
              </p>

              <span
                className={`mt-2 inline-flex rounded-full border px-2.5 py-1 text-xs ${decisionClass(anomaly)}`}
              >
                {decisionLabel(anomaly)}
              </span>
            </div>
          </div>

          <ChevronRight
            size={19}
            className="shrink-0 text-white/35 transition group-hover:translate-x-0.5 group-hover:text-emerald-300"
          />
        </button>
      ))}
    </div>
  );
}
