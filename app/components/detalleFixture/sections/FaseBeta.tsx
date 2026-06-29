"use client";

import type { Dispatch, FormEvent, RefObject, SetStateAction } from "react";
import { useRouter } from "next/navigation";
import { FiCheck, FiLink, FiPlus } from "react-icons/fi";
import type { Decision, FixtureVersion, LinkedPedido } from "../types";
import { cardClass, inputClass, btnPrimary } from "../styles";
import { buildFixtureOrderUrl } from "../helpers";
import FilePicker from "../components/FilePicker";
import VersionList from "../components/VersionList";
import ApprovalRow from "../components/ApprovalRow";

function PedidosAsociados({
  pedidos,
}: {
  pedidos: LinkedPedido[];
}) {
  const router = useRouter();
  const total = pedidos.reduce((sum, p) => sum + Number(p.subtotal || 0), 0);

  if (pedidos.length === 0) return null;

  return (
    <div className="mt-5 rounded-2xl border border-white/10 bg-black/20 p-4">
      <p className="font-semibold text-white/90">Pedidos asociados</p>

      <ul className="mt-3 space-y-2">
        {pedidos.map((p) => (
          <li key={p.id}>
            <button
              onClick={() => router.push(`/solicitudes/listado/${p.id}`)}
              className="inline-flex items-center gap-2 text-sm text-emerald-200 underline decoration-white/20 hover:text-emerald-100"
            >
              <FiLink /> {p.titulo || p.id}{" "}
              {p.subtotal ? `(MXN ${Number(p.subtotal).toFixed(2)})` : ""}
            </button>
          </li>
        ))}
      </ul>

      <p className="mt-3 text-sm font-semibold text-white/85">
        Total fase beta: MXN {total.toFixed(2)}
      </p>
    </div>
  );
}

export default function FaseBeta({
  betas,
  linkedPedidos,
  pedidoId,
  pedidoProyecto,
  isAdmin,
  loading,
  nextBetaLabel,
  betaDesc,
  setBetaDesc,
  betaFiles,
  setBetaFiles,
  betaInputRef,
  userEmail,
  canApprovePM,
  canApproveProcessOwner,
  addFiles,
  removeFile,
  onGuardarBeta,
  onDecidirBeta,
}: {
  betas: FixtureVersion[];
  linkedPedidos: LinkedPedido[];
  pedidoId: string;
  pedidoProyecto: string;
  isAdmin: boolean;
  loading: boolean;
  nextBetaLabel: string;
  betaDesc: string;
  setBetaDesc: Dispatch<SetStateAction<string>>;
  betaFiles: File[];
  setBetaFiles: Dispatch<SetStateAction<File[]>>;
  betaInputRef: RefObject<HTMLInputElement | null>;
  userEmail?: string;
  canApprovePM: boolean;
  canApproveProcessOwner: boolean;
  addFiles: (
    list: FileList | null,
    setter: Dispatch<SetStateAction<File[]>>,
    inputRef: RefObject<HTMLInputElement | null>
  ) => void;
  removeFile: (
    index: number,
    setter: Dispatch<SetStateAction<File[]>>
  ) => void;
  onGuardarBeta: (e: FormEvent) => void;
  onDecidirBeta: (
    beta: FixtureVersion,
    rol: "pm" | "encargado",
    decision: Decision,
    reason?: string
  ) => void;
}) {
  const router = useRouter();

  const pedidosBeta = linkedPedidos.filter(
    (p) => p.fixtureRelacionadoFase === "beta"
  );

  return (
    <section className={cardClass}>
      <h2 className="text-xl font-semibold">Fase Beta</h2>
      <p className="mt-1 text-sm text-white/55">
        Los diseñadores proponen materiales, presupuesto, ajustes y versión robusta para repetibilidad.
      </p>

      <div className="mt-5 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() =>
            router.push(
              buildFixtureOrderUrl({
                proyecto: pedidoProyecto,
                fixtureId: pedidoId,
                fixtureFase: "beta",
                fixtureVersion: nextBetaLabel,
              })
            )
          }
          className={btnPrimary}
        >
          <FiPlus /> Realizar pedido
        </button>
      </div>

      <PedidosAsociados pedidos={pedidosBeta} />

      {isAdmin && (
        <form onSubmit={onGuardarBeta} className="mt-5 space-y-4">
          <div className="rounded-2xl border border-emerald-300/20 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-100">
            Nueva propuesta: <strong>{nextBetaLabel}</strong>
          </div>

          <textarea
            className={`${inputClass} min-h-[110px]`}
            value={betaDesc}
            onChange={(e) => setBetaDesc(e.target.value)}
            placeholder="Materiales, presupuesto, ajustes, decisiones críticas, etc..."
          />

          <FilePicker
            label="Adjuntar archivos de beta"
            files={betaFiles}
            inputRef={betaInputRef}
            onChange={(list) => addFiles(list, setBetaFiles, betaInputRef)}
            onRemove={(i) => removeFile(i, setBetaFiles)}
          />

          <button disabled={loading} className={btnPrimary}>
            <FiCheck /> Guardar beta
          </button>
        </form>
      )}

      <VersionList
        title="Betas registradas"
        items={betas}
        renderActions={(item) => (
          <div className="grid gap-3">
            <ApprovalRow
              label="PM"
              approvalKey="pm"
              firma={item.firmas?.pm}
              currentUserEmail={userEmail}
              canApprove={canApprovePM}
              onDecision={(decision, reason) =>
                onDecidirBeta(item, "pm", decision, reason)
              }
            />

            <ApprovalRow
              label="Encargado del proceso"
              approvalKey="encargado"
              firma={item.firmas?.encargado}
              currentUserEmail={userEmail}
              canApprove={canApproveProcessOwner}
              onDecision={(decision, reason) =>
                onDecidirBeta(item, "encargado", decision, reason)
              }
            />
          </div>
        )}
      />
    </section>
  );
}