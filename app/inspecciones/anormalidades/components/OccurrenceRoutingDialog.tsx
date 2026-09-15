"use client";

import {
  LoaderCircle,
  X,
} from "lucide-react";
import {
  FormEvent,
  useState,
} from "react";

import type {
  InspectionAnomaly,
} from "../types";

type Props = {
  occurrenceId: string;
  anomalies:
    InspectionAnomaly[];
  saving: boolean;
  onCancel: () => void;
  onSubmit: (input: {
    occurrenceId: string;
    mode:
      | "new"
      | "existing";
    existingAnomalyId?: string;
    title?: string;
    decision?:
      | "pass"
      | "fail";
    comment?: string;
  }) => Promise<void>;
};

export default function OccurrenceRoutingDialog({
  occurrenceId,
  anomalies,
  saving,
  onCancel,
  onSubmit,
}: Props) {
  const [mode, setMode] =
    useState<
      "new" |
      "existing" |
      ""
    >("");

  const [
    existingAnomalyId,
    setExistingAnomalyId,
  ] = useState("");

  const [title, setTitle] =
    useState("");

  const [decision, setDecision] =
    useState<
      "pass" |
      "fail" |
      ""
    >("");

  const [comment, setComment] =
    useState("");

  const [error, setError] =
    useState("");

  const submit = async (
    event: FormEvent,
  ) => {
    event.preventDefault();

    if (!mode) {
      setError(
        "Selecciona qué deseas hacer.",
      );
      return;
    }

    if (
      mode === "existing" &&
      !existingAnomalyId
    ) {
      setError(
        "Selecciona una anormalidad existente.",
      );
      return;
    }

    if (
      mode === "new" &&
      (
        !title.trim() ||
        !decision
      )
    ) {
      setError(
        "El título y la decisión son obligatorios.",
      );
      return;
    }

    try {
      setError("");

      await onSubmit({
        occurrenceId,
        mode,
        ...(mode === "existing"
          ? {
              existingAnomalyId,
            }
          : {
              title:
                title
                  .trim()
                  .replace(
                    /\s+/g,
                    " ",
                  ),
              decision:
                decision ||
                undefined,
              comment:
                comment.trim(),
            }),
      });
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "No fue posible procesar el reporte.",
      );
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
    >
      <form
        onSubmit={submit}
        className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl border border-emerald-400/25 bg-[#101715] p-6 shadow-2xl"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-emerald-300">
              Clasificar reporte
            </p>

            <h2 className="mt-2 text-xl font-semibold text-white">
              Este reporte no corresponde con la decisión anterior
            </h2>
          </div>

          <button
            type="button"
            onClick={onCancel}
            disabled={saving}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/10 text-white/55"
            aria-label="Cerrar"
          >
            <X size={18} />
          </button>
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          <button
            type="button"
            onClick={() =>
              setMode("new")
            }
            disabled={saving}
            className={`rounded-xl border p-4 text-left transition ${
              mode === "new"
                ? "border-emerald-400/45 bg-emerald-400/12"
                : "border-white/10 bg-white/[0.03]"
            }`}
          >
            <span className="font-medium text-white">
              Hacerlo nueva anormalidad
            </span>
            <span className="mt-1 block text-xs text-white/45">
              Asigna un título y una decisión independientes.
            </span>
          </button>

          <button
            type="button"
            onClick={() =>
              setMode("existing")
            }
            disabled={saving}
            className={`rounded-xl border p-4 text-left transition ${
              mode === "existing"
                ? "border-emerald-400/45 bg-emerald-400/12"
                : "border-white/10 bg-white/[0.03]"
            }`}
          >
            <span className="font-medium text-white">
              Relacionar a una existente
            </span>
            <span className="mt-1 block text-xs text-white/45">
              Mueve el reporte al chat y decisión seleccionados.
            </span>
          </button>
        </div>

        {mode === "existing" && (
          <label className="mt-5 block text-sm text-white/70">
            Anormalidad existente
            <select
              value={
                existingAnomalyId
              }
              onChange={(event) =>
                setExistingAnomalyId(
                  event.target.value,
                )
              }
              disabled={saving}
              className="mt-2 min-h-12 w-full rounded-xl border border-white/15 bg-[#101715] px-4 text-white outline-none focus:border-emerald-400/45"
            >
              <option value="">
                Selecciona un título
              </option>

              {anomalies.map(
                (anomaly) => (
                  <option
                    key={anomaly.id}
                    value={anomaly.id}
                  >
                    {anomaly.title}
                    {anomaly.decision
                      ? ` — ${anomaly.decision === "pass" ? "Pass" : "Fail"}`
                      : ""}
                  </option>
                ),
              )}
            </select>

            {anomalies.length === 0 && (
              <span className="mt-2 block text-xs text-amber-200/70">
                No hay otra anormalidad con título disponible.
              </span>
            )}
          </label>
        )}

        {mode === "new" && (
          <>
            <label className="mt-5 block text-sm text-white/70">
              Título de la nueva anormalidad
              <input
                value={title}
                onChange={(event) =>
                  setTitle(
                    event.target.value,
                  )
                }
                disabled={saving}
                placeholder="Ej. Deformación fuera de criterio"
                className="mt-2 min-h-12 w-full rounded-xl border border-white/15 bg-black/25 px-4 text-white outline-none focus:border-emerald-400/45"
              />
            </label>

            <fieldset className="mt-5">
              <legend className="text-sm text-white/70">
                Decisión
              </legend>

              <div className="mt-2 grid grid-cols-2 gap-3">
                {(
                  [
                    [
                      "pass",
                      "Pass",
                    ],
                    [
                      "fail",
                      "Fail",
                    ],
                  ] as const
                ).map(
                  ([
                    value,
                    label,
                  ]) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() =>
                        setDecision(
                          value,
                        )
                      }
                      disabled={saving}
                      className={`min-h-12 rounded-xl border font-medium transition ${
                        decision ===
                        value
                          ? value ===
                            "pass"
                            ? "border-emerald-400/45 bg-emerald-400/15 text-emerald-200"
                            : "border-red-400/45 bg-red-400/15 text-red-200"
                          : "border-white/10 bg-white/[0.03] text-white/60"
                      }`}
                    >
                      {label}
                    </button>
                  ),
                )}
              </div>
            </fieldset>

            <label className="mt-5 block text-sm text-white/70">
              Comentario
              <textarea
                value={comment}
                onChange={(event) =>
                  setComment(
                    event.target.value,
                  )
                }
                disabled={saving}
                rows={3}
                placeholder="Opcional"
                className="mt-2 w-full rounded-xl border border-white/15 bg-black/25 px-4 py-3 text-white outline-none focus:border-emerald-400/45"
              />
            </label>
          </>
        )}

        {error && (
          <p className="mt-4 text-sm text-red-300">
            {error}
          </p>
        )}

        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={saving}
            className="min-h-11 rounded-xl border border-white/10 px-5 text-sm text-white/60"
          >
            Cancelar
          </button>

          <button
            type="submit"
            disabled={
              saving ||
              !mode ||
              (
                mode ===
                  "existing" &&
                !existingAnomalyId
              ) ||
              (
                mode === "new" &&
                (
                  !title.trim() ||
                  !decision
                )
              )
            }
            className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-emerald-400/30 bg-emerald-400/15 px-5 text-sm font-medium text-emerald-100 disabled:opacity-40"
          >
            {saving && (
              <LoaderCircle
                size={17}
                className="animate-spin"
              />
            )}
            Confirmar
          </button>
        </div>
      </form>
    </div>
  );
}
