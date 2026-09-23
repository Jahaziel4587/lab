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
  FileDown,
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
import AnomalyLotReportForm, {
  type NewAnomalyLotReportInput,
} from "./AnomalyLotReportForm";
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

import AnomalyPdfDialog from
  "./AnomalyPdfDialog";
import { generateAnomalyPdf } from
  "../pdf/generateAnomalyPdf";

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
  savingLotReport: boolean;
  addingOccurrencePhotos: boolean;
  routingOccurrence: boolean;
  savingDecision: boolean;
    componentName: string;
  onSendMessage: (
    text: string,
  ) => Promise<void>;
  onReportOccurrence: (
    input:
      NewAnomalyReportInput,
  ) => Promise<unknown>;
  onReportLot: (
    input: NewAnomalyLotReportInput,
  ) => Promise<unknown>;
  onAddOccurrencePhotos: (
    occurrenceId: string,
    photos: File[],
  ) => Promise<void>;
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
  componentName,
  sending,
  savingOccurrence,
  savingLotReport,
  addingOccurrencePhotos,
  routingOccurrence,
  savingDecision,
  onSendMessage,
  onReportOccurrence,
  onReportLot,
  onAddOccurrencePhotos,
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
    photoOccurrenceId,
    setPhotoOccurrenceId,
  ] = useState<string | null>(null);

  const photoInputReference =
    useRef<HTMLInputElement | null>(
      null,
    );

  const [
    decisionOpen,
    setDecisionOpen,
  ] = useState(false);

  const [
    reportOpen,
    setReportOpen,
  ] = useState(false);
  const [lotReportOpen, setLotReportOpen] = useState(false);
  const [generatingLotPdfId, setGeneratingLotPdfId] = useState<string | null>(null);
  const [
    pdfDialogOpen,
    setPdfDialogOpen,
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

  const submitLotReport = async (input: NewAnomalyLotReportInput) => {
    await onReportLot(input);
    setLotReportOpen(false);
  };

  const downloadLotPdf = async (occurrence: AnomalyOccurrence) => {
    if (!user) return;
    try {
      setError("");
      setGeneratingLotPdfId(occurrence.id);
      await generateAnomalyPdf({
        anomaly,
        occurrences: [occurrence],
        componentName,
        idToken: await user.getIdToken(),
      });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No fue posible generar el PDF del lote.");
    } finally {
      setGeneratingLotPdfId(null);
    }
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
                setPdfDialogOpen(
                  true,
                )
              }
              disabled={
                occurrences.length ===
                0
              }
              className="inline-flex
                min-h-11 w-full
                items-center
                justify-center gap-2
                rounded-xl border
                border-emerald-400/30
                bg-emerald-400/10
                px-4 text-sm
                font-medium
                text-emerald-200
                transition
                hover:bg-emerald-400/15
                disabled:cursor-not-allowed
                disabled:opacity-40
                sm:min-h-10 sm:w-auto"
            >
              <FileDown size={16} />
              Generar PDF
            </button>
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
            <button
              type="button"
              onClick={() => setLotReportOpen(true)}
              className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-sky-400/30 bg-sky-400/10 px-4 text-sm font-medium text-sky-100 transition hover:bg-sky-400/15 sm:min-h-10 sm:w-auto"
            >
              <Plus size={16} />
              Agregar reporte por lote
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
                  ? "Pasó"
                  : "No pasó"}
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
              const isLotReport = occurrence.reportType === "lot_summary";

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

              const canAddPhotos =
                Boolean(
                  user?.uid &&
                  (
                    occurrence.createdByUid ===
                      user.uid ||
                    canRouteReport
                  ),
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
                        : isLotReport
                          ? "border-sky-400/20 bg-sky-400/[0.07]"
                          : "border-amber-400/20 bg-amber-400/[0.07]"
                    }`}
                  >
                    {canAddPhotos &&
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
                              disabled={
                                addingOccurrencePhotos
                              }
                              onClick={() => {
                                setPhotoOccurrenceId(
                                  occurrence.id,
                                );
                                photoInputReference.current?.click();
                              }}
                              className="w-full rounded-lg px-3 py-2.5 text-left text-sm text-white/75 hover:bg-white/[0.06] disabled:opacity-50"
                            >
                              Agregar más fotos
                            </button>

                            {canRouteReport && (
                              <>
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
                              </>
                            )}
                          </div>
                        </details>
                      )}

                    <div className="flex flex-wrap items-start justify-between gap-3 pr-10">
                      <div>
                        <p className={`text-xs font-semibold uppercase tracking-wider ${isLotReport ? "text-sky-200" : "text-amber-200"}`}>
                          {isLotReport
                            ? "Reporte por lote"
                            : index === 0
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

                    {isLotReport ? (
                      <div className="mt-3 grid grid-cols-1 gap-2 text-sm sm:grid-cols-3">
                        <p className="rounded-lg bg-black/20 px-3 py-2 text-white/55">Con anormalidad: <span className="font-medium text-white/85">{occurrence.affectedQuantity}</span></p>
                        <p className="rounded-lg bg-black/20 px-3 py-2 text-white/55">Inspeccionadas: <span className="font-medium text-white/85">{occurrence.inspectedQuantity ?? occurrence.sampleQuantity}</span></p>
                        <p className="rounded-lg bg-black/20 px-3 py-2 text-white/55">Total del lote: <span className="font-medium text-white/85">{occurrence.lotQuantity ?? "N/D"}</span></p>
                      </div>
                    ) : (
                      <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-sm text-white/55">
                        <p>Muestra reportada: <span className="text-white/85">{occurrence.affectedQuantity} de {occurrence.sampleQuantity}</span></p>
                        <p>Total del lote: <span className="text-white/85">{occurrence.lotQuantity ?? "No registrado"}</span></p>
                      </div>
                    )}

                    <div className="mt-3 flex flex-wrap gap-2 text-xs text-white/60">
                      <span className="rounded-full border border-white/10 bg-black/20 px-3 py-1.5">
                        Inspección: {occurrence.inspectionType === "special" ? "Especial" : occurrence.inspectionType === "normal" ? "Normal" : "No registrada"}
                      </span>
                      <span className="rounded-full border border-white/10 bg-black/20 px-3 py-1.5">
                        Nivel: {occurrence.inspectionLevel || "No registrado"}
                      </span>
                      <span className="rounded-full border border-white/10 bg-black/20 px-3 py-1.5">
                        AQL: {occurrence.aql || "No registrado"}
                      </span>
                    </div>

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

                    {isLotReport && !redirected && (
                      <button
                        type="button"
                        onClick={() => downloadLotPdf(occurrence)}
                        disabled={generatingLotPdfId === occurrence.id}
                        className="mt-4 inline-flex min-h-10 items-center gap-2 rounded-xl border border-sky-400/30 bg-sky-400/10 px-4 text-sm font-medium text-sky-100 hover:bg-sky-400/15 disabled:opacity-50"
                      >
                        {generatingLotPdfId === occurrence.id ? <LoaderCircle size={16} className="animate-spin" /> : <FileDown size={16} />}
                        {generatingLotPdfId === occurrence.id ? "Generando PDF..." : "Generar PDF de este lote"}
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
                const isRejectedDecision =
                  entry.type ===
                    "decision" &&
                  /fail|no pas[oó]/i.test(
                    entry.text,
                  );

                const translatedText =
                  entry.text
                    .replace(
                      /Decisión (final|inicial): Pass/gi,
                      "Decisión $1: Pasó",
                    )
                    .replace(
                      /Decisión (final|inicial): Fail/gi,
                      "Decisión $1: No pasó",
                    );

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
                      className={`max-w-xl rounded-2xl border px-5 py-4 text-center disabled:cursor-default ${
                        isRejectedDecision
                          ? "border-red-400/30 bg-red-400/[0.10]"
                          : "border-emerald-400/25 bg-emerald-400/[0.09]"
                      }`}
                    >
                      <p className={`text-xs font-semibold uppercase tracking-wider ${
                        isRejectedDecision
                          ? "text-red-300"
                          : "text-emerald-300"
                      }`}>
                        {entry.type ===
                        "decision"
                          ? "Decisión registrada"
                          : "Reporte relacionado"}
                      </p>

                      <p className="mt-2 whitespace-pre-wrap text-sm text-white/80">
                        {translatedText}
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

      <input
        ref={photoInputReference}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={async (event) => {
          const files = Array.from(
            event.target.files || [],
          );

          if (
            !photoOccurrenceId ||
            files.length === 0
          ) {
            event.target.value = "";
            return;
          }

          try {
            setError("");
            await onAddOccurrencePhotos(
              photoOccurrenceId,
              files,
            );
          } catch (cause) {
            setError(
              cause instanceof Error
                ? cause.message
                : "No fue posible agregar las fotografías.",
            );
          } finally {
            event.target.value = "";
            setPhotoOccurrenceId(null);
          }
        }}
      />
      {pdfDialogOpen && (
        <AnomalyPdfDialog
          anomaly={anomaly}
          occurrences={
            occurrences
          }
          componentName={
            componentName
          }
          onClose={() =>
            setPdfDialogOpen(
              false,
            )
          }
        />
      )}
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
                    ? "Pasó"
                    : "No pasó"}
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

      {lotReportOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/75 p-2 backdrop-blur-sm sm:p-4">
          <div className="mx-auto my-2 max-w-3xl rounded-2xl border border-sky-400/20 bg-[#101715] p-4 shadow-2xl sm:my-6 sm:p-5">
            <div className="mb-4 flex items-center justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-sky-300">Resultado conocido</p>
                <h2 className="mt-1 text-xl font-semibold text-white">Agregar reporte por lote</h2>
                <p className="mt-1 text-sm text-white/45">Se agregará al chat sin abrir una nueva decisión.</p>
              </div>
              <button type="button" onClick={() => setLotReportOpen(false)} disabled={savingLotReport} className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 text-white/55" aria-label="Cerrar"><X size={18} /></button>
            </div>
            <AnomalyLotReportForm saving={savingLotReport} onSubmit={submitLotReport} onCancel={() => setLotReportOpen(false)} />
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
