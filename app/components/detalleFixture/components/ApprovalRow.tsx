"use client";

import { useEffect, useState } from "react";
import type { ApprovalRole, Decision } from "../types";

export default function ApprovalRow({
  label,
  approvalKey,
  firma,
  canApprove,
  onDecision,
}: {
  label: string;
  approvalKey: ApprovalRole;
  firma?: any;
  currentUserEmail?: string;
  canApprove: boolean;
  onDecision: (decision: Decision, reason?: string) => void;
}) {
  const normalizedFirma = {
    ...firma,
    decision: firma?.decision || "",
    correo: firma?.correo || firma?.approvedByEmail || "",
    nombre: firma?.nombre || firma?.approvedByName || "",
    fecha: firma?.fecha || firma?.approvedAt || "",
    rejectReason: firma?.rejectReason || "",
  };

  const alreadyAnswered =
    normalizedFirma.decision === "aprobado" ||
    normalizedFirma.decision === "rechazado";

  const [signingOpen, setSigningOpen] = useState(false);
  const [decision, setDecision] = useState<Decision | "">(
    normalizedFirma.decision || ""
  );
  const [reason, setReason] = useState(normalizedFirma.rejectReason || "");

  useEffect(() => {
    setDecision(normalizedFirma.decision || "");
    setReason(normalizedFirma.rejectReason || "");
    setSigningOpen(false);
  }, [normalizedFirma.decision, normalizedFirma.rejectReason]);

  const statusClass =
    normalizedFirma.decision === "aprobado"
      ? "border-emerald-300/30 bg-emerald-400/10 text-emerald-100"
      : normalizedFirma.decision === "rechazado"
      ? "border-red-300/30 bg-red-400/10 text-red-100"
      : "border-yellow-300/30 bg-yellow-400/10 text-yellow-100";

  const submitDecision = () => {
    if (!decision) {
      alert("Selecciona aprobado o rechazado.");
      return;
    }

    if (decision === "rechazado" && !reason.trim()) {
      alert("Agrega una breve explicación del rechazo.");
      return;
    }

    onDecision(decision, decision === "rechazado" ? reason : "");
    setSigningOpen(false);
  };

  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold text-white/85">{label}</p>
            <span
              className={`rounded-full border px-3 py-1 text-[11px] font-semibold ${statusClass}`}
            >
              {normalizedFirma.decision || "pendiente"}
            </span>
          </div>

          {alreadyAnswered && normalizedFirma.nombre && (
            <p className="mt-2 text-xs text-white/60">
              {normalizedFirma.decision === "aprobado"
                ? "Aprobado por"
                : "Rechazado por"}{" "}
              <span className="font-semibold text-white/85">
                {normalizedFirma.nombre}
              </span>
            </p>
          )}

          {alreadyAnswered && normalizedFirma.fecha && (
            <p className="mt-1 text-[11px] text-white/35">
              {normalizedFirma.fecha}
            </p>
          )}

          {normalizedFirma.decision === "rechazado" &&
            normalizedFirma.rejectReason && (
              <div className="mt-3 rounded-xl border border-red-300/20 bg-red-400/10 px-3 py-2 text-xs leading-relaxed text-red-100">
                Motivo: {normalizedFirma.rejectReason}
              </div>
            )}

          {!canApprove && !alreadyAnswered && (
            <p className="mt-2 text-xs text-yellow-100/75">
              Pendiente de firma. Tu cuenta no está asignada como{" "}
              {approvalKey === "pm" ? "PM del proyecto" : label}.
            </p>
          )}
        </div>

        {canApprove && (
          <button
            type="button"
            onClick={() => setSigningOpen((prev) => !prev)}
            className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white/75 hover:bg-white/10"
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
            className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none focus:ring-2 focus:ring-emerald-400/20"
          >
            <option value="">Seleccionar decisión</option>
            <option value="aprobado">Aprobado</option>
            <option value="rechazado">Rechazado</option>
          </select>

          {decision === "rechazado" && (
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Razón del rechazo o cambio de decisión..."
              className="min-h-[82px] w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-xs text-white placeholder:text-white/35 outline-none focus:ring-2 focus:ring-emerald-400/20"
            />
          )}

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={submitDecision}
              className="rounded-lg border border-emerald-300/25 bg-emerald-400/10 px-3 py-1.5 text-xs text-emerald-100 hover:bg-emerald-400/20"
            >
              Guardar firma
            </button>

            <button
              type="button"
              onClick={() => setSigningOpen(false)}
              className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white/75 hover:bg-white/10"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}