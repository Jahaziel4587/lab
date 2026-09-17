"use client";

import {
  Check,
} from "lucide-react";

type InspectionFlowProgressProps = {
  steps: string[];
  currentStep: number;
};

export default function InspectionFlowProgress({
  steps,
  currentStep,
}: InspectionFlowProgressProps) {
  const safeStep = Math.min(
    Math.max(currentStep, 1),
    steps.length,
  );

  return (
    <div
      className="mb-7 rounded-2xl border border-white/10 bg-black/20 p-4 sm:p-5"
      aria-label={`Paso ${safeStep} de ${steps.length}: ${steps[safeStep - 1]}`}
    >
      <div className="flex items-center justify-between gap-3 sm:hidden">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/40">
            Progreso de la inspección
          </p>
          <p className="mt-1 text-sm font-medium text-emerald-200">
            {steps[safeStep - 1]}
          </p>
        </div>

        <span className="shrink-0 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 text-xs font-semibold text-emerald-200">
          {safeStep} de {steps.length}
        </span>
      </div>

      <div className="mt-3 flex gap-1.5 sm:hidden">
        {steps.map((step, index) => (
          <span
            key={step}
            className={`h-1.5 flex-1 rounded-full transition-colors ${
              index < safeStep
                ? "bg-emerald-400"
                : "bg-white/10"
            }`}
          />
        ))}
      </div>

      <div className="hidden sm:block">
        <p className="mb-4 text-[11px] font-semibold uppercase tracking-[0.18em] text-white/40">
          Progreso de la inspección
        </p>

        <ol
          className="grid"
          style={{
            gridTemplateColumns:
              `repeat(${steps.length}, minmax(0, 1fr))`,
          }}
        >
          {steps.map((step, index) => {
            const number = index + 1;
            const completed = number < safeStep;
            const active = number === safeStep;

            return (
              <li
                key={step}
                className="relative flex min-w-0 flex-col items-center px-1 text-center"
              >
                {index > 0 && (
                  <span
                    className={`absolute right-1/2 top-4 h-px w-full ${
                      number <= safeStep
                        ? "bg-emerald-400/60"
                        : "bg-white/10"
                    }`}
                  />
                )}

                <span
                  className={`relative z-10 flex h-8 w-8 items-center justify-center rounded-full border text-xs font-semibold transition-colors ${
                    completed
                      ? "border-emerald-400 bg-emerald-400 text-emerald-950"
                      : active
                        ? "border-emerald-300 bg-emerald-400/15 text-emerald-200 ring-4 ring-emerald-400/10"
                        : "border-white/15 bg-[#111715] text-white/35"
                  }`}
                >
                  {completed ? (
                    <Check size={15} strokeWidth={3} />
                  ) : (
                    number
                  )}
                </span>

                <span
                  className={`mt-2 truncate text-xs ${
                    active
                      ? "font-semibold text-emerald-200"
                      : completed
                        ? "text-white/65"
                        : "text-white/30"
                  }`}
                >
                  {step}
                </span>
              </li>
            );
          })}
        </ol>
      </div>
    </div>
  );
}
