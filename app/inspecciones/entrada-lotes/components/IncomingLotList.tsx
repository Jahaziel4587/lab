"use client";

import {
  AlertTriangle,
  ChevronRight,
  CircleCheck,
  Clock3,
  PackageOpen,
  Plus,
} from "lucide-react";

import type {
  IncomingInspectionLot,
} from "../types";

type Props = {
  lots: IncomingInspectionLot[];
  loading?: boolean;
  error?: string | null;
  onCreate: () => void;
  onOpen: (lotId: string) => void;
};

function formatDate(value: unknown) {
  if (!value) return "";

  const candidate = value as {
    toDate?: () => Date;
    seconds?: number;
  };
  const date =
    typeof candidate.toDate === "function"
      ? candidate.toDate()
      : typeof candidate.seconds === "number"
        ? new Date(candidate.seconds * 1000)
        : new Date(String(value));

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return new Intl.DateTimeFormat(
    "es-MX",
    {
      dateStyle: "medium",
      timeStyle: "short",
    },
  ).format(date);
}

export default function IncomingLotList({
  lots,
  loading = false,
  error,
  onCreate,
  onOpen,
}: Props) {
  return (
    <section className="space-y-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-white">
            Lotes de inspección
          </h2>
          <p className="mt-1 text-sm text-white/45">
            Los lotes se muestran del más reciente al más antiguo.
          </p>
        </div>

        <button
          type="button"
          onClick={onCreate}
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-emerald-400/30 bg-emerald-400/15 px-5 text-sm font-medium text-emerald-100 hover:bg-emerald-400/20"
        >
          <Plus size={17} />
          Agregar lote
        </button>
      </div>

      {loading ? (
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 text-sm text-white/50">
          Cargando lotes...
        </div>
      ) : error ? (
        <div className="rounded-2xl border border-red-400/20 bg-red-400/[0.07] p-5 text-sm text-red-100">
          {error}
        </div>
      ) : lots.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/15 bg-white/[0.025] p-8 text-center">
          <PackageOpen
            size={30}
            className="mx-auto text-white/25"
          />
          <p className="mt-3 font-medium text-white/70">
            Todavía no hay lotes registrados
          </p>
          <p className="mt-1 text-sm text-white/40">
            Agrega el primer lote para comenzar la inspección.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {lots.map((lot) => {
            const isFinalized =
              lot.status === "finalized";
            const willFail =
              lot.inspectionResult ===
              "will_fail";

            return (
              <button
                key={lot.id}
                type="button"
                onClick={() => onOpen(lot.id)}
                className="group flex w-full items-start gap-4 rounded-2xl border border-white/10 bg-white/[0.035] p-4 text-left transition hover:border-emerald-400/25 hover:bg-white/[0.055] sm:p-5"
              >
                <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border ${
                  willFail
                    ? "border-red-400/25 bg-red-400/10 text-red-300"
                    : isFinalized
                      ? "border-emerald-400/25 bg-emerald-400/10 text-emerald-300"
                      : "border-amber-400/25 bg-amber-400/10 text-amber-200"
                }`}>
                  {willFail ? (
                    <AlertTriangle size={20} />
                  ) : isFinalized ? (
                    <CircleCheck size={20} />
                  ) : (
                    <Clock3 size={20} />
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                    <p className="break-words font-semibold text-white">
                      {lot.lotName}
                    </p>
                    <span className={`w-fit rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide ${
                      isFinalized
                        ? "border-emerald-400/25 bg-emerald-400/10 text-emerald-200"
                        : "border-amber-400/25 bg-amber-400/10 text-amber-100"
                    }`}>
                      {isFinalized
                        ? "Finalizado"
                        : "En curso"}
                    </span>
                    {willFail && (
                      <span className="w-fit rounded-full border border-red-400/25 bg-red-400/10 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-red-200">
                        No pasará
                      </span>
                    )}
                  </div>

                  <p className="mt-2 text-sm text-white/55">{lot.totalLotQuantity} piezas totales · {lot.methodPlans.length} método{lot.methodPlans.length === 1 ? "" : "s"}</p>
                  <div className="mt-2 flex flex-wrap gap-1.5">{lot.methodPlans.map((plan) => <span key={plan.method} className="rounded-full border border-white/10 px-2 py-1 text-[11px] text-white/40">{plan.method === "documentary" ? "Documental" : plan.method === "visual" ? "Visual" : plan.method === "dimensional" ? "Dimensional" : "Funcional"}: {plan.inspectedQuantity} muestras · AQL {plan.aql}</span>)}</div>

                  {formatDate(lot.createdAt) && (
                    <p className="mt-1 text-xs text-white/30">
                      Creado el {formatDate(lot.createdAt)}
                    </p>
                  )}
                </div>

                <ChevronRight
                  size={19}
                  className="mt-2 shrink-0 text-white/30 transition group-hover:translate-x-0.5 group-hover:text-emerald-300"
                />
              </button>
            );
          })}
        </div>
      )}
    </section>
  );
}
