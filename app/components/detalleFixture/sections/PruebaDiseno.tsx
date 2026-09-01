"use client";

import { useState } from "react";
import type { Dispatch, FormEvent, RefObject, SetStateAction } from "react";
import { useRouter } from "next/navigation";
import { arrayUnion, doc, updateDoc } from "firebase/firestore";
import {
  FiCheck,
  FiChevronDown,
  FiChevronRight,
  FiLink,
  FiPaperclip,
  FiPlus,
  FiUpload,
} from "react-icons/fi";
import { db } from "@/src/firebase/firebaseConfig";
import type {
  FixtureVersion,
  LinkedPedido,
  ApprovalRole,
  Decision,
  UploadedFile,
} from "../types";
import { cardClass, inputClass, btnPrimary } from "../styles";
import { buildFixtureOrderUrl, formatFirebaseDate } from "../helpers";
import FilePicker from "../components/FilePicker";
import ApprovalRow from "../components/ApprovalRow";
import { uploadFixtureFiles } from "../services/fixtureStorage";

function PedidosAsociados({ pedidos }: { pedidos: LinkedPedido[] }) {
  const router = useRouter();
  const total = pedidos.reduce((sum, p) => sum + Number(p.subtotal || 0), 0);

  if (pedidos.length === 0) {
    return (
      <p className="mt-3 text-xs text-white/45">
        No hay pedidos asociados a esta prueba.
      </p>
    );
  }

  return (
    <div className="mt-4 rounded-xl border border-white/10 bg-black/20 p-3">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/40">
        Pedidos asociados
      </p>

      <ul className="mt-2 space-y-2">
        {pedidos.map((p) => (
          <li key={p.id}>
            <button
              type="button"
              onClick={() => router.push(`/solicitudes/listado/${p.id}`)}
              className="inline-flex items-center gap-2 text-sm text-emerald-200 underline decoration-white/20 hover:text-emerald-100"
            >
              <FiLink />
              {p.titulo || p.id}{" "}
              {p.subtotal ? `(MXN ${Number(p.subtotal).toFixed(2)})` : ""}
            </button>
          </li>
        ))}
      </ul>

      <p className="mt-3 text-sm font-semibold text-white/85">
        Total: MXN {total.toFixed(2)}
      </p>
    </div>
  );
}

