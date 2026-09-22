"use client";

import {
  useState,
} from "react";

import {
  CheckCircle2,
  Download,
  Expand,
  FileImage,
  LoaderCircle,
  Plus,
} from "lucide-react";

import type {
  NonConformityLot,
  NonConformityReport,
} from "../types";

import {
  buildSampleLabel,
  sortReportsBySequence,
} from "../utils";

import {
  generateNonConformityPdf,
} from "../pdf/generateNonConformityPdf";

import NonConformityFinalizeDialog from
  "./NonConformityFinalizeDialog";

import {
  useAuth,
} from "@/src/Context/AuthContext";

type NonConformityLotDetailProps = {
  lot: NonConformityLot;
  componentName?: string;

  reports:
    NonConformityReport[];

  loading?: boolean;
  finalizing?: boolean;

  canEdit: boolean;

  onAddReport: () => void;
  onFinalize: () => Promise<void>;

}
function formatDate(
  value: unknown,
) {
  if (
    value &&
    typeof value === "object" &&
    "toDate" in value &&
    typeof (
      value as {
        toDate?: unknown;
      }
    ).toDate === "function"
  ) {
    return (
      value as {
        toDate: () => Date;
      }
    )
      .toDate()
      .toLocaleString(
        "es-MX",
        {
          day: "2-digit",
          month: "short",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        },
      );
  }

  return "";
}

