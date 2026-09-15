"use client";

import { LoaderCircle, Save } from "lucide-react";
import { FormEvent, useEffect, useState } from "react";
import type { AnomalyDecision, InspectionAnomaly } from "../types";

type Props = {
  anomaly: InspectionAnomaly;
  canDecide: boolean;
  saving: boolean;
  onSave: (input: {
    title: string;
    decision: Exclude<AnomalyDecision, null>;
    comment: string;
  }) => Promise<void>;
};

export default function AnomalyDecisionForm({
  anomaly,
  canDecide,
  saving,
  onSave,
}: Props) {
  const [title, setTitle] = useState(anomaly.title);
  const [decision, setDecision] =
    useState<Exclude<AnomalyDecision, null> | "">(anomaly.decision || "");
  const [comment, setComment] = useState(anomaly.decisionComment || "");
  const [error, setError] = useState("");

  useEffect(() => {
    setTitle(anomaly.title);
    setDecision(anomaly.decision || "");
    setComment(anomaly.decisionComment || "");
  }, [anomaly.id, anomaly.title, anomaly.decision, anomaly.decisionComment]);

  if (anomaly.status === "resolved") {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-5">
        <p className="text-xs font-semibold uppercase tracking-wider text-white/45">Decisión registrada</p>
        <p className={`mt-3 text-lg font-semibold ${
          anomaly.decision === "pass" ? "text-emerald-300" : "text-red-300"
        }`}>
          {anomaly.decision === "pass" ? "Pasa" : "No pasa"}
        </p>
        {anomaly.decisionComment && (
          <p className="mt-3 whitespace-pre-wrap text-sm text-white/65">{anomaly.decisionComment}</p>
        )}
        <p className="mt-3 text-xs text-white/35">
          Decidido por {anomaly.decidedByName || anomaly.decidedByEmail || "PM responsable"}
        </p>
      </div>
    );
  }

  if (!canDecide) {
    return (
      <div className="rounded-2xl border border-amber-400/20 bg-amber-400/[0.06] p-5 text-sm text-amber-100/75">
        Este reporte está pendiente de que {anomaly.responsiblePmName || anomaly.responsiblePmEmail || "el PM responsable"} asigne un título y tome la decisión.
      </div>
    );
  }

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const cleanTitle = title.trim().replace(/\s+/g, " ");
    if (!cleanTitle) return setError("Escribe un título para la anormalidad.");
    if (!decision) return setError("Selecciona si la condición pasa o no pasa.");
    try {
      setError("");
      await onSave({ title: cleanTitle, decision, comment: comment.trim() });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No fue posible guardar la decisión.");
    }
  };

  return (
    <form onSubmit={submit} className="rounded-2xl border border-emerald-400/20 bg-emerald-400/[0.045] p-5">
      <p className="text-xs font-semibold uppercase tracking-wider text-emerald-300">Decisión del PM</p>

      <label className="mt-4 block text-sm text-white/70">
        Título de la anormalidad
        <input
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          disabled={saving}
          placeholder="Ej. Puntos negros"
          className="mt-2 min-h-12 w-full rounded-xl border border-white/15 bg-black/25 px-4 text-white outline-none focus:border-emerald-400/45"
        />
      </label>

      <fieldset className="mt-4">
        <legend className="text-sm text-white/70">Decisión</legend>
        <div className="mt-2 grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => setDecision("pass")}
            disabled={saving}
            className={`min-h-11 rounded-xl border transition ${
              decision === "pass"
                ? "border-emerald-400/45 bg-emerald-400/15 text-emerald-200"
                : "border-white/10 bg-white/[0.03] text-white/60"
            }`}
          >
            Pasa
          </button>
          <button
            type="button"
            onClick={() => setDecision("fail")}
            disabled={saving}
            className={`min-h-11 rounded-xl border transition ${
              decision === "fail"
                ? "border-red-400/45 bg-red-400/15 text-red-200"
                : "border-white/10 bg-white/[0.03] text-white/60"
            }`}
          >
            No pasa
          </button>
        </div>
      </fieldset>

      <label className="mt-4 block text-sm text-white/70">
        Comentario de la decisión
        <textarea
          value={comment}
          onChange={(event) => setComment(event.target.value)}
          disabled={saving}
          rows={3}
          placeholder="Indica el criterio o las instrucciones para el inspector."
          className="mt-2 w-full resize-y rounded-xl border border-white/15 bg-black/25 px-4 py-3 text-white outline-none focus:border-emerald-400/45"
        />
      </label>

      {error && <p className="mt-3 text-sm text-red-300">{error}</p>}

      <button
        type="submit"
        disabled={saving || !title.trim() || !decision}
        className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-xl border border-emerald-400/30 bg-emerald-400/15 px-5 text-sm font-medium text-emerald-100 disabled:opacity-40"
      >
        {saving ? <LoaderCircle size={17} className="animate-spin" /> : <Save size={17} />}
        Guardar título y decisión
      </button>
    </form>
  );
}
