"use client";

import { useState } from "react";
import { FiChevronDown, FiChevronRight } from "react-icons/fi";
import type { FixtureVersion, ApprovalRole, Decision } from "../types";
import { cardClass } from "../styles";
import { formatFirebaseDate } from "../helpers";
import ApprovalRow from "../components/ApprovalRow";

export default function ConfirmacionConceptual({
  pruebas,
  userEmail,
  canApprovePM,
  canApproveDesigner,
  canApproveProcessOwner,
  onDecidirPrueba,
}: {
  pruebas: FixtureVersion[];
  userEmail?: string;
  canApprovePM: boolean;
  canApproveDesigner: boolean;
  canApproveProcessOwner: boolean;
  onDecidirPrueba: (
    prueba: FixtureVersion,
    rol: ApprovalRole,
    decision: Decision,
    reason?: string
  ) => void;
}) {
  const [expandedPruebaIds, setExpandedPruebaIds] = useState<string[]>([]);

  const togglePrueba = (id: string) => {
    setExpandedPruebaIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  return (
    <section className={cardClass}>
      <h2 className="text-xl font-semibold">Confirmación conceptual</h2>
      <p className="mt-1 text-sm text-white/55">
        Se confirma la funcionalidad de la prueba por PM, diseñador y encargado
        del proceso.
      </p>

      <div className="mt-6">
        {pruebas.length === 0 ? (
          <div className="rounded-2xl border border-white/10 bg-black/20 p-4 text-sm text-white/55">
            Aún no hay pruebas registradas para confirmar.
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
            {pruebas.map((item, index) => {
              const isOpen = expandedPruebaIds.includes(item.id);
              const fecha = formatFirebaseDate(item.createdAt);
              const isRejected = item.status === "rechazado";

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
                        <p className="mb-4 whitespace-pre-wrap text-sm leading-relaxed text-white/75">
                          {item.descripcion}
                        </p>
                      )}

                      {isRejected ? (
                        <div className="rounded-xl border border-red-300/20 bg-red-400/10 px-4 py-3 text-sm text-red-100">
                          Esta prueba fue rechazada. Ya no requiere firmas de
                          confirmación conceptual.
                        </div>
                      ) : (
                        <div className="grid gap-3">
                          <ApprovalRow
                            label="PM"
                            approvalKey="pm"
                            firma={item.firmas?.pm}
                            currentUserEmail={userEmail}
                            canApprove={canApprovePM}
                            onDecision={(decision, reason) =>
                              onDecidirPrueba(item, "pm", decision, reason)
                            }
                          />

                          <ApprovalRow
                            label="Diseñador"
                            approvalKey="disenador"
                            firma={item.firmas?.disenador}
                            currentUserEmail={userEmail}
                            canApprove={canApproveDesigner}
                            onDecision={(decision, reason) =>
                              onDecidirPrueba(
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
                              onDecidirPrueba(
                                item,
                                "encargado",
                                decision,
                                reason
                              )
                            }
                          />
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}