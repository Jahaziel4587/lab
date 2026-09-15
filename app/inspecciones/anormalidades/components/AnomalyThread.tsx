"use client";

import { FormEvent, useState } from "react";
import { Image as ImageIcon, LoaderCircle, Send } from "lucide-react";
import AnomalyDecisionForm from "./AnomalyDecisionForm";
import type {
  AnomalyDecision,
  AnomalyMessage,
  AnomalyOccurrence,
  InspectionAnomaly,
} from "../types";

type Props = {
  anomaly: InspectionAnomaly;
  occurrences: AnomalyOccurrence[];
  messages: AnomalyMessage[];
  canDecide: boolean;
  sending: boolean;
  savingDecision: boolean;
  onSendMessage: (text: string) => Promise<void>;
  onSaveDecision: (input: {
    title: string;
    decision: Exclude<AnomalyDecision, null>;
    comment: string;
  }) => Promise<void>;
};

function formatDate(value: unknown) {
  if (!value) return "";
  const candidate = value as { toDate?: () => Date; seconds?: number };
  const date = typeof candidate.toDate === "function"
    ? candidate.toDate()
    : typeof candidate.seconds === "number"
      ? new Date(candidate.seconds * 1000)
      : new Date(String(value));
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("es-MX", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export default function AnomalyThread({
  anomaly,
  occurrences,
  messages,
  canDecide,
  sending,
  savingDecision,
  onSendMessage,
  onSaveDecision,
}: Props) {
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const submitMessage = async (event: FormEvent) => {
    event.preventDefault();
    if (!message.trim()) return;
    try {
      setError("");
      await onSendMessage(message);
      setMessage("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No fue posible enviar el mensaje.");
    }
  };

  return (
    <div className="space-y-5">
      <AnomalyDecisionForm
        anomaly={anomaly}
        canDecide={canDecide}
        saving={savingDecision}
        onSave={onSaveDecision}
      />

      <div className="space-y-4">
        {occurrences.map((occurrence) => (
          <article key={occurrence.id} className="rounded-2xl border border-white/10 bg-white/[0.035] p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="font-medium text-white">{occurrence.createdByName || occurrence.createdByEmail}</p>
                <p className="mt-1 text-xs text-white/35">{formatDate(occurrence.createdAt)}</p>
              </div>
              <span className="rounded-full border border-white/10 bg-black/20 px-3 py-1 text-xs text-white/55">
                Lote {occurrence.lot}
              </span>
            </div>

            <p className="mt-4 whitespace-pre-wrap text-sm leading-relaxed text-white/70">
              {occurrence.description}
            </p>
            <p className="mt-3 text-sm text-white/55">
              Muestra: <span className="text-white/80">{occurrence.affectedQuantity} afectadas de {occurrence.sampleQuantity}</span>
            </p>

            {occurrence.photos?.length > 0 && (
              <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
                {occurrence.photos.map((photo) => (
                  <a
                    key={photo.storagePath}
                    href={photo.url}
                    target="_blank"
                    rel="noreferrer"
                    className="group overflow-hidden rounded-xl border border-white/10 bg-black/20"
                  >
                    <img
                      src={photo.url}
                      alt={photo.name}
                      className="aspect-square w-full object-cover transition group-hover:scale-[1.02]"
                    />
                    <span className="flex items-center gap-2 px-3 py-2 text-xs text-white/50">
                      <ImageIcon size={14} />
                      <span className="truncate">{photo.name}</span>
                    </span>
                  </a>
                ))}
              </div>
            )}
          </article>
        ))}
      </div>

      <section className="rounded-2xl border border-white/10 bg-black/15 p-5">
        <h3 className="font-semibold text-white">Conversación</h3>
        <div className="mt-4 max-h-[420px] space-y-3 overflow-y-auto">
          {messages.length === 0 ? (
            <p className="py-6 text-center text-sm text-white/40">Todavía no hay mensajes.</p>
          ) : (
            messages.map((entry) => (
              <div key={entry.id} className="rounded-xl border border-white/10 bg-white/[0.035] px-4 py-3">
                <div className="flex flex-wrap justify-between gap-2">
                  <p className="text-sm font-medium text-emerald-200">{entry.createdByName || entry.createdByEmail}</p>
                  <p className="text-xs text-white/30">{formatDate(entry.createdAt)}</p>
                </div>
                <p className="mt-2 whitespace-pre-wrap text-sm text-white/70">{entry.text}</p>
              </div>
            ))
          )}
        </div>

        <form onSubmit={submitMessage} className="mt-4 flex gap-3">
          <textarea
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            disabled={sending}
            rows={2}
            placeholder="Escribe una pregunta, respuesta o comentario..."
            className="min-h-12 flex-1 resize-y rounded-xl border border-white/15 bg-black/25 px-4 py-3 text-white outline-none focus:border-emerald-400/45"
          />
          <button
            type="submit"
            disabled={sending || !message.trim()}
            aria-label="Enviar mensaje"
            className="inline-flex min-h-12 w-12 items-center justify-center rounded-xl border border-emerald-400/30 bg-emerald-400/15 text-emerald-200 disabled:opacity-40"
          >
            {sending ? <LoaderCircle size={18} className="animate-spin" /> : <Send size={18} />}
          </button>
        </form>
        {error && <p className="mt-2 text-sm text-red-300">{error}</p>}
      </section>
    </div>
  );
}
