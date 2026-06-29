"use client";

import type {
  Dispatch,
  FormEvent,
  RefObject,
  SetStateAction,
} from "react";
import { FiCheck, FiChevronDown, FiChevronRight, FiPlus, FiX } from "react-icons/fi";
import type { Decision, FixtureVersion } from "../types";
import { cardClass, inputClass, btnPrimary, btnDanger } from "../styles";
import { formatFirebaseDate } from "../helpers";
import FilePicker from "../components/FilePicker";
import ApprovalRow from "../components/ApprovalRow";

export default function ConceptoDiseno({
  conceptos,
  isAdmin,
  loading,
  nextConceptLabel,
  conceptoDesc,
  setConceptoDesc,
  conceptoSpecs,
  conceptoFiles,
  setConceptoFiles,
  conceptoInputRef,
  expandedConceptIds,
  setExpandedConceptIds,
  userEmail,
  canApprovePM,
  addFiles,
  removeFile,
  updateSpec,
  addSpec,
  removeSpec,
  onGuardarConcepto,
  onDecidirConcepto,
}: {
  conceptos: FixtureVersion[];
  isAdmin: boolean;
  loading: boolean;
  nextConceptLabel: string;
  conceptoDesc: string;
  setConceptoDesc: Dispatch<SetStateAction<string>>;
  conceptoSpecs: string[];
  conceptoFiles: File[];
  setConceptoFiles: Dispatch<SetStateAction<File[]>>;
  conceptoInputRef: RefObject<HTMLInputElement | null>;
  expandedConceptIds: string[];
  setExpandedConceptIds: Dispatch<SetStateAction<string[]>>;
  userEmail?: string;
  canApprovePM: boolean;
  addFiles: (
    list: FileList | null,
    setter: Dispatch<SetStateAction<File[]>>,
    inputRef: RefObject<HTMLInputElement | null>
  ) => void;
  removeFile: (
    index: number,
    setter: Dispatch<SetStateAction<File[]>>
  ) => void;
  updateSpec: (index: number, value: string) => void;
  addSpec: () => void;
  removeSpec: (index: number) => void;
  onGuardarConcepto: (e: FormEvent) => void;
  onDecidirConcepto: (
    concepto: FixtureVersion,
    decision: Decision,
    reason?: string
  ) => void;
}) {
  const toggleConcept = (id: string) => {
    setExpandedConceptIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const isNewConceptOpen = expandedConceptIds.includes("new");

  return (
    <section className={cardClass}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold">Concepto de diseño</h2>
          <p className="mt-1 text-sm text-white/55">
            Las versiones se registran como VA, VB, VC… y se recorren hacia la
            derecha. Cada versión puede desplegarse o comprimirse.
          </p>
        </div>

        {isAdmin && (
          <button
            type="button"
            onClick={() => {
              if (!expandedConceptIds.includes("new")) {
                setExpandedConceptIds((prev) => [...prev, "new"]);
              }
            }}
            className={btnPrimary}
          >
            <FiPlus /> Agregar {nextConceptLabel}
          </button>
        )}
      </div>

      <div className="mt-6">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          {conceptos.map((item, index) => {
            const isOpen = expandedConceptIds.includes(item.id);
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
                  onClick={() => toggleConcept(item.id)}
                  className="flex w-full items-center justify-between gap-3 text-left"
                >
                  <div className="min-w-0">
                    <p className="text-xs uppercase tracking-[0.22em] text-white/40">
                      Versión {index + 1}
                    </p>
                    <p className="mt-1 text-lg font-semibold text-white/90">
                      {item.versionLabel}
                    </p>
                    <p className="mt-1 text-xs text-white/45">{fecha}</p>
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
                    {item.descripcion && (
                      <p className="whitespace-pre-wrap text-sm leading-relaxed text-white/75">
                        {item.descripcion}
                      </p>
                    )}

                    {item.especificacionesExtra &&
                      item.especificacionesExtra.length > 0 && (
                        <div className="mt-4">
                          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/40">
                            Especificaciones extra
                          </p>
                          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-white/70">
                            {item.especificacionesExtra.map((s, i) => (
                              <li key={i}>{s}</li>
                            ))}
                          </ul>
                        </div>
                      )}

                    {item.archivos && item.archivos.length > 0 && (
                      <div className="mt-4 space-y-1">
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

                    <div className="mt-4">
                      <ApprovalRow
                        label="Firma PM"
                        approvalKey="pm"
                        firma={item.firmas?.pm}
                        currentUserEmail={userEmail}
                        canApprove={canApprovePM}
                        onDecision={(decision, reason) =>
                          onDecidirConcepto(item, decision, reason)
                        }
                      />
                    </div>
                  </div>
                )}
              </div>
            );
          })}

          {isAdmin && (conceptos.length === 0 || isNewConceptOpen) && (
            <div className="w-full rounded-2xl border border-emerald-300/20 bg-emerald-400/10 p-4">
              <button
                type="button"
                onClick={() => toggleConcept("new")}
                className="flex w-full items-center justify-between gap-3 text-left"
              >
                <div>
                  <p className="text-xs uppercase tracking-[0.22em] text-emerald-100/60">
                    Nueva versión
                  </p>
                  <p className="mt-1 text-lg font-semibold text-emerald-50">
                    {nextConceptLabel}
                  </p>
                  <p className="mt-1 text-xs text-emerald-50/55">
                    Carga descripción, archivos y especificaciones.
                  </p>
                </div>
                {isNewConceptOpen ? <FiChevronDown /> : <FiChevronRight />}
              </button>

              {isNewConceptOpen && (
                <form
                  onSubmit={onGuardarConcepto}
                  className="mt-4 space-y-4 border-t border-emerald-100/10 pt-4"
                >
                  <div className="space-y-3">
                    <p className="text-sm font-semibold text-white/80">
                      Especificaciones extra encontradas sobre la solicitud formal
                    </p>

                    {conceptoSpecs.map((spec, index) => (
                      <div key={index} className="flex gap-3">
                        <input
                          className={inputClass}
                          value={spec}
                          onChange={(e) => updateSpec(index, e.target.value)}
                          placeholder="Ej. requiere mayor soporte lateral..."
                        />

                        {index === conceptoSpecs.length - 1 && (
                          <button
                            type="button"
                            onClick={addSpec}
                            className="shrink-0 rounded-xl border border-white/12 bg-white/5 px-4 py-2 text-sm text-white/85 transition hover:bg-white/10"
                            title="Agregar especificación"
                          >
                            <FiPlus />
                          </button>
                        )}

                        {conceptoSpecs.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeSpec(index)}
                            className={btnDanger}
                            title="Eliminar especificación"
                          >
                            <FiX />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>

                  <div className="space-y-3">
                    <p className="text-sm font-semibold text-white/80">
                      Concepto de diseño
                    </p>

                    <textarea
                      className={`${inputClass} min-h-[110px]`}
                      value={conceptoDesc}
                      onChange={(e) => setConceptoDesc(e.target.value)}
                      placeholder="La idea de diseño consiste en..."
                    />
                  </div>

                  <FilePicker
                    label="Adjuntar archivos del concepto"
                    files={conceptoFiles}
                    inputRef={conceptoInputRef}
                    onChange={(list) =>
                      addFiles(list, setConceptoFiles, conceptoInputRef)
                    }
                    onRemove={(i) => removeFile(i, setConceptoFiles)}
                  />

                  <button disabled={loading} className={btnPrimary}>
                    <FiCheck /> Guardar concepto
                  </button>
                </form>
              )}
            </div>
          )}
        </div>
      </div>

      {!isAdmin && conceptos.length === 0 && (
        <div className="mt-5 rounded-2xl border border-white/10 bg-black/20 p-4 text-sm text-white/55">
          Aún no hay conceptos registrados.
        </div>
      )}
    </section>
  );
}