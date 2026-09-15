"use client";

import {
  FormEvent,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  CheckCircle2,
  EllipsisVertical,
  Image as ImageIcon,
  LoaderCircle,
  MessageCircle,
  Plus,
  Send,
  X,
} from "lucide-react";

import { useAuth } from
  "@/src/Context/AuthContext";
import AnomalyDecisionForm from
  "./AnomalyDecisionForm";
import AnomalyReportForm from
  "./AnomalyReportForm";
import OccurrenceRoutingDialog from
  "./OccurrenceRoutingDialog";
import type {
  NewAnomalyReportInput,
  ResponsiblePm,
} from "../hooks/useAnomalies";
import type {
  AnomalyDecision,
  AnomalyMessage,
  AnomalyOccurrence,
  InspectionAnomaly,
} from "../types";

type RoutingSelection = {
  occurrenceId: string;
  mode:
    | "new"
    | "existing";
};

type Props = {
  anomaly: InspectionAnomaly;
  occurrences:
    AnomalyOccurrence[];
  messages:
    AnomalyMessage[];
  relatedAnomalies:
    InspectionAnomaly[];
  responsiblePms:
    ResponsiblePm[];
  loadingPms: boolean;
  canDecide: boolean;
  sending: boolean;
  savingOccurrence: boolean;
  routingOccurrence: boolean;
  savingDecision: boolean;
  onSendMessage: (
    text: string,
  ) => Promise<void>;
  onReportOccurrence: (
    input:
      NewAnomalyReportInput,
  ) => Promise<unknown>;
  onSaveDecision: (input: {
    title: string;
    decision:
      Exclude<
        AnomalyDecision,
        null
      >;
    comment: string;
  }) => Promise<void>;
  onRouteOccurrence: (
    input: {
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
    },
  ) => Promise<string>;
  onOpenAnomaly: (
    anomalyId: string,
  ) => void;
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
    return candidate.seconds * 1000;
  }

  const parsed =
    new Date(String(value)).getTime();

  return Number.isNaN(parsed)
    ? 0
    : parsed;
}

