"use client";

import {
  LoaderCircle,
  Save,
  X,
} from "lucide-react";
import {
  FormEvent,
  useEffect,
  useState,
} from "react";
import type {
  AnomalyDecision,
  InspectionAnomaly,
} from "../types";

type Props = {
  anomaly: InspectionAnomaly;
  saving: boolean;
  onCancel: () => void;
  onSave: (input: {
    title: string;
    decision: Exclude<AnomalyDecision, null>;
    comment: string;
  }) => Promise<void>;
};

export default function AnomalyDecisionForm({
  anomaly,
  saving,
  onCancel,
  onSave,
}: Props) {
  const [title, setTitle] =
    useState(anomaly.title);

  const [decision, setDecision] =
    useState<
      Exclude<AnomalyDecision, null> | ""
    >(anomaly.decision || "");

  const [comment, setComment] =
    useState(
      anomaly.decisionComment || "",
    );

  const [error, setError] =
    useState("");

  useEffect(() => {
    setTitle(anomaly.title);
    setDecision(
      anomaly.decision || "",
    );
    setComment(
      anomaly.decisionComment || "",
    );
  }, [
    anomaly.id,
    anomaly.title,
    anomaly.decision,
    anomaly.decisionComment,
  ]);

  const submit = async (
    event: FormEvent,
  ) => {
    event.preventDefault();

    const cleanTitle =
      title.trim().replace(/\s+/g, " ");

    if (!cleanTitle) {
      setError(
        "Escribe un título para la anormalidad.",
      );
      return;
    }

    if (!decision) {
      setError(
        "Selecciona Pass o Fail.",
      );
      return;
    }

    try {
      setError("");

      await onSave({
        title: cleanTitle,
        decision,
        comment: comment.trim(),
      });
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "No fue posible guardar la decisión.",
      );
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="decision-title"
    >
      <form
        onSubmit={submit}
        className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl border border-emerald-400/25 bg-[#101715] p-6 shadow-2xl"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-emerald-300">
              Decisión del PM
            </p>

            <h2
              id="decision-title"
              className="mt-2 text-xl font-semibold text-white"
            >
              Cerrar anormalidad
            </h2>

            <p className="mt-2 text-sm text-white/55">
              El título y la decisión son obligatorios.
            </p>
          </div>

          <button
            type="button"
            onClick={onCancel}
            disabled={saving}
            aria-label="Cerrar"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/10 text-white/55 transition hover:bg-white/5 hover:text-white"
          >
            <X size={18} />
          </button>
        </div>

        <label className="mt-6 block text-sm text-white/70">
          Título de la anormalidad
          <input
            autoFocus
            value={title}
            onChange={(event) =>
              setTitle(event.target.value)
            }
            disabled={saving}
            placeholder="Ej. Puntos negros"
            className="mt-2 min-h-12 w-full rounded-xl border border-white/15 bg-black/25 px-4 text-white outline-none focus:border-emerald-400/45"
          />
        </label>

        <fieldset className="mt-5">
          <legend className="text-sm text-white/70">
            Decisión
          </legend>

          <div className="mt-2 grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() =>
                setDecision("pass")
              }
              disabled={saving}
              className={`min-h-12 rounded-xl border font-medium transition ${
                decision === "pass"
                  ? "border-emerald-400/50 bg-emerald-400/15 text-emerald-200"
                  : "border-white/10 bg-white/[0.03] text-white/60 hover:bg-white/[0.06]"
              }`}
            >
              Pass
            </button>

            <button
              type="button"
              onClick={() =>
                setDecision("fail")
              }
              disabled={saving}
              className={`min-h-12 rounded-xl border font-medium transition ${
                decision === "fail"
                  ? "border-red-400/50 bg-red-400/15 text-red-200"
                  : "border-white/10 bg-white/[0.03] text-white/60 hover:bg-white/[0.06]"
              }`}
            >
              Fail
            </button>
          </div>
        </fieldset>

        <label className="mt-5 block text-sm text-white/70">
          Comentario de la decisión
          <textarea
            value={comment}
            onChange={(event) =>
              setComment(event.target.value)
            }
            disabled={saving}
            rows={3}
            placeholder="Opcional: criterio o instrucciones para el inspector."
            className="mt-2 w-full resize-y rounded-xl border border-white/15 bg-black/25 px-4 py-3 text-white outline-none focus:border-emerald-400/45"
          />
        </label>

        {error && (
          <p className="mt-3 text-sm text-red-300">
            {error}
          </p>
        )}

        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onCancel}
            disabled={saving}
            className="min-h-11 rounded-xl border border-white/10 px-5 text-sm text-white/60 transition hover:bg-white/5"
          >
            Cancelar
          </button>

          <button
            type="submit"
            disabled={
              saving ||
              !title.trim() ||
              !decision
            }
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-emerald-400/30 bg-emerald-400/15 px-5 text-sm font-medium text-emerald-100 transition hover:bg-emerald-400/20 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {saving ? (
              <LoaderCircle
                size={17}
                className="animate-spin"
              />
            ) : (
              <Save size={17} />
            )}
            Guardar decisión
          </button>
        </div>
      </form>
    </div>
  );
}
