"use client";

import { useEffect, useMemo, useState } from "react";
import { arrayUnion, doc, updateDoc } from "firebase/firestore";
import { FiPaperclip, FiUpload, FiX } from "react-icons/fi";
import { db } from "@/src/firebase/firebaseConfig";
import type { ApprovalRole, Decision, UploadedFile } from "../types";
import { uploadFixtureFiles } from "../services/fixtureStorage";

export default function ApprovalRow({
  label,
  approvalKey,
  firma,
  canApprove,
  onDecision,
  pedidoId,
  pruebaId,
  versionLabel,
}: {
  label: string;
  approvalKey: ApprovalRole;
  firma?: any;
  currentUserEmail?: string;
  canApprove: boolean;
  onDecision: (decision: Decision, reason?: string) => void | Promise<void>;
  pedidoId?: string;
  pruebaId?: string;
  versionLabel?: string;
}) {
  const normalizedFirma = {
    ...firma,
    decision: firma?.decision || "",
    correo: firma?.correo || firma?.approvedByEmail || "",
    nombre: firma?.nombre || firma?.approvedByName || "",
    fecha: firma?.fecha || firma?.approvedAt || "",
    rejectReason: firma?.rejectReason || "",
    archivos: Array.isArray(firma?.archivos) ? firma.archivos : [],
  };

  const alreadyAnswered =
    normalizedFirma.decision === "aprobado" ||
    normalizedFirma.decision === "rechazado";

  const [signingOpen, setSigningOpen] = useState(false);
  const [decision, setDecision] = useState<Decision | "">(
    normalizedFirma.decision || ""
  );
  const [reason, setReason] = useState(normalizedFirma.rejectReason || "");
  const [rejectionFiles, setRejectionFiles] = useState<File[]>([]);
  const [savedFiles, setSavedFiles] = useState<UploadedFile[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setDecision(normalizedFirma.decision || "");
    setReason(normalizedFirma.rejectReason || "");
    setSigningOpen(false);
    setRejectionFiles([]);
  }, [normalizedFirma.decision, normalizedFirma.rejectReason]);

  const displayedFiles = useMemo(() => {
    const byUrl = new Map<string, UploadedFile>();

    [...normalizedFirma.archivos, ...savedFiles].forEach((file: UploadedFile) => {
      if (file?.url) byUrl.set(file.url, file);
    });

    return Array.from(byUrl.values());
  }, [normalizedFirma.archivos, savedFiles]);

  const statusClass =
    normalizedFirma.decision === "aprobado"
      ? "border-emerald-300/30 bg-emerald-400/10 text-emerald-100"
      : normalizedFirma.decision === "rechazado"
      ? "border-red-300/30 bg-red-400/10 text-red-100"
      : "border-yellow-300/30 bg-yellow-400/10 text-yellow-100";

  const canAttachRejectionEvidence = Boolean(
    pedidoId && pruebaId && versionLabel
  );

  const addRejectionFiles = (list: FileList | null) => {
    if (!list) return;

    const incoming = Array.from(list);
    setRejectionFiles((prev) => {
      const existing = new Set(
        prev.map((file) => `${file.name}-${file.size}-${file.lastModified}`)
      );

      return [
        ...prev,
        ...incoming.filter((file) => {
          const key = `${file.name}-${file.size}-${file.lastModified}`;
          if (existing.has(key)) return false;
          existing.add(key);
          return true;
        }),
      ];
    });
  };

  const submitDecision = async () => {
    if (!decision) {
      alert("Selecciona aprobado o rechazado.");
      return;
    }

    if (decision === "rechazado" && !reason.trim()) {
      alert("Agrega una breve explicación del rechazo.");
      return;
    }

    try {
      setSaving(true);

      let uploaded: UploadedFile[] = [];

      if (
        decision === "rechazado" &&
        rejectionFiles.length > 0 &&
        pedidoId &&
        pruebaId &&
        versionLabel
      ) {
        uploaded = await uploadFixtureFiles({
          pedidoId,
          files: rejectionFiles,
          folder: `pruebas/${versionLabel}/rechazos/${approvalKey}`,
        });
      }

      await Promise.resolve(
        onDecision(decision, decision === "rechazado" ? reason : "")
      );

      if (uploaded.length > 0 && pedidoId && pruebaId) {
        await updateDoc(
          doc(db, "pedidos", pedidoId, "fixture_pruebas", pruebaId),
          {
            [`firmas.${approvalKey}.archivos`]: arrayUnion(...uploaded),
          }
        );

        setSavedFiles((prev) => [...prev, ...uploaded]);
      }

      setRejectionFiles([]);
      setSigningOpen(false);
    } catch (error) {
      console.error("Error guardando decisión o evidencia:", error);
      alert("No se pudo guardar la decisión o sus archivos.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3.5 sm:p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex flex-col items-start gap-2 min-[390px]:flex-row min-[390px]:flex-wrap min-[390px]:items-center">
            <p className="break-words text-sm font-semibold text-white/85">{label}</p>
            <span
              className={`shrink-0 rounded-full border px-3 py-1 text-[11px] font-semibold ${statusClass}`}
            >
              {normalizedFirma.decision || "pendiente"}
            </span>
          </div>

          {alreadyAnswered && normalizedFirma.nombre && (
            <p className="mt-2 break-words text-xs leading-relaxed text-white/60">
              {normalizedFirma.decision === "aprobado"
                ? "Aprobado por"
                : "Rechazado por"}{" "}
              <span className="font-semibold text-white/85">
                {normalizedFirma.nombre}
              </span>
            </p>
          )}

          {alreadyAnswered && normalizedFirma.fecha && (
            <p className="mt-1 break-words text-[11px] text-white/35">
              {normalizedFirma.fecha}
            </p>
          )}

          {normalizedFirma.decision === "rechazado" &&
            normalizedFirma.rejectReason && (
              <div className="mt-3 break-words rounded-xl border border-red-300/20 bg-red-400/10 px-3 py-2 text-xs leading-relaxed text-red-100">
                Motivo: {normalizedFirma.rejectReason}
              </div>
            )}

          {displayedFiles.length > 0 && (
            <div className="mt-3 rounded-xl border border-white/10 bg-black/20 p-3">
              <div className="flex items-center gap-2 text-xs font-semibold text-white/55">
                <FiPaperclip />
                Archivos
              </div>
              <div className="mt-2 space-y-1.5">
                {displayedFiles.map((file) => (
                  <a
                    key={file.url}
                    href={file.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block break-all text-xs text-emerald-200 underline decoration-white/20 underline-offset-2 hover:text-emerald-100"
                  >
                    {file.name}
                  </a>
                ))}
              </div>
            </div>
          )}

          {!canApprove && !alreadyAnswered && (
            <p className="mt-2 text-xs leading-relaxed text-yellow-100/75">
              Pendiente de firma. Tu cuenta no está asignada como{" "}
              {approvalKey === "pm" ? "PM del proyecto" : label}.
            </p>
          )}
        </div>

        {canApprove && (
          <button
            type="button"
            onClick={() => setSigningOpen((prev) => !prev)}
            className="min-h-11 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-white/75 transition hover:bg-white/10 active:bg-white/15 sm:min-h-0 sm:w-auto sm:rounded-lg sm:py-1.5"
          >
            {alreadyAnswered ? "Editar firma" : "Firmar"}
          </button>
        )}
      </div>

      {signingOpen && canApprove && (
        <div className="mt-4 grid gap-3 border-t border-white/10 pt-4">
          <label className="text-xs font-semibold uppercase tracking-[0.18em] text-white/40">
            Decisión
          </label>

          <select
            value={decision}
            onChange={(e) => setDecision(e.target.value as Decision | "")}
            className="min-h-11 w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none focus:ring-2 focus:ring-emerald-400/20"
          >
            <option value="">Seleccionar decisión</option>
            <option value="aprobado">Aprobado</option>
            <option value="rechazado">Rechazado</option>
          </select>

          {decision === "rechazado" && (
            <>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Razón del rechazo o cambio de decisión..."
                className="min-h-[96px] w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-xs text-white placeholder:text-white/35 outline-none focus:ring-2 focus:ring-emerald-400/20"
              />

              {canAttachRejectionEvidence && (
                <div className="rounded-xl border border-white/10 bg-black/20 p-3">
                  <label className="flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-medium text-white/80 transition hover:bg-white/10 sm:inline-flex sm:min-h-0">
                    <FiUpload />
                    Adjuntar archivos
                    <input
                      type="file"
                      multiple
                      className="hidden"
                      onChange={(event) => {
                        addRejectionFiles(event.target.files);
                        event.target.value = "";
                      }}
                    />
                  </label>

                  {rejectionFiles.length > 0 && (
                    <div className="mt-3 space-y-2">
                      {rejectionFiles.map((file, index) => (
                        <div
                          key={`${file.name}-${file.size}-${file.lastModified}`}
                          className="flex items-center justify-between gap-3 rounded-lg bg-white/[0.04] px-3 py-2"
                        >
                          <span className="min-w-0 flex-1 truncate text-xs text-white/70">
                            {file.name}
                          </span>
                          <button
                            type="button"
                            onClick={() =>
                              setRejectionFiles((prev) =>
                                prev.filter((_, fileIndex) => fileIndex !== index)
                              )
                            }
                            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-white/50 hover:bg-white/10 hover:text-white"
                            title="Quitar archivo"
                          >
                            <FiX />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </>
          )}

          <div className="grid grid-cols-1 gap-2 sm:flex sm:flex-wrap">
            <button
              type="button"
              onClick={submitDecision}
              disabled={saving}
              className="min-h-11 rounded-xl border border-emerald-300/25 bg-emerald-400/10 px-3 py-2 text-xs text-emerald-100 transition hover:bg-emerald-400/20 disabled:cursor-not-allowed disabled:opacity-50 sm:min-h-0 sm:rounded-lg sm:py-1.5"
            >
              {saving ? "Guardando..." : "Guardar firma"}
            </button>

            <button
              type="button"
              onClick={() => {
                setSigningOpen(false);
                setRejectionFiles([]);
              }}
              disabled={saving}
              className="min-h-11 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-white/75 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50 sm:min-h-0 sm:rounded-lg sm:py-1.5"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