export default function AnomalyThread({
  anomaly,
  occurrences,
  messages,
  relatedAnomalies,
  responsiblePms,
  loadingPms,
  canDecide,
  sending,
  savingOccurrence,
  routingOccurrence,
  savingDecision,
  onSendMessage,
  onReportOccurrence,
  onSaveDecision,
  onRouteOccurrence,
  onOpenAnomaly,
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

  const [
    reportOpen,
    setReportOpen,
  ] = useState(false);

  const [
    routingSelection,
    setRoutingSelection,
  ] =
    useState<
      RoutingSelection |
      null
    >(null);

  const bottomReference =
    useRef<HTMLDivElement | null>(
      null,
    );

  useEffect(() => {
    bottomReference.current
      ?.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
      });
  }, [
    messages.length,
    occurrences.length,
  ]);

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

  const submitOccurrence =
    async (
      input:
        NewAnomalyReportInput,
    ) => {
      await onReportOccurrence(
        input,
      );

      setReportOpen(false);
    };

  const submitRouting =
    async (
      input:
        Parameters<
          Props[
            "onRouteOccurrence"
          ]
        >[0],
    ) => {
      const targetId =
        await onRouteOccurrence(
          input,
        );

      setRoutingSelection(null);
      onOpenAnomaly(targetId);
    };

  const saveDecision =
    async (
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
    anomaly.status ===
    "resolved";

  const timelineOrder =
    new Map(
      [
        ...occurrences.map(
          (occurrence) => ({
            key:
              `occurrence:${occurrence.id}`,
            createdAt:
              timestampValue(
                occurrence.createdAt,
              ),
          }),
        ),
        ...messages.map(
          (entry) => ({
            key:
              `message:${entry.id}`,
            createdAt:
              timestampValue(
                entry.createdAt,
              ),
          }),
        ),
      ]
        .sort(
          (first, second) =>
            first.createdAt -
            second.createdAt,
        )
        .map(
          (item, index) =>
            [
              item.key,
              index,
            ] as const,
        ),
    );

  return (
    <>
      <section className="overflow-hidden rounded-2xl border border-white/10 bg-[#0c1210]/95">
        <header className="flex flex-col gap-4 border-b border-white/10 bg-white/[0.025] px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex items-center gap-2 text-sm font-medium text-white">
              <MessageCircle
                size={17}
                className="text-emerald-300"
              />
              Conversación de la anormalidad
            </div>

            <p className="mt-1 text-xs text-white/40">
              Reportes, fotografías, mensajes y decisiones
            </p>
          </div>

          <div className="grid w-full grid-cols-1 gap-2 sm:flex sm:w-auto sm:flex-wrap">
            <button
              type="button"
              onClick={() =>
                setReportOpen(true)
              }
              className="inline-flex min-h-11 w-full items-center justify-center sm:min-h-10 sm:w-auto gap-2 rounded-xl border border-white/15 bg-white/[0.05] px-4 text-sm font-medium text-white/75 transition hover:bg-white/[0.09]"
            >
              <Plus size={16} />
              Reportar misma anormalidad
            </button>

            {isResolved ? (
              <span
                className={`inline-flex min-h-11 w-full items-center justify-center gap-2 sm:min-h-10 sm:w-auto rounded-xl border px-4 text-sm font-medium ${
                  anomaly.decision ===
                  "pass"
                    ? "border-emerald-400/25 bg-emerald-400/10 text-emerald-200"
                    : "border-red-400/25 bg-red-400/10 text-red-200"
                }`}
              >
                <CheckCircle2
                  size={16}
                />
                Decisión:{" "}
                {anomaly.decision ===
                "pass"
                  ? "Pass"
                  : "Fail"}
              </span>
            ) : canDecide ? (
              <button
                type="button"
                onClick={() =>
                  setDecisionOpen(
                    true,
                  )
                }
                className="inline-flex min-h-11 w-full items-center justify-center sm:min-h-10 sm:w-auto rounded-xl border border-emerald-400/35 bg-emerald-400/12 px-5 text-sm font-medium text-emerald-100 transition hover:bg-emerald-400/20"
              >
                Tomar decisión
              </button>
            ) : (
              <span className="self-center text-xs text-amber-200/70">
                Decisión pendiente del PM
              </span>
            )}
          </div>
        </header>

        <div className="flex max-h-[62dvh] flex-col sm:max-h-[650px] gap-5 overflow-y-auto bg-gradient-to-b from-emerald-950/10 to-black/10 px-4 py-5 sm:px-6">
          {occurrences.map(
            (
              occurrence,
              index,
            ) => {
              const isFollowUp =
                occurrence.followUp ===
                  true ||
                index > 0;

              const redirected =
                Boolean(
                  occurrence
                    .redirectedToAnomalyId,
                );

              const canRouteReport =
                Boolean(
                  user?.email &&
                  occurrence
                    .responsiblePmEmail &&
                  user.email
                    .trim()
                    .toLowerCase() ===
                    occurrence
                      .responsiblePmEmail
                      .trim()
                      .toLowerCase(),
                );

              return (
                <div
                  key={occurrence.id}
                  style={{
                    order:
                      timelineOrder.get(
                        `occurrence:${occurrence.id}`,
                      ),
                  }}
                  className="flex justify-start"
                >
                  <article
                    className={`relative w-full max-w-2xl rounded-2xl rounded-tl-md border p-5 shadow-sm ${
                      redirected
                        ? "border-white/10 bg-white/[0.035] opacity-70"
                        : "border-amber-400/20 bg-amber-400/[0.07]"
                    }`}
                  >
                    {canRouteReport &&
                      !redirected && (
                        <details className="absolute right-3 top-3 z-10">
                          <summary
                            className="flex h-9 w-9 cursor-pointer list-none items-center justify-center rounded-lg border border-white/10 bg-black/35 text-white/60 hover:text-white"
                            aria-label="Opciones del reporte"
                          >
                            <EllipsisVertical
                              size={18}
                            />
                          </summary>

                          <div className="absolute right-0 mt-2 w-64 overflow-hidden rounded-xl border border-white/10 bg-[#151b19] p-1 shadow-2xl">
                            <button
                              type="button"
                              onClick={() => {
                                if (
                                  isFollowUp
                                ) {
                                  setRoutingSelection(
                                    {
                                      occurrenceId:
                                        occurrence.id,
                                      mode:
                                        "new",
                                    },
                                  );
                                } else {
                                  setDecisionOpen(
                                    true,
                                  );
                                }
                              }}
                              className="w-full rounded-lg px-3 py-2.5 text-left text-sm text-white/75 hover:bg-white/[0.06]"
                            >
                              Hacerlo nueva anormalidad
                            </button>

                            <button
                              type="button"
                              onClick={() =>
                                setRoutingSelection(
                                  {
                                    occurrenceId:
                                      occurrence.id,
                                    mode:
                                      "existing",
                                  },
                                )
                              }
                              className="w-full rounded-lg px-3 py-2.5 text-left text-sm text-white/75 hover:bg-white/[0.06]"
                            >
                              Relacionar a anormalidad existente
                            </button>
                          </div>
                        </details>
                      )}

                    <div className="flex flex-wrap items-start justify-between gap-3 pr-10">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wider text-amber-200">
                          {index === 0
                            ? "Reporte inicial del inspector"
                            : "Reporte adicional de la misma anormalidad"}
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
                        Lote{" "}
                        {occurrence.lot}
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
                              href={
                                photo.url
                              }
                              target="_blank"
                              rel="noreferrer"
                              className="group overflow-hidden rounded-xl border border-white/10 bg-black/25"
                            >
                              <img
                                src={
                                  photo.url
                                }
                                alt={
                                  photo.name
                                }
                                className="aspect-square w-full object-cover transition group-hover:scale-[1.02]"
                              />

                              <span className="flex items-center gap-2 px-3 py-2 text-xs text-white/50">
                                <ImageIcon
                                  size={14}
                                />
                                <span className="truncate">
                                  {
                                    photo.name
                                  }
                                </span>
                              </span>
                            </a>
                          ),
                        )}
                      </div>
                    )}

                    {redirected && (
                      <button
                        type="button"
                        onClick={() =>
                          onOpenAnomaly(
                            occurrence
                              .redirectedToAnomalyId!,
                          )
                        }
                        className="mt-4 text-sm font-medium text-emerald-300 hover:underline"
                      >
                        Este reporte fue relacionado con otra anormalidad. Abrir chat →
                      </button>
                    )}
                  </article>
                </div>
              );
            },
          )}

          {messages.map(
            (entry) => {
              const isSystem =
                entry.type ===
                  "decision" ||
                entry.type ===
                  "routing";

              const isOwn =
                Boolean(
                  user?.uid &&
                  entry.createdByUid ===
                    user.uid,
                );

              if (isSystem) {
                return (
                  <div
                    key={entry.id}
                    style={{
                      order:
                        timelineOrder.get(
                          `message:${entry.id}`,
                        ),
                    }}
                    className="flex justify-center py-2"
                  >
                    <button
                      type="button"
                      disabled={
                        !entry.targetAnomalyId
                      }
                      onClick={() =>
                        entry.targetAnomalyId &&
                        onOpenAnomaly(
                          entry.targetAnomalyId,
                        )
                      }
                      className="max-w-xl rounded-2xl border border-emerald-400/25 bg-emerald-400/[0.09] px-5 py-4 text-center disabled:cursor-default"
                    >
                      <p className="text-xs font-semibold uppercase tracking-wider text-emerald-300">
                        {entry.type ===
                        "decision"
                          ? "Decisión registrada"
                          : "Reporte relacionado"}
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
                    </button>
                  </div>
                );
              }

              return (
                <div
                  key={entry.id}
                  style={{
                    order:
                      timelineOrder.get(
                        `message:${entry.id}`,
                      ),
                  }}
                  className={`flex ${
                    isOwn
                      ? "justify-end"
                      : "justify-start"
                  }`}
                >
                  <div
                    className={`max-w-[85%] px-4 py-3 shadow-sm sm:max-w-[72%] ${
                      isOwn
                        ? "rounded-2xl rounded-tr-md bg-emerald-500/20"
                        : "rounded-2xl rounded-tl-md border border-white/10 bg-white/[0.065]"
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
            },
          )}

          <div
            ref={bottomReference}
            style={{
              order:
                timelineOrder.size,
            }}
          />
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
                  event.key ===
                    "Enter" &&
                  !event.shiftKey
                ) {
                  event.preventDefault();
                  event.currentTarget
                    .form
                    ?.requestSubmit();
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
            saving={
              savingDecision
            }
            onCancel={() =>
              setDecisionOpen(
                false,
              )
            }
            onSave={
              saveDecision
            }
          />
        )}

      {reportOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/75 p-2 backdrop-blur-sm sm:p-4">
          <div className="mx-auto my-2 max-w-3xl rounded-2xl border border-emerald-400/20 bg-[#101715] p-4 shadow-2xl sm:my-6 sm:p-5">
            <div className="mb-4 flex items-center justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-emerald-300">
                  Mismo tipo de anormalidad
                </p>
                <h2 className="mt-1 text-xl font-semibold text-white">
                  Reportar otra ocurrencia
                </h2>
              </div>

              <button
                type="button"
                onClick={() =>
                  setReportOpen(
                    false,
                  )
                }
                disabled={
                  savingOccurrence
                }
                className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 text-white/55"
                aria-label="Cerrar"
              >
                <X size={18} />
              </button>
            </div>

            {isResolved && (
              <div className="mb-5 rounded-xl border border-white/10 bg-white/[0.035] p-4 text-sm text-white/65">
                Decisión anterior:{" "}
                <strong
                  className={
                    anomaly.decision ===
                    "pass"
                      ? "text-emerald-300"
                      : "text-red-300"
                  }
                >
                  {anomaly.decision ===
                  "pass"
                    ? "Pass"
                    : "Fail"}
                </strong>
                {anomaly.decisionComment
                  ? ` — ${anomaly.decisionComment}`
                  : ""}
              </div>
            )}

            <AnomalyReportForm
              responsiblePms={
                responsiblePms
              }
              loadingPms={
                loadingPms
              }
              saving={
                savingOccurrence
              }
              onSubmit={
                submitOccurrence
              }
              onCancel={() =>
                setReportOpen(
                  false,
                )
              }
            />
          </div>
        </div>
      )}

      {routingSelection && (
        <OccurrenceRoutingDialog
          occurrenceId={
            routingSelection
              .occurrenceId
          }
          initialMode={
            routingSelection.mode
          }
          anomalies={
            relatedAnomalies
          }
          saving={
            routingOccurrence
          }
          onCancel={() =>
            setRoutingSelection(
              null,
            )
          }
          onSubmit={
            submitRouting
          }
        />
      )}
    </>
  );
}