export default function PruebaDiseno({
  pruebas,
  linkedPedidos,
  pedidoId,
  pedidoProyecto,
  isAdmin,
  loading,
  nextPruebaLabel,
  pruebaDesc,
  setPruebaDesc,
  pruebaFiles,
  setPruebaFiles,
  pruebaInputRef,
  addFiles,
  removeFile,
  onGuardarPrueba,
  userEmail,
  canApprovePM,
  canApproveDesigner,
  canApproveProcessOwner,
  onDecidirPrueba,
}: {
  pruebas: FixtureVersion[];
  linkedPedidos: LinkedPedido[];
  pedidoId: string;
  pedidoProyecto: string;
  isAdmin: boolean;
  loading: boolean;
  nextPruebaLabel: string;
  pruebaDesc: string;
  setPruebaDesc: Dispatch<SetStateAction<string>>;
  pruebaFiles: File[];
  setPruebaFiles: Dispatch<SetStateAction<File[]>>;
  pruebaInputRef: RefObject<HTMLInputElement | null>;
  addFiles: (
    list: FileList | null,
    setter: Dispatch<SetStateAction<File[]>>,
    inputRef: RefObject<HTMLInputElement | null>
  ) => void;
  removeFile: (
    index: number,
    setter: Dispatch<SetStateAction<File[]>>
  ) => void;
  onGuardarPrueba: (e: FormEvent) => void;
  userEmail?: string;
  canApprovePM: boolean;
  canApproveDesigner: boolean;
  canApproveProcessOwner: boolean;
  onDecidirPrueba: (
    prueba: FixtureVersion,
    rol: ApprovalRole,
    decision: Decision,
    reason?: string
  ) => void | Promise<void>;
}) {
  const router = useRouter();
  void isAdmin;
  const [expandedPruebaIds, setExpandedPruebaIds] = useState<string[]>([]);
  const [uploadingVersionId, setUploadingVersionId] = useState<string | null>(null);
  const [addedFilesByVersion, setAddedFilesByVersion] = useState<
    Record<string, UploadedFile[]>
  >({});

  const togglePrueba = (id: string) => {
    setExpandedPruebaIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const isNewPruebaOpen = expandedPruebaIds.includes("new");
  const pedidosDePrueba = linkedPedidos.filter(
    (p) => p.fixtureRelacionadoFase === "prueba"
  );

  const totalPruebaDiseno = pedidosDePrueba.reduce(
    (sum, p) => sum + Number(p.subtotal || 0),
    0
  );

  const getDisplayedFiles = (item: FixtureVersion) => {
    const byUrl = new Map<string, UploadedFile>();

    [...(item.archivos || []), ...(addedFilesByVersion[item.id] || [])].forEach(
      (file) => {
        if (file?.url) byUrl.set(file.url, file);
      }
    );

    return Array.from(byUrl.values());
  };

  const agregarArchivosVersion = async (
    item: FixtureVersion,
    list: FileList | null
  ) => {
    const files = Array.from(list || []);
    if (files.length === 0 || uploadingVersionId) return;

    try {
      setUploadingVersionId(item.id);

      const uploaded = await uploadFixtureFiles({
        pedidoId,
        files,
        folder: `pruebas/${item.versionLabel}`,
      });

      if (uploaded.length > 0) {
        await updateDoc(
          doc(db, "pedidos", pedidoId, "fixture_pruebas", item.id),
          {
            archivos: arrayUnion(...uploaded),
          }
        );

        setAddedFilesByVersion((prev) => ({
          ...prev,
          [item.id]: [...(prev[item.id] || []), ...uploaded],
        }));
      }
    } catch (error) {
      console.error("Error agregando archivos a la prueba:", error);
      alert("No se pudieron agregar los archivos a esta prueba.");
    } finally {
      setUploadingVersionId(null);
    }
  };

  return (
    <section className={cardClass}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold">Prueba de diseño</h2>
          <p className="mt-1 text-sm text-white/55">
            Las pruebas se ligan al concepto aprobado y se registran como{" "}
            {nextPruebaLabel || "VA.1"}, VA.2, etc.
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            if (!expandedPruebaIds.includes("new")) {
              setExpandedPruebaIds((prev) => [...prev, "new"]);
            }
          }}
          className={btnPrimary}
        >
          <FiPlus /> Agregar {nextPruebaLabel}
        </button>
      </div>

      <div className="mt-5 rounded-2xl border border-emerald-300/20 bg-emerald-400/10 px-4 py-3">
        <p className="text-xs uppercase tracking-[0.18em] text-emerald-100/60">
          Costo acumulado de prueba de diseño
        </p>
        <p className="mt-1 text-lg font-semibold text-emerald-50">
          MXN {totalPruebaDiseno.toFixed(2)}
        </p>
      </div>

      <div className="mt-6">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          {pruebas.map((item, index) => {
            const isOpen = expandedPruebaIds.includes(item.id);
            const fecha = formatFirebaseDate(item.createdAt);
            const displayedFiles = getDisplayedFiles(item);

            const pedidosDeVersion = linkedPedidos.filter(
              (p) =>
                p.fixtureRelacionadoFase === "prueba" &&
                p.fixtureRelacionadoVersion === item.versionLabel
            );

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
                  onClick={() => togglePrueba(item.id)}
                  className="flex w-full items-center justify-between gap-3 text-left"
                >
                  <div className="min-w-0">
                    <p className="text-xs uppercase tracking-[0.22em] text-white/40">
                      Prueba {index + 1}
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

                    <div className="mt-4 rounded-xl border border-white/10 bg-black/20 p-3">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-white/40">
                          <FiPaperclip />
                          Archivos
                        </div>

                        <label className="inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-medium text-white/80 transition hover:bg-white/10 sm:min-h-0 sm:py-1.5">
                          <FiUpload />
                          {uploadingVersionId === item.id
                            ? "Subiendo..."
                            : "Agregar archivos"}
                          <input
                            type="file"
                            multiple
                            disabled={uploadingVersionId !== null}
                            className="hidden"
                            onChange={(event) => {
                              agregarArchivosVersion(item, event.target.files);
                              event.target.value = "";
                            }}
                          />
                        </label>
                      </div>

                      {displayedFiles.length > 0 && (
                        <div className="mt-3 space-y-1.5">
                          {displayedFiles.map((file) => (
                            <a
                              key={file.url}
                              href={file.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="block break-all text-sm text-emerald-200 underline decoration-white/20 underline-offset-2 hover:text-emerald-100"
                            >
                              {file.name}
                            </a>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="mt-4">
                      <button
                        type="button"
                        onClick={() =>
                          router.push(
                            buildFixtureOrderUrl({
                              proyecto: pedidoProyecto,
                              fixtureId: pedidoId,
                              fixtureFase: "prueba",
                              fixtureVersion: item.versionLabel,
                            })
                          )
                        }
                        className={btnPrimary}
                      >
                        <FiPlus /> Realizar pedido
                      </button>
                    </div>

                    <PedidosAsociados pedidos={pedidosDeVersion} />

                    <div className="mt-5 space-y-3">
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/40">
                        Aprobaciones de la prueba de diseño
                      </p>

                      <ApprovalRow
                        label="Firma Project Manager"
                        approvalKey="pm"
                        firma={item.firmas?.pm}
                        currentUserEmail={userEmail}
                        canApprove={canApprovePM}
                        pedidoId={pedidoId}
                        pruebaId={item.id}
                        versionLabel={item.versionLabel}
                        onDecision={(decision, reason) =>
                          onDecidirPrueba(item, "pm", decision, reason)
                        }
                      />

                      <ApprovalRow
                        label="Firma Diseñador"
                        approvalKey="disenador"
                        firma={item.firmas?.disenador}
                        currentUserEmail={userEmail}
                        canApprove={canApproveDesigner}
                        pedidoId={pedidoId}
                        pruebaId={item.id}
                        versionLabel={item.versionLabel}
                        onDecision={(decision, reason) =>
                          onDecidirPrueba(item, "disenador", decision, reason)
                        }
                      />

                      <ApprovalRow
                        label="Firma Encargado del proceso"
                        approvalKey="encargado"
                        firma={item.firmas?.encargado}
                        currentUserEmail={userEmail}
                        canApprove={canApproveProcessOwner}
                        pedidoId={pedidoId}
                        pruebaId={item.id}
                        versionLabel={item.versionLabel}
                        onDecision={(decision, reason) =>
                          onDecidirPrueba(item, "encargado", decision, reason)
                        }
                      />
                    </div>
                  </div>
                )}
              </div>
            );
          })}

          {(pruebas.length === 0 || isNewPruebaOpen) && (
            <div className="w-full rounded-2xl border border-emerald-300/20 bg-emerald-400/10 p-4">
              <button
                type="button"
                onClick={() => togglePrueba("new")}
                className="flex w-full items-center justify-between gap-3 text-left"
              >
                <div>
                  <p className="text-xs uppercase tracking-[0.22em] text-emerald-100/60">
                    Nueva prueba
                  </p>
                  <p className="mt-1 text-lg font-semibold text-emerald-50">
                    {nextPruebaLabel}
                  </p>
                  <p className="mt-1 text-xs text-emerald-50/55">
                    Registra evidencia, fotos, videos y resultado de la prueba.
                  </p>
                </div>
                {isNewPruebaOpen ? <FiChevronDown /> : <FiChevronRight />}
              </button>

              {isNewPruebaOpen && (
                <form
                  onSubmit={onGuardarPrueba}
                  className="mt-4 space-y-4 border-t border-emerald-100/10 pt-4"
                >
                  <div className="space-y-3">
                    <p className="text-sm font-semibold text-white/80">
                      Descripción de la prueba
                    </p>

                    <textarea
                      className={`${inputClass} min-h-[110px]`}
                      value={pruebaDesc}
                      onChange={(e) => setPruebaDesc(e.target.value)}
                      placeholder="Describe la prueba, ensamble, funcionalidad observada y decisiones críticas..."
                    />
                  </div>

                  <FilePicker
                    label="Adjuntar fotos o videos del ensamble / prueba"
                    files={pruebaFiles}
                    inputRef={pruebaInputRef}
                    onChange={(list) =>
                      addFiles(list, setPruebaFiles, pruebaInputRef)
                    }
                    onRemove={(i) => removeFile(i, setPruebaFiles)}
                    accept="image/*,video/*"
                  />

                  <div className="flex flex-wrap gap-3">
                    <button disabled={loading} className={btnPrimary}>
                      <FiCheck /> Guardar prueba
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        router.push(
                          buildFixtureOrderUrl({
                            proyecto: pedidoProyecto,
                            fixtureId: pedidoId,
                            fixtureFase: "prueba",
                            fixtureVersion: nextPruebaLabel,
                          })
                        )
                      }
                      className={btnPrimary}
                    >
                      <FiPlus /> Realizar pedido
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
