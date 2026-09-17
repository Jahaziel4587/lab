"use client";

import {
  useMemo,
  useState,
} from "react";

import {
  CheckSquare2,
  FileDown,
  Image as ImageIcon,
  LoaderCircle,
  Square,
  X,
} from "lucide-react";

import {
  useAuth,
} from "@/src/Context/AuthContext";

import type {
  AnomalyOccurrence,
  InspectionAnomaly,
} from "../types";

import {
  generateAnomalyPdf,
} from "../pdf/generateAnomalyPdf";

type Props = {
  anomaly: InspectionAnomaly;
  occurrences:
    AnomalyOccurrence[];
  componentName: string;
  onClose: () => void;
};

function timestampValue(
  value: unknown,
) {
  if (!value) return 0;

  const candidate =
    value as {
      toMillis?: () => number;
      seconds?: number;
    };

  if (
    typeof candidate.toMillis ===
    "function"
  ) {
    return candidate.toMillis();
  }

  if (
    typeof candidate.seconds ===
    "number"
  ) {
    return (
      candidate.seconds * 1000
    );
  }

  const parsed =
    new Date(
      String(value),
    ).getTime();

  return Number.isNaN(parsed)
    ? 0
    : parsed;
}

export default function AnomalyPdfDialog({
  anomaly,
  occurrences,
  componentName,
  onClose,
}: Props) {
  const { user } = useAuth();

  const orderedOccurrences =
    useMemo(
      () =>
        [...occurrences].sort(
          (first, second) =>
            timestampValue(
              first.createdAt,
            ) -
            timestampValue(
              second.createdAt,
            ),
        ),
      [occurrences],
    );

  const [
    selectedIds,
    setSelectedIds,
  ] = useState<Set<string>>(
    () => new Set(),
  );

  const [
    generating,
    setGenerating,
  ] = useState(false);

  const [
    error,
    setError,
  ] = useState("");

  const allSelected =
    orderedOccurrences.length > 0 &&
    selectedIds.size ===
      orderedOccurrences.length;

  const toggleOccurrence = (
    occurrenceId: string,
  ) => {
    setSelectedIds(
      (current) => {
        const next =
          new Set(current);

        if (
          next.has(occurrenceId)
        ) {
          next.delete(
            occurrenceId,
          );
        } else {
          next.add(
            occurrenceId,
          );
        }

        return next;
      },
    );
  };

  const toggleAll = () => {
    if (allSelected) {
      setSelectedIds(
        new Set(),
      );

      return;
    }

    setSelectedIds(
      new Set(
        orderedOccurrences.map(
          (occurrence) =>
            occurrence.id,
        ),
      ),
    );
  };

  const generatePdf =
    async () => {
      try {
        setError("");

        if (
          selectedIds.size === 0
        ) {
          throw new Error(
            "Selecciona al menos un reporte.",
          );
        }

        if (!user) {
          throw new Error(
            "No hay una sesión activa.",
          );
        }

        setGenerating(true);

        const idToken =
          await user.getIdToken();

        const selectedOccurrences =
          orderedOccurrences.filter(
            (occurrence) =>
              selectedIds.has(
                occurrence.id,
              ),
          );

        await generateAnomalyPdf({
          anomaly,
          occurrences:
            selectedOccurrences,
          componentName,
          idToken,
        });
      } catch (cause) {
        console.error(
          "Error generando PDF:",
          cause,
        );

        setError(
          cause instanceof Error
            ? cause.message
            : "No fue posible generar el PDF.",
        );
      } finally {
        setGenerating(false);
      }
    };

  return (
    <div
      className="fixed inset-0 z-[70]
        overflow-y-auto bg-black/80
        p-2 backdrop-blur-sm sm:p-4"
    >
      <div
        className="mx-auto my-2
          flex max-h-[calc(100dvh-1rem)]
          w-full max-w-3xl flex-col
          overflow-hidden rounded-2xl
          border border-emerald-400/20
          bg-[#101715] shadow-2xl
          sm:my-6
          sm:max-h-[calc(100dvh-3rem)]"
      >
        <header
          className="flex shrink-0
            items-start justify-between
            gap-4 border-b
            border-white/10 p-4
            sm:p-5"
        >
          <div>
            <p
              className="text-xs
                font-semibold uppercase
                tracking-wider
                text-emerald-300"
            >
              Generar PDF
            </p>

            <h2
              className="mt-1 text-xl
                font-semibold text-white"
            >
              Selecciona los reportes
            </h2>

            <p
              className="mt-2 text-sm
                text-white/50"
            >
              Solo se incluirán los
              reportes seleccionados.
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={generating}
            className="flex h-10 w-10
              shrink-0 items-center
              justify-center rounded-xl
              border border-white/10
              text-white/55 transition
              hover:bg-white/[0.06]"
            aria-label="Cerrar"
          >
            <X size={18} />
          </button>
        </header>

        <div
          className="flex shrink-0
            flex-wrap items-center
            justify-between gap-3
            border-b border-white/10
            px-4 py-3 sm:px-5"
        >
          <p
            className="text-sm
              text-white/55"
          >
            {selectedIds.size} de{" "}
            {orderedOccurrences.length}
            {" "}seleccionados
          </p>

          <button
            type="button"
            onClick={toggleAll}
            className="text-sm
              font-medium
              text-emerald-300
              hover:underline"
          >
            {allSelected
              ? "Quitar selección"
              : "Seleccionar todos"}
          </button>
        </div>

        <div
          className="min-h-0 flex-1
            space-y-3 overflow-y-auto
            p-4 sm:p-5"
        >
          {orderedOccurrences.map(
            (
              occurrence,
              index,
            ) => {
              const selected =
                selectedIds.has(
                  occurrence.id,
                );

              return (
                <button
                  key={
                    occurrence.id
                  }
                  type="button"
                  onClick={() =>
                    toggleOccurrence(
                      occurrence.id,
                    )
                  }
                  className={
                    "flex w-full " +
                    "items-start gap-3 " +
                    "rounded-2xl border " +
                    "p-4 text-left " +
                    "transition " +
                    (
                      selected
                        ? "border-emerald-400/40 bg-emerald-400/[0.09]"
                        : "border-white/10 bg-white/[0.025] hover:bg-white/[0.05]"
                    )
                  }
                >
                  <span
                    className="mt-0.5
                      shrink-0
                      text-emerald-300"
                  >
                    {selected ? (
                      <CheckSquare2
                        size={21}
                      />
                    ) : (
                      <Square
                        size={21}
                        className="text-white/35"
                      />
                    )}
                  </span>

                  <span
                    className="min-w-0
                      flex-1"
                  >
                    <span
                      className="text-xs
                        font-semibold
                        uppercase
                        tracking-wider
                        text-amber-200"
                    >
                      Reporte{" "}
                      {index + 1}
                    </span>

                    <span
                      className="mt-2
                        block font-medium
                        text-white"
                    >
                      Lote{" "}
                      {occurrence.lot}
                    </span>

                    <span
                      className="mt-1
                        block text-sm
                        text-white/55"
                    >
                      Muestra{" "}
                      {
                        occurrence
                          .affectedQuantity
                      }
                      {" "}de{" "}
                      {
                        occurrence
                          .sampleQuantity
                      }
                    </span>

                    <span
                      className="mt-3
                        line-clamp-3
                        block whitespace-pre-wrap
                        text-sm
                        leading-relaxed
                        text-white/70"
                    >
                      {
                        occurrence
                          .description
                      }
                    </span>

                    <span
                      className="mt-3
                        inline-flex
                        items-center gap-2
                        text-xs
                        text-white/40"
                    >
                      <ImageIcon
                        size={14}
                      />

                      {
                        occurrence
                          .photos.length
                      }
                      {" "}
                      {occurrence
                        .photos.length === 1
                        ? "fotografía"
                        : "fotografías"}
                    </span>
                  </span>
                </button>
              );
            },
          )}
        </div>

        <footer
          className="shrink-0
            border-t border-white/10
            bg-black/20 p-4 sm:p-5"
        >
          {error && (
            <div
              role="alert"
              className="mb-4
                rounded-xl border
                border-red-400/25
                bg-red-400/[0.08]
                px-4 py-3 text-sm
                text-red-100"
            >
              {error}
            </div>
          )}

          <div
            className="flex flex-col-reverse
              gap-3 sm:flex-row
              sm:justify-end"
          >
            <button
              type="button"
              onClick={onClose}
              disabled={generating}
              className="min-h-11
                rounded-xl border
                border-white/10
                px-5 text-sm
                text-white/65"
            >
              Cancelar
            </button>

            <button
              type="button"
              onClick={generatePdf}
              disabled={
                generating ||
                selectedIds.size === 0
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
                disabled:opacity-40"
            >
              {generating ? (
                <LoaderCircle
                  size={17}
                  className="animate-spin"
                />
              ) : (
                <FileDown
                  size={17}
                />
              )}

              {generating
                ? "Generando PDF..."
                : "Generar PDF"}
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}