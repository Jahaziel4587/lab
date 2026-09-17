"use client";

import {
  useState,
} from "react";

import {
  AlertTriangle,
  CheckCircle2,
  LoaderCircle,
  X,
} from "lucide-react";

type NonConformityFinalizeDialogProps = {
  lotName: string;
  sampleQuantity: number;
  rejectedSampleCount: number;

  saving?: boolean;

  onConfirm: () => Promise<void>;
  onCancel: () => void;
};

export default function NonConformityFinalizeDialog({
  lotName,
  sampleQuantity,
  rejectedSampleCount,
  saving = false,
  onConfirm,
  onCancel,
}: NonConformityFinalizeDialogProps) {
  const [error, setError] =
    useState("");

  const handleConfirm =
    async () => {
      if (
        rejectedSampleCount < 1
      ) {
        setError(
          "Registra al menos una muestra rechazada antes de finalizar el lote.",
        );
        return;
      }

      try {
        setError("");
        await onConfirm();
      } catch (confirmError) {
        setError(
          confirmError instanceof Error
            ? confirmError.message
            : "No fue posible finalizar el lote.",
        );
      }
    };

  return (
    <div
      className="fixed inset-0 z-[120]
        flex items-center
        justify-center
        bg-black/75 p-3
        backdrop-blur-sm sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby={
        "finalize-nonconformity-title"
      }
    >
      <div
        className="max-h-[92dvh]
          w-full max-w-lg
          overflow-y-auto rounded-3xl
          border border-white/15
          bg-[#101713]
          shadow-2xl"
      >
        <div
          className="flex items-start
            justify-between gap-4
            border-b border-white/10
            p-5 sm:p-6"
        >
          <div
            className="flex items-start
              gap-4"
          >
            <div
              className="flex h-11 w-11
                shrink-0 items-center
                justify-center rounded-2xl
                border
                border-amber-400/25
                bg-amber-400/10
                text-amber-200"
            >
              <AlertTriangle
                size={21}
              />
            </div>

            <div>
              <h2
                id={
                  "finalize-nonconformity-title"
                }
                className="text-lg
                  font-semibold
                  text-white"
              >
                Finalizar lote
              </h2>

              <p
                className="mt-1
                  break-words text-sm
                  text-white/50"
              >
                {lotName}
              </p>
            </div>
          </div>

          <button
            type="button"
            aria-label="Cerrar"
            onClick={onCancel}
            disabled={saving}
            className="flex h-10 w-10
              shrink-0 items-center
              justify-center
              rounded-xl text-white/40
              transition
              hover:bg-white/[0.07]
              hover:text-white
              disabled:opacity-50"
          >
            <X size={19} />
          </button>
        </div>

        <div
          className="space-y-5
            p-5 sm:p-6"
        >
          <div
            className="grid
              grid-cols-2 gap-3"
          >
            <div
              className="rounded-2xl
                border border-white/10
                bg-black/20 p-4"
            >
              <p
                className="text-xs
                  uppercase
                  tracking-wider
                  text-white/40"
              >
                Muestras planeadas
              </p>

              <p
                className="mt-2
                  text-2xl font-semibold
                  text-white"
              >
                {sampleQuantity}
              </p>
            </div>

            <div
              className="rounded-2xl
                border
                border-red-400/20
                bg-red-400/[0.06]
                p-4"
            >
              <p
                className="text-xs
                  uppercase
                  tracking-wider
                  text-red-100/55"
              >
                Rechazadas
              </p>

              <p
                className="mt-2
                  text-2xl font-semibold
                  text-red-200"
              >
                {rejectedSampleCount}
              </p>
            </div>
          </div>

          <div
            className="rounded-2xl
              border
              border-amber-400/20
              bg-amber-400/[0.06]
              p-4"
          >
            <p
              className="text-sm
                font-medium
                text-amber-100"
            >
              Revisa la información antes
              de continuar
            </p>

            <p
              className="mt-2 text-sm
                leading-relaxed
                text-amber-100/65"
            >
              Después de finalizar el
              lote ya no será posible
              registrar nuevas muestras
              ni modificar sus reportes.
              Se notificará al Project
              Manager y al responsable
              de Calidad.
            </p>
          </div>

          {error && (
            <div
              role="alert"
              className="rounded-xl
                border border-red-400/25
                bg-red-400/[0.08]
                px-4 py-3 text-sm
                text-red-100"
            >
              {error}
            </div>
          )}

          <div
            className="flex
              flex-col-reverse gap-3
              sm:flex-row
              sm:justify-end"
          >
            <button
              type="button"
              onClick={onCancel}
              disabled={saving}
              className="min-h-11
                rounded-xl border
                border-white/15
                bg-white/[0.04]
                px-5 text-sm
                font-medium
                text-white/70
                transition
                hover:bg-white/[0.08]
                disabled:opacity-50"
            >
              Continuar registrando
            </button>

            <button
              type="button"
              onClick={
                handleConfirm
              }
              disabled={
                saving ||
                rejectedSampleCount <
                  1
              }
              className="inline-flex
                min-h-11 items-center
                justify-center gap-2
                rounded-xl border
                border-emerald-400/30
                bg-emerald-400/10
                px-5 text-sm
                font-medium
                text-emerald-200
                transition
                hover:bg-emerald-400/15
                disabled:cursor-not-allowed
                disabled:opacity-50"
            >
              {saving ? (
                <>
                  <LoaderCircle
                    size={17}
                    className="animate-spin"
                  />

                  Finalizando...
                </>
              ) : (
                <>
                  <CheckCircle2
                    size={17}
                  />

                  Finalizar lote
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}