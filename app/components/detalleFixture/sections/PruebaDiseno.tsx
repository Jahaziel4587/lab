"use client";

import { useState } from "react";
import type { Dispatch, FormEvent, RefObject, SetStateAction } from "react";
import { useRouter } from "next/navigation";
import {
  FiCheck,
  FiChevronDown,
  FiChevronRight,
  FiLink,
  FiPlus,
} from "react-icons/fi";
import type {
  FixtureVersion,
  LinkedPedido,
  ApprovalRole,
  Decision,
} from "../types";
import { cardClass, inputClass, btnPrimary } from "../styles";
import { buildFixtureOrderUrl, formatFirebaseDate } from "../helpers";
import FilePicker from "../components/FilePicker";
import ApprovalRow from "../components/ApprovalRow";

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
  onDecidirPrueba: (
    prueba: FixtureVersion,
    rol: ApprovalRole,
    decision: Decision,
    reason?: string
  ) => void;
}) {
  const router = useRouter();
  const [expandedPruebaIds, setExpandedPruebaIds] = useState<string[]>([]);

  const togglePrueba = (id: string) => {
    setExpandedPruebaIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const isNewPruebaOpen = expandedPruebaIds.includes("new");

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

        {isAdmin && (
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
        )}
      </div>

      <div className="mt-6">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          {pruebas.map((item, index) => {
            const isOpen = expandedPruebaIds.includes(item.id);
            const fecha = formatFirebaseDate(item.createdAt);

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

                    <div className="mt-4">
                      <ApprovalRow
                        label="Firma PM"
                        approvalKey="pm"
                        firma={item.firmas?.pm}
                        currentUserEmail={userEmail}
                        canApprove={canApprovePM}
                        onDecision={(decision, reason) =>
                          onDecidirPrueba(item, "pm", decision, reason)
                        }
                      />
                    </div>
                  </div>
                )}
              </div>
            );
          })}

          {isAdmin && (pruebas.length === 0 || isNewPruebaOpen) && (
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

      {!isAdmin && pruebas.length === 0 && (
        <div className="mt-5 rounded-2xl border border-white/10 bg-black/20 p-4 text-sm text-white/55">
          Aún no hay pruebas registradas.
        </div>
      )}
    </section>
  );
}