"use client";

import { FiChevronDown, FiChevronUp, FiX } from "react-icons/fi";
import {
  cardClass,
  cardPad,
  textareaClass,
  btnSoft,
  btnPrimary,
  btnDanger,
} from "../styles";
import { SpecUpdate } from "../types";

type Props = {
  specUpdates: SpecUpdate[];
  showSpecForm: boolean;
  setShowSpecForm: React.Dispatch<React.SetStateAction<boolean>>;
  specDesc: string;
  setSpecDesc: React.Dispatch<React.SetStateAction<string>>;
  specFiles: File[];
  savingSpec: boolean;
  specInputRef: React.RefObject<HTMLInputElement | null>;
  addSpecFiles: (list: FileList | null) => void;
  removeSpecFile: (idx: number) => void;
  moveSpecFile: (idx: number, dir: -1 | 1) => void;
  handleSpecSubmit: (e: React.FormEvent) => void;
};

export default function SpecUpdatesCard({
  specUpdates,
  showSpecForm,
  setShowSpecForm,
  specDesc,
  setSpecDesc,
  specFiles,
  savingSpec,
  specInputRef,
  addSpecFiles,
  removeSpecFile,
  moveSpecFile,
  handleSpecSubmit,
}: Props) {
  return (
    <div className={`mt-6 ${cardClass} ${cardPad}`}>
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-white/90">
            Especificaciones adicionales / versiones
          </h2>
          <p className="mt-1 text-sm text-white/60">
            Cambios sobre el pedido original (v1).
          </p>
        </div>

        <button
          type="button"
          onClick={() => setShowSpecForm((prev) => !prev)}
          className={btnSoft}
        >
          {showSpecForm ? "Cerrar" : "Agregar especificaciones"}
        </button>
      </div>

      <div className="mt-4">
        {specUpdates.length === 0 ? (
          <p className="text-sm text-white/60">
            Aún no se han registrado cambios. La versión 1 corresponde al pedido
            original.
          </p>
        ) : (
          <div className="space-y-3">
            {specUpdates.map((s) => {
              const fecha =
                s.createdAt?.toDate?.() instanceof Date
                  ? s.createdAt.toDate()
                  : null;

              return (
                <div
                  key={s.id}
                  className="rounded-2xl border border-white/10 bg-white/[0.04] p-4"
                >
                  <div className="flex items-center justify-between gap-3 mb-2">
                    <span className="font-semibold text-white/90">
                      Versión {s.version}{" "}
                      <span className="text-white/50 font-normal">
                        (sobre original)
                      </span>
                    </span>

                    <span className="text-xs text-white/45">
                      {fecha ? fecha.toLocaleString() : "Fecha no disponible"}
                    </span>
                  </div>

                  {s.descripcion && (
                    <p className="text-sm text-white/85 whitespace-pre-wrap leading-relaxed">
                      {s.descripcion}
                    </p>
                  )}

                  {s.archivos && s.archivos.length > 0 && (
                    <div className="mt-3">
                      <div className="text-sm font-medium text-white/80">
                        Archivos adjuntos de esta versión:
                      </div>

                      <ul className="mt-2 space-y-2">
                        {s.archivos.map((a) => (
                          <li key={a.url}>
                            <a
                              href={a.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-emerald-200 hover:text-emerald-100 underline decoration-white/20 text-sm"
                            >
                              {a.name}
                            </a>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {showSpecForm && (
        <form
          onSubmit={handleSpecSubmit}
          className="mt-5 border-t border-white/10 pt-5 space-y-4"
        >
          <div>
            <label className="block text-sm font-medium text-white/85 mb-2">
              Descripción del cambio / especificaciones nuevas
            </label>

            <textarea
              className={textareaClass}
              rows={3}
              value={specDesc}
              onChange={(e) => setSpecDesc(e.target.value)}
              placeholder="Ejemplo: Se actualiza el archivo de diseño por versión con más grosor en la pared lateral…"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-white/85 mb-2">
              Adjuntar archivos
            </label>

            <label className="inline-flex items-center gap-2 rounded-xl border border-white/12 bg-white/5 px-4 py-2 text-sm text-white/85 cursor-pointer hover:bg-white/10 transition">
              <span className="text-white/70">⬆</span>
              Seleccionar archivos
              <input
                ref={specInputRef}
                type="file"
                multiple
                className="hidden"
                onChange={(e) => addSpecFiles(e.target.files)}
              />
            </label>

            {specFiles.length > 0 && (
              <div className="mt-3 rounded-2xl border border-white/10 bg-black/20 overflow-hidden">
                <div className="px-4 py-3 text-xs text-white/60 border-b border-white/10">
                  Archivos seleccionados (puedes reordenar):
                </div>

                <ul className="divide-y divide-white/10">
                  {specFiles.map((f, idx) => (
                    <li
                      key={`${f.name}_${f.size}_${f.lastModified}`}
                      className="flex items-center justify-between gap-3 px-4 py-3"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-white/90 truncate">
                          {f.name}
                        </p>
                        <p className="text-xs text-white/50">
                          {(f.size / 1024 / 1024).toFixed(2)} MB
                        </p>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => moveSpecFile(idx, -1)}
                          disabled={idx === 0}
                          className={`${btnSoft} !px-2 !py-2 disabled:opacity-40`}
                          title="Subir"
                        >
                          <FiChevronUp />
                        </button>

                        <button
                          type="button"
                          onClick={() => moveSpecFile(idx, 1)}
                          disabled={idx === specFiles.length - 1}
                          className={`${btnSoft} !px-2 !py-2 disabled:opacity-40`}
                          title="Bajar"
                        >
                          <FiChevronDown />
                        </button>

                        <button
                          type="button"
                          onClick={() => removeSpecFile(idx)}
                          className={`${btnDanger} !px-2 !py-2`}
                          title="Quitar"
                        >
                          <FiX />
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          <div className="flex items-center gap-3">
            <button type="submit" disabled={savingSpec} className={btnPrimary}>
              {savingSpec ? "Guardando…" : "Guardar como nueva versión"}
            </button>

            <p className="text-xs text-white/45">
              Se registrará como la versión siguiente (v2, v3, etc.) con fecha
              automática.
            </p>
          </div>
        </form>
      )}
    </div>
  );
}