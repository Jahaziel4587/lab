"use client";

import {
  FormEvent,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  CheckCircle2,
  Image as ImageIcon,
  LoaderCircle,
  MessageCircle,
  Send,
} from "lucide-react";

import { useAuth } from
  "@/src/Context/AuthContext";
import AnomalyDecisionForm from
  "./AnomalyDecisionForm";
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
  onSendMessage: (
    text: string,
  ) => Promise<void>;
  onSaveDecision: (input: {
    title: string;
    decision:
      Exclude<AnomalyDecision, null>;
    comment: string;
  }) => Promise<void>;
};

function formatDate(value: unknown) {
  if (!value) return "";

  const candidate =
    value as {
      toDate?: () => Date;
      seconds?: number;
    };

  const date =
    typeof candidate.toDate ===
    "function"
      ? candidate.toDate()
      : typeof candidate.seconds ===
          "number"
        ? new Date(
            candidate.seconds * 1000,
          )
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
  const { user } = useAuth();

  const [message, setMessage] =
    useState("");

  const [error, setError] =
    useState("");

  const [
    decisionOpen,
    setDecisionOpen,
  ] = useState(false);

  const bottomReference =
    useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    bottomReference.current
      ?.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
      });
  }, [messages.length]);

  const submitMessage = async (
    event: FormEvent,
  ) => {
    event.preventDefault();

    if (!message.trim()) return;

    try {
      setError("");
      await onSendMessage(message);
      setMessage("");
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "No fue posible enviar el mensaje.",
      );
    }
  };

  const saveDecision = async (
    input: {
      title: string;
      decision:
        Exclude<
          AnomalyDecision,
          null
        >;
      comment: string;
    },
  ) => {
    await onSaveDecision(input);
    setDecisionOpen(false);
  };

  const isResolved =
    anomaly.status === "resolved";

  return (
    <>
      <section className="overflow-hidden rounded-2xl border border-white/10 bg-[#0c1210]/95">
        <header className="flex flex-col gap-4 border-b border-white/10 bg-white/[0.025] px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2 text-sm font-medium text-white">
              <MessageCircle
                size={17}
                className="text-emerald-300"
              />
              Conversación de la anormalidad
            </div>

            <p className="mt-1 text-xs text-white/40">
              Inspector y encargado responsable
            </p>
          </div>

          {isResolved ? (
            <span
              className={`inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border px-4 text-sm font-medium ${
                anomaly.decision === "pass"
                  ? "border-emerald-400/25 bg-emerald-400/10 text-emerald-200"
                  : "border-red-400/25 bg-red-400/10 text-red-200"
              }`}
            >
              <CheckCircle2 size={16} />
              Decisión:{" "}
              {anomaly.decision === "pass"
                ? "Pass"
                : "Fail"}
            </span>
          ) : canDecide ? (
            <button
              type="button"
              onClick={() =>
                setDecisionOpen(true)
              }
              className="inline-flex min-h-10 items-center justify-center rounded-xl border border-emerald-400/35 bg-emerald-400/12 px-5 text-sm font-medium text-emerald-100 transition hover:bg-emerald-400/20"
            >
              Tomar decisión
            </button>
          ) : (
            <span className="text-xs text-amber-200/70">
              Decisión pendiente del PM
            </span>
          )}
        </header>

        <div className="max-h-[620px] space-y-5 overflow-y-auto bg-gradient-to-b from-emerald-950/10 to-black/10 px-4 py-5 sm:px-6">
          {occurrences.map(
            (occurrence, index) => (
              <div
                key={occurrence.id}
                className="flex justify-start"
              >
                <article className="w-full max-w-2xl rounded-2xl rounded-tl-md border border-amber-400/20 bg-amber-400/[0.07] p-5 shadow-sm">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wider text-amber-200">
                        {index === 0
                          ? "Reporte inicial del inspector"
                          : "Nueva ocurrencia reportada"}
                      </p>

                      <p className="mt-2 font-medium text-white">
                        {occurrence.createdByName ||
                          occurrence.createdByEmail}
                      </p>

                      <p className="mt-1 text-xs text-white/35">
                        {formatDate(
                          occurrence.createdAt,
                        )}
                      </p>
                    </div>

                    <span className="rounded-full border border-white/10 bg-black/20 px-3 py-1 text-xs text-white/55">
                      Lote {occurrence.lot}
                    </span>
                  </div>

                  <p className="mt-4 whitespace-pre-wrap text-sm leading-relaxed text-white/75">
                    {occurrence.description}
                  </p>

                  <p className="mt-3 text-sm text-white/55">
                    Resultado de la muestra:{" "}
                    <span className="text-white/85">
                      {occurrence.affectedQuantity}{" "}
                      afectadas de{" "}
                      {occurrence.sampleQuantity}
                    </span>
                  </p>

                  {occurrence.photos
                    ?.length > 0 && (
                    <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
                      {occurrence.photos.map(
                        (photo) => (
                          <a
                            key={
                              photo.storagePath
                            }
                            href={photo.url}
                            target="_blank"
                            rel="noreferrer"
                            className="group overflow-hidden rounded-xl border border-white/10 bg-black/25"
                          >
                            <img
                              src={photo.url}
                              alt={photo.name}
                              className="aspect-square w-full object-cover transition group-hover:scale-[1.02]"
                            />

                            <span className="flex items-center gap-2 px-3 py-2 text-xs text-white/50">
                              <ImageIcon
                                size={14}
                              />
                              <span className="truncate">
                                {photo.name}
                              </span>
                            </span>
                          </a>
                        ),
                      )}
                    </div>
                  )}
                </article>
              </div>
            ),
          )}

          {messages.map((entry) => {
            const isDecision =
              entry.type === "decision";

            const isOwn =
              Boolean(
                user?.uid &&
                entry.createdByUid ===
                  user.uid,
              );

            if (isDecision) {
              return (
                <div
                  key={entry.id}
                  className="flex justify-center py-2"
                >
                  <div className="max-w-xl rounded-2xl border border-emerald-400/25 bg-emerald-400/[0.09] px-5 py-4 text-center">
                    <p className="text-xs font-semibold uppercase tracking-wider text-emerald-300">
                      Decisión registrada
                    </p>

                    <p className="mt-2 whitespace-pre-wrap text-sm text-white/80">
                      {entry.text}
                    </p>

                    <p className="mt-2 text-xs text-white/35">
                      {entry.createdByName ||
                        entry.createdByEmail}
                      {" · "}
                      {formatDate(
                        entry.createdAt,
                      )}
                    </p>
                  </div>
                </div>
              );
            }

            return (
              <div
                key={entry.id}
                className={`flex ${
                  isOwn
                    ? "justify-end"
                    : "justify-start"
                }`}
              >
                <div
                  className={`max-w-[85%] px-4 py-3 shadow-sm sm:max-w-[72%] ${
                    isOwn
                      ? "rounded-2xl rounded-tr-md bg-emerald-500/20 text-white"
                      : "rounded-2xl rounded-tl-md border border-white/10 bg-white/[0.065] text-white"
                  }`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
                    <p
                      className={`text-xs font-medium ${
                        isOwn
                          ? "text-emerald-200"
                          : "text-white/60"
                      }`}
                    >
                      {isOwn
                        ? "Tú"
                        : entry.createdByName ||
                          entry.createdByEmail}
                    </p>

                    <p className="text-[11px] text-white/30">
                      {formatDate(
                        entry.createdAt,
                      )}
                    </p>
                  </div>

                  <p className="mt-1.5 whitespace-pre-wrap text-sm leading-relaxed text-white/80">
                    {entry.text}
                  </p>
                </div>
              </div>
            );
          })}

          <div ref={bottomReference} />
        </div>

        <form
          onSubmit={submitMessage}
          className="border-t border-white/10 bg-black/20 p-4"
        >
          <div className="flex items-end gap-3">
            <textarea
              value={message}
              onChange={(event) =>
                setMessage(
                  event.target.value,
                )
              }
              onKeyDown={(event) => {
                if (
                  event.key === "Enter" &&
                  !event.shiftKey
                ) {
                  event.preventDefault();
                  event.currentTarget
                    .form?.requestSubmit();
                }
              }}
              disabled={sending}
              rows={1}
              placeholder="Escribe un mensaje..."
              className="max-h-32 min-h-12 flex-1 resize-y rounded-2xl border border-white/15 bg-white/[0.045] px-4 py-3 text-white outline-none placeholder:text-white/30 focus:border-emerald-400/45"
            />

            <button
              type="submit"
              disabled={
                sending ||
                !message.trim()
              }
              aria-label="Enviar mensaje"
              className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-emerald-400/30 bg-emerald-400/15 text-emerald-200 transition hover:bg-emerald-400/25 disabled:opacity-40"
            >
              {sending ? (
                <LoaderCircle
                  size={18}
                  className="animate-spin"
                />
              ) : (
                <Send size={18} />
              )}
            </button>
          </div>

          <p className="mt-2 px-2 text-[11px] text-white/30">
            Enter para enviar · Shift + Enter para una nueva línea
          </p>

          {error && (
            <p className="mt-2 px-2 text-sm text-red-300">
              {error}
            </p>
          )}
        </form>
      </section>

      {decisionOpen &&
        canDecide &&
        !isResolved && (
          <AnomalyDecisionForm
            anomaly={anomaly}
            saving={savingDecision}
            onCancel={() =>
              setDecisionOpen(false)
            }
            onSave={saveDecision}
          />
        )}
    </>
  );
}