export default function NonConformityLotDetail({
  lot,
  componentName,
  reports,
  loading = false,
  finalizing = false,
  canEdit,
  onAddReport,
  onFinalize,
 
}: NonConformityLotDetailProps) {
  const [
    showFinalizeDialog,
    setShowFinalizeDialog,
  ] = useState(false);
const [
  generatingPdf,
  setGeneratingPdf,
] = useState(false);

const {
  user,
} = useAuth();

const [
  pdfError,
  setPdfError,
] = useState("");
  const orderedReports =
    sortReportsBySequence(
      reports,
    );

  const rejectedSampleCount =
    new Set(
      reports.map(
        (report) =>
          report.sampleNumber,
      ),
    ).size;

  const isFinalized =
    lot.status ===
    "finalized";

  const finalRejectedCount =
    isFinalized
      ? lot.rejectedSampleCount ??
        rejectedSampleCount
      : rejectedSampleCount;

  const handleFinalize =
    async () => {
      await onFinalize();

      setShowFinalizeDialog(
        false,
      );
    };
const handleDownloadPdf =
  async () => {
    try {
      setPdfError("");
      setGeneratingPdf(true);

      if (!user) {
        throw new Error(
          "No hay una sesión activa.",
        );
      }

      const idToken =
        await user.getIdToken();

      await generateNonConformityPdf({
        lot,
        reports:
          orderedReports,
        idToken,
        componentName,
      });
    } catch (downloadError) {
      console.error(
        "Error generando PDF:",
        downloadError,
      );

      setPdfError(
        downloadError instanceof
          Error
          ? downloadError.message
          : "No fue posible generar el PDF.",
      );
    } finally {
      setGeneratingPdf(false);
    }
  };
  return (
    <div className="space-y-6">
      <section
        className="rounded-2xl
          border border-white/10
          bg-black/15 p-4
          sm:p-5"
      >
        <div
          className="flex flex-col
            gap-5 lg:flex-row
            lg:items-start
            lg:justify-between"
        >
          <div className="min-w-0">
            <div
              className="flex
                flex-wrap items-center
                gap-3"
            >
              <h2
                className="break-words
                  text-xl font-semibold
                  text-white"
              >
                {lot.lotName}
              </h2>

              <span
                className={
                  "rounded-full border " +
                  "px-3 py-1 text-xs " +
                  "font-semibold " +
                  "uppercase tracking-wide " +
                  (
                    isFinalized
                      ? "border-emerald-400/25 bg-emerald-400/10 text-emerald-200"
                      : "border-amber-400/25 bg-amber-400/10 text-amber-100"
                  )
                }
              >
                {isFinalized
                  ? "Finalizado"
                  : "En registro"}
              </span>
            </div>

            <p
              className="mt-2 text-sm
                leading-relaxed
                text-white/50"
            >
              Responsable:{" "}
              {lot.responsiblePmName ||
                lot.responsiblePmEmail}
            </p>

            {formatDate(
              lot.createdAt,
            ) && (
              <p
                className="mt-1
                  text-xs
                  text-white/35"
              >
                Creado el{" "}
                {formatDate(
                  lot.createdAt,
                )}
              </p>
            )}
          </div>

          <div
            className="flex w-full
              flex-col gap-3
              sm:flex-row
              lg:w-auto"
          >
            {!isFinalized &&
              canEdit && (
                <>
                  <button
                    type="button"
                    onClick={
                      onAddReport
                    }
                    className="inline-flex
                      min-h-11 w-full
                      items-center
                      justify-center
                      gap-2 rounded-xl
                      border
                      border-emerald-400/30
                      bg-emerald-400/10
                      px-4 text-sm
                      font-medium
                      text-emerald-200
                      transition
                      hover:bg-emerald-400/15
                      sm:w-auto"
                  >
                    <Plus size={17} />
                    Registrar muestra
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      setShowFinalizeDialog(
                        true,
                      )
                    }
                    disabled={
                      reports.length ===
                      0
                    }
                    className="inline-flex
                      min-h-11 w-full
                      items-center
                      justify-center
                      gap-2 rounded-xl
                      border
                      border-white/15
                      bg-white/[0.04]
                      px-4 text-sm
                      font-medium
                      text-white/70
                      transition
                      hover:bg-white/[0.08]
                      disabled:cursor-not-allowed
                      disabled:opacity-40
                      sm:w-auto"
                  >
                    <CheckCircle2
                      size={17}
                    />
                    Finalizar lote
                  </button>
                </>
              )}

            {isFinalized &&
  reports.length > 0 && (
    <button
      type="button"
      onClick={
        handleDownloadPdf
      }
      disabled={
        generatingPdf
      }
      className="inline-flex
        min-h-11 w-full
        items-center
        justify-center
        gap-2 rounded-xl
        border
        border-emerald-400/30
        bg-emerald-400/10
        px-4 text-sm
        font-medium
        text-emerald-200
        transition
        hover:bg-emerald-400/15
        disabled:cursor-not-allowed
        disabled:opacity-50
        sm:w-auto"
    >
      {generatingPdf ? (
        <LoaderCircle
          size={17}
          className="animate-spin"
        />
      ) : (
        <Download size={17} />
      )}

      {generatingPdf
        ? "Generando PDF..."
        : "Descargar PDF"}
    </button>
  )}
            
          </div>
        </div>

        <div
          className="mt-5 grid
            grid-cols-1 gap-3
            sm:max-w-2xl sm:grid-cols-3"
        >
          <div
            className="rounded-2xl
              border border-white/10
              bg-white/[0.03]
              p-4"
          >
            <p
              className="text-xs
                uppercase
                tracking-wider
                text-white/40"
            >
              Cantidad inspeccionada
            </p>

            <p
              className="mt-2
                text-2xl font-semibold
                text-white"
            >
              {lot.sampleQuantity}
            </p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
            <p className="text-xs uppercase tracking-wider text-white/40">
              Total del lote
            </p>
            <p className="mt-2 text-2xl font-semibold text-white">
              {lot.lotQuantity}
            </p>
          </div>

          <div
            className="rounded-2xl
              border border-red-400/20
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
              {finalRejectedCount}
            </p>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap gap-2 text-xs text-white/60">
          <span className="rounded-full border border-white/10 bg-black/20 px-3 py-1.5">
            Inspección: {lot.inspectionType === "special" ? "Especial" : "Normal"}
          </span>
          <span className="rounded-full border border-white/10 bg-black/20 px-3 py-1.5">
            Nivel: {lot.inspectionLevel || "No registrado"}
          </span>
          <span className="rounded-full border border-white/10 bg-black/20 px-3 py-1.5">
            AQL: {lot.aql || "No registrado"}
          </span>
        </div>
      </section>

{pdfError && (
  <div
    role="alert"
    className="rounded-xl
      border border-red-400/25
      bg-red-400/[0.08]
      px-4 py-3 text-sm
      text-red-100"
  >
    {pdfError}
  </div>
)}

      {loading ? (
        <div
          className="flex min-h-36
            items-center
            justify-center gap-3
            rounded-2xl border
            border-white/10
            bg-black/15
            text-sm text-white/50"
        >
          <LoaderCircle
            size={20}
            className="animate-spin
              text-emerald-300"
          />

          Cargando muestras...
        </div>
      ) : orderedReports.length ===
        0 ? (
        <div
          className="rounded-2xl
            border border-dashed
            border-white/15
            bg-black/15 p-8
            text-center"
        >
          <p
            className="font-medium
              text-white/70"
          >
            No hay muestras rechazadas
          </p>

          <p
            className="mt-2 text-sm
              leading-relaxed
              text-white/45"
          >
            Cuando una muestra no cumpla
            con la especificación,
            registra su número,
            descripción y fotografías.
          </p>

          {!isFinalized &&
            canEdit && (
              <button
                type="button"
                onClick={
                  onAddReport
                }
                className="mt-5
                  inline-flex
                  min-h-11
                  items-center
                  justify-center gap-2
                  rounded-xl border
                  border-emerald-400/30
                  bg-emerald-400/10
                  px-5 text-sm
                  font-medium
                  text-emerald-200
                  transition
                  hover:bg-emerald-400/15"
              >
                <Plus size={17} />
                Registrar primera muestra
              </button>
            )}
        </div>
      ) : (
        <section>
          <div
            className="flex
              items-center
              justify-between gap-4"
          >
            <div>
              <h3
                className="text-lg
                  font-semibold
                  text-white"
              >
                Muestras rechazadas
              </h3>

              <p
                className="mt-1
                  text-sm text-white/45"
              >
                En el orden en que fueron
                registradas.
              </p>
            </div>

            <span
              className="rounded-full
                border border-red-400/20
                bg-red-400/[0.06]
                px-3 py-1.5
                text-sm font-medium
                text-red-200"
            >
              {finalRejectedCount}
            </span>
          </div>

          <div
            className="mt-4
              space-y-4"
          >
            {orderedReports.map(
              (
                report,
                index,
              ) => (
                <article
                  key={report.id}
                  className="overflow-hidden
                    rounded-2xl border
                    border-white/10
                    bg-white/[0.03]"
                >
                  <div
                    className="border-b
                      border-white/10
                      p-4 sm:p-5"
                  >
                    <div
                      className="flex
                        flex-col gap-3
                        sm:flex-row
                        sm:items-start
                        sm:justify-between"
                    >
                      <div>
                        <p
                          className="text-xs
                            font-semibold
                            uppercase
                            tracking-[0.16em]
                            text-red-200"
                        >
                          Reporte{" "}
                          {index + 1}
                        </p>

                        <h4
                          className="mt-2
                            text-lg
                            font-semibold
                            text-white"
                        >
                          {buildSampleLabel(
                            report.sampleNumber,
                            lot.sampleQuantity,
                          )}
                        </h4>
                      </div>

                      {formatDate(
                        report.createdAt,
                      ) && (
                        <p
                          className="text-xs
                            text-white/35"
                        >
                          {formatDate(
                            report.createdAt,
                          )}
                        </p>
                      )}
                    </div>

                    <p
                      className="mt-4
                        whitespace-pre-wrap
                        break-words text-sm
                        leading-relaxed
                        text-white/70"
                    >
                      {report.description}
                    </p>

                    <p
                      className="mt-3
                        text-xs
                        text-white/35"
                    >
                      Registrado por{" "}
                      {report.createdByName ||
                        report.createdByEmail}
                    </p>
                  </div>

                  {report.photos.length >
                  0 ? (
                    <div
                      className="grid
                        grid-cols-2 gap-3
                        p-4 sm:grid-cols-3
                        sm:p-5"
                    >
                      {report.photos.map(
                        (
                          photo,
                          photoIndex,
                        ) => (
                          <a
                            key={
                              photo.storagePath ||
                              `${report.id}-${photoIndex}`
                            }
                            href={photo.url}
                            target="_blank"
                            rel="noreferrer"
                            className="group
                              overflow-hidden
                              rounded-2xl
                              border
                              border-white/10
                              bg-black/25"
                          >
                            <div
                              className="relative
                                aspect-square
                                overflow-hidden"
                            >
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={
                                  photo.url
                                }
                                alt={
                                  `Muestra ` +
                                  `${report.sampleNumber}, ` +
                                  `evidencia ` +
                                  `${photoIndex + 1}`
                                }
                                className="h-full
                                  w-full
                                  object-cover
                                  transition
                                  duration-300
                                  group-hover:scale-[1.03]"
                              />

                              <div
                                className="absolute
                                  inset-0 flex
                                  items-center
                                  justify-center
                                  bg-black/0
                                  text-white/0
                                  transition
                                  group-hover:bg-black/35
                                  group-hover:text-white"
                              >
                                <Expand
                                  size={22}
                                />
                              </div>
                            </div>

                            <div
                              className="flex
                                items-center gap-2
                                px-3 py-2"
                            >
                              <FileImage
                                size={14}
                                className="shrink-0
                                  text-emerald-300"
                              />

                              <p
                                className="truncate
                                  text-xs
                                  text-white/45"
                              >
                                {photo.name}
                              </p>
                            </div>
                          </a>
                        ),
                      )}
                    </div>
                  ) : null}
                </article>
              ),
            )}
          </div>
        </section>
      )}

      {showFinalizeDialog && (
        <NonConformityFinalizeDialog
          lotName={lot.lotName}
          sampleQuantity={
            lot.sampleQuantity
          }
          rejectedSampleCount={
            rejectedSampleCount
          }
          saving={finalizing}
          onConfirm={
            handleFinalize
          }
          onCancel={() =>
            setShowFinalizeDialog(
              false,
            )
          }
        />
      )}
    </div>
  );
}
