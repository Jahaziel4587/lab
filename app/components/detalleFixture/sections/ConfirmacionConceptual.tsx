"use client";

import type { FixtureVersion, ApprovalRole, Decision } from "../types";
import { cardClass } from "../styles";
import VersionList from "../components/VersionList";
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
  return (
    <section className={cardClass}>
      <h2 className="text-xl font-semibold">Confirmación conceptual</h2>
      <p className="mt-1 text-sm text-white/55">
        Se confirma la funcionalidad de la prueba por PM, diseñador y encargado
        del proceso.
      </p>

      <VersionList
        title="Pruebas pendientes / confirmadas"
        items={pruebas}
        renderActions={(item) => (
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
                onDecidirPrueba(item, "disenador", decision, reason)
              }
            />

            <ApprovalRow
              label="Encargado del proceso"
              approvalKey="encargado"
              firma={item.firmas?.encargado}
              currentUserEmail={userEmail}
              canApprove={canApproveProcessOwner}
              onDecision={(decision, reason) =>
                onDecidirPrueba(item, "encargado", decision, reason)
              }
            />
          </div>
        )}
      />
    </section>
  );
}