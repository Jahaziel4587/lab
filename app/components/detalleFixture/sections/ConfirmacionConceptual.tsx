"use client";

import { useState } from "react";
import type {
  Dispatch,
  FormEvent,
  RefObject,
  SetStateAction,
} from "react";
import {
  FiCheck,
  FiChevronDown,
  FiChevronRight,
  FiUpload,
} from "react-icons/fi";
import type {
  ApprovalRole,
  Decision,
  FixtureConfirmacion,
  FixtureVersion,
} from "../types";
import { cardClass, inputClass, btnPrimary } from "../styles";
import { formatFirebaseDate } from "../helpers";
import FilePicker from "../components/FilePicker";
import ApprovalRow from "../components/ApprovalRow";

export default function ConfirmacionConceptual({
  pruebas,
  confirmaciones,
  isAdmin,
  loading,
  confirmacionDesc,
  setConfirmacionDesc,
  confirmacionFiles,
  setConfirmacionFiles,
  confirmacionInputRef,
  addFiles,
  removeFile,
  userEmail,
  canApprovePM,
  canApproveDesigner,
  canApproveProcessOwner,
  onGuardarConfirmacion,
  onDecidirConfirmacion,
}: {
  pruebas: FixtureVersion[];
  confirmaciones: FixtureConfirmacion[];
  isAdmin: boolean;
  loading: boolean;
  confirmacionDesc: string;
  setConfirmacionDesc: Dispatch<SetStateAction<string>>;
  confirmacionFiles: File[];
  setConfirmacionFiles: Dispatch<SetStateAction<File[]>>;
  confirmacionInputRef: RefObject<HTMLInputElement | null>;
  addFiles: (
    list: FileList | null,
    setter: Dispatch<SetStateAction<File[]>>,
    inputRef: RefObject<HTMLInputElement | null>
  ) => void;
  removeFile: (
    index: number,
    setter: Dispatch<SetStateAction<File[]>>
  ) => void;
  userEmail?: string;
  canApprovePM: boolean;
  canApproveDesigner: boolean;
  canApproveProcessOwner: boolean;
  onGuardarConfirmacion: (e: FormEvent) => void;
  onDecidirConfirmacion: (
    confirmacion: FixtureConfirmacion,
    rol: ApprovalRole,
    decision: Decision,
    reason?: string
  ) => void;
}) {
  const [expandedIds, setExpandedIds] = useState<string[]>([]);

  const pruebaBase = [...pruebas].reverse().find((p) => p.status === "aprobado");

  const toggle = (id: string) => {
    setExpandedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const isNewOpen = expandedIds.includes("new");

  return (
    <section className={cardClass}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold">Confirmación conceptual</h2>
          <p className="mt-1 text-sm text-white/55">
            Documenta las consideraciones finales del diseño conceptual antes de
            generar la Spec Draft.
          </p>
        </div>

        {isAdmin && pruebaBase && (
          <button
            type="button"
            onClick={() => {
              if (!expandedIds.includes("new")) {
                setExpandedIds((prev) => [...prev, "new"]);
              }
            }}
            className={btnPrimary}
          >
            <FiUpload /> Agregar confirmación
          </button>
        )}
      </div>

      {!pruebaBase && (
        <div className="mt-5 rounded-2xl border border-yellow-300/20 bg-yellow-400/10 p-4 text-sm text-yellow-100">
          Primero debe existir una prueba de diseño aprobada para poder crear
          una confirmación conceptual.
        </div>
      )}

      <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        {confirmaciones.map((item, index) => {
          const isOpen = expandedIds.includes(item.id);
          const fecha = formatFirebaseDate(item.createdAt);

          return (
            <div
              key={item.id}
              className={`w-full rounded-2xl border p-4 transition ${
                item.status === "aprobado"
                  ? "border-emerald-300/30 bg-emerald-400/10"
                  : item.status === "rechazado"
                  ? "border-red-300/30 bg-red-400/10"
                  : "border-white/10 bg-black/20"
              }`}
            >
              <button
                type="button"
                onClick={() => toggle(item.id)}
                className="flex w-full items-center justify-between gap-3 text-left"
              >
                <div className="min-w-0">
                  <p className="text-xs uppercase tracking-[0.22em] text-white/40">
                    Confirmación {index + 1}
                  </p>
                  <p className="mt-1 text-lg font-semibold text-white/90">
                    {item.versionLabel}
                  </p>
                  <p className="mt-1 text-xs text-white/45">
                    Base: {item.pruebaBaseVersion || "NA"} · {fecha}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <span
                    className={`rounded-full border px-3 py-1 text-[11px] font-semibold ${
                      item.status === "aprobado"
                        ? "border-emerald-300/30 bg-emerald-400/10 text-emerald-100"
                        : item.status === "rechazado"
                        ? "border-red-300/30 bg-red-400/10 text-red-100"
                        : "border-yellow-300/30 bg-yellow-400/10 text-yellow-100"
                    }`}
                  >
                    {item.status || "pendiente"}
                  </span>

                  {isOpen ? <FiChevronDown /> : <FiChevronRight />}
                </div>
              </button>

              {isOpen && (
                <div className="mt-4 border-t border-white/10 pt-4">
                  <p className="mb-4 whitespace-pre-wrap text-sm leading-relaxed text-white/75">
                    {item.descripcion || "Sin descripción."}
                  </p>

                  {item.archivos && item.archivos.length > 0 && (
                    <div className="mb-4 space-y-1">
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/40">
                        Archivos
                      </p>

                      {item.archivos.map((file) => (
                        <a
                          key={file.url}
                          href={file.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="block truncate text-sm text-emerald-200 underline decoration-white/20 hover:text-emerald-100"
                        >
                          {file.name}
                        </a>
                      ))}
                    </div>
                  )}

                  <div className="grid gap-3">
                    <ApprovalRow
                      label="PM"
                      approvalKey="pm"
                      firma={item.firmas?.pm}
                      currentUserEmail={userEmail}
                      canApprove={canApprovePM}
                      onDecision={(decision, reason) =>
                        onDecidirConfirmacion(item, "pm", decision, reason)
                      }
                    />

                    <ApprovalRow
                      label="Diseñador"
                      approvalKey="disenador"
                      firma={item.firmas?.disenador}
                      currentUserEmail={userEmail}
                      canApprove={canApproveDesigner}
                      onDecision={(decision, reason) =>
                        onDecidirConfirmacion(
                          item,
                          "disenador",
                          decision,
                          reason
                        )
                      }
                    />

                    <ApprovalRow
                      label="Encargado del proceso"
                      approvalKey="encargado"
                      firma={item.firmas?.encargado}
                      currentUserEmail={userEmail}
                      canApprove={canApproveProcessOwner}
                      onDecision={(decision, reason) =>
                        onDecidirConfirmacion(
                          item,
                          "encargado",
                          decision,
                          reason
                        )
                      }
                    />
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {isAdmin && pruebaBase && (confirmaciones.length === 0 || isNewOpen) && (
          <div className="w-full rounded-2xl border border-emerald-300/20 bg-emerald-400/10 p-4">
            <button
              type="button"
              onClick={() => toggle("new")}
              className="flex w-full items-center justify-between gap-3 text-left"
            >
              <div>
                <p className="text-xs uppercase tracking-[0.22em] text-emerald-100/60">
                  Nueva confirmación
                </p>
                <p className="mt-1 text-lg font-semibold text-emerald-50">
                  CONF {pruebaBase.versionLabel}
                </p>
                <p className="mt-1 text-xs text-emerald-50/55">
                  Basada en prueba de diseño {pruebaBase.versionLabel}.
                </p>
              </div>

              {isNewOpen ? <FiChevronDown /> : <FiChevronRight />}
            </button>

            {isNewOpen && (
              <form
                onSubmit={onGuardarConfirmacion}
                className="mt-4 space-y-4 border-t border-emerald-100/10 pt-4"
              >
                <div className="rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white/75">
                  Versión base de prueba:{" "}
                  <span className="font-semibold text-white">
                    {pruebaBase.versionLabel}
                  </span>
                </div>

                <textarea
                  className={`${inputClass} min-h-[150px]`}
                  value={confirmacionDesc}
                  onChange={(e) => setConfirmacionDesc(e.target.value)}
                  placeholder="Explica detalladamente las consideraciones del diseño, restricciones, cómo funciona, qué se debe cuidar, parámetros críticos, ajustes necesarios, observaciones de uso, ensamble, tolerancias, materiales, etc."
                />

                <FilePicker
                  label="Adjuntar archivos de diseño, fotos o videos"
                  files={confirmacionFiles}
                  inputRef={confirmacionInputRef}
                  onChange={(list) =>
                    addFiles(list, setConfirmacionFiles, confirmacionInputRef)
                  }
                  onRemove={(i) => removeFile(i, setConfirmacionFiles)}
                />

                <button disabled={loading} className={btnPrimary}>
                  <FiCheck /> Guardar confirmación
                </button>
              </form>
            )}
          </div>
        )}
      </div>
    </section>
  );
}