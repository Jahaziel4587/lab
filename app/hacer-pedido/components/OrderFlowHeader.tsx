"use client";

import { FiArrowLeft } from "react-icons/fi";

const STEPS = [
  "Proyecto",
  "Servicio",
  "Técnica",
  "Material",
  "Especificaciones",
];

type OrderFlowHeaderProps = {
  step: number;
  title: string;
  description?: string;
  onBack: () => void;
  backLabel?: string;
  detail?: string;
};

export default function OrderFlowHeader({
  step,
  title,
  description,
  onBack,
  backLabel = "Regresar",
  detail,
}: OrderFlowHeaderProps) {
  const safeStep = Math.min(Math.max(step, 1), STEPS.length);

  return (
    <div className="mb-5 sm:mb-6">
      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.05] px-3.5 text-sm font-medium text-white/80 transition hover:bg-white/10 hover:text-white sm:min-h-10 sm:rounded-full sm:px-4"
        >
          <FiArrowLeft className="shrink-0" />
          <span>{backLabel}</span>
        </button>

        <span className="shrink-0 text-xs font-medium text-white/45 sm:hidden">
          {safeStep} / {STEPS.length}
        </span>
      </div>

      <div className="mt-4 sm:mt-5">
        <div className="sm:hidden">
          <div className="flex gap-1.5" aria-label={`Paso ${safeStep} de ${STEPS.length}`}>
            {STEPS.map((label, index) => (
              <span
                key={label}
                className={`h-1.5 flex-1 rounded-full ${
                  index < safeStep ? "bg-emerald-400" : "bg-white/10"
                }`}
              />
            ))}
          </div>
          <p className="mt-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-300/75">
            {STEPS[safeStep - 1]}
          </p>
        </div>

        <h1 className="mt-1 text-2xl font-semibold leading-tight text-white sm:text-3xl">
          {title}
        </h1>

        {(description || detail) && (
          <div className="mt-2 space-y-1">
            {description && (
              <p className="max-w-2xl text-sm leading-relaxed text-white/55">
                {description}
              </p>
            )}
            {detail && (
              <p className="text-xs text-white/45 sm:text-sm">
                {detail}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
