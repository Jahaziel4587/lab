"use client";

import {
  cardClass,
  cardPad,
  label,
  value,
  statusPillClass,
  statusLabel,
  btnSoft,
} from "../styles";

type FileItem = {
  name: string;
  url: string;
};

type Props = {
  pedido: any;
  files: FileItem[];
  filesLoading: boolean;
  isAdmin: boolean;
  onCotizar: () => void;
};

export default function PedidoResumenCard({
  pedido,
  files,
  filesLoading,
  isAdmin,
  onCotizar,
}: Props) {
  return (
    <div className={`${cardClass} ${cardPad} lg:col-span-2 min-w-0`}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
        <div className="min-w-0">
          <h2 className="text-lg font-semibold text-white/90">Resumen</h2>
          <p className="mt-1 text-sm text-white/60">
            Información general del pedido.
          </p>
        </div>

        <div className="self-start">
          <span className={statusPillClass(pedido.status || "enviado")}>
            {statusLabel(pedido.status || "enviado")}
          </span>
        </div>
      </div>

      <div className="mt-5 space-y-4 text-sm">
        <div className="rounded-xl border border-white/10 bg-black/15 p-3">
          <div className={label}>Título</div>
          <div className={`${value} mt-1 font-medium break-words`}>
            {pedido.titulo || "Sin título"}
          </div>
        </div>

        <div className="grid grid-cols-1 min-[430px]:grid-cols-2 gap-3">
          {[
            ["Proyecto", pedido.proyecto || "—"],
            ["Servicio", pedido.servicio || "—"],
            ["Máquina", pedido.maquina || "—"],
            ["Material", pedido.material || "—"],
          ].map(([fieldLabel, fieldValue]) => (
            <div
              key={fieldLabel}
              className="rounded-xl border border-white/10 bg-white/[0.025] p-3 min-w-0"
            >
              <div className={label}>{fieldLabel}</div>
              <div className={`${value} mt-1 break-words`}>{fieldValue}</div>
            </div>
          ))}
        </div>

        <div className="rounded-xl border border-white/10 bg-white/[0.025] p-3">
          <div className={label}>Descripción</div>
          <div className={`${value} mt-1 whitespace-pre-wrap leading-relaxed break-words`}>
            {pedido.descripcion || "—"}
          </div>
        </div>

        <div className="grid grid-cols-1 min-[430px]:grid-cols-2 gap-3">
          <div className="rounded-xl border border-white/10 bg-white/[0.025] p-3">
            <div className={label}>Entrega propuesta</div>
            <div className={`${value} mt-1`}>{pedido.fechaLimite || "—"}</div>
          </div>

          <div className="rounded-xl border border-white/10 bg-white/[0.025] p-3">
            <div className={label}>Entrega real</div>
            <div className={`${value} mt-1`}>
              {pedido.fechaEntregaReal || "Pendiente"}
            </div>
          </div>
        </div>
      </div>

      <div className="mt-5 border-t border-white/10 pt-5">
        <div>
          <div className="text-sm font-semibold text-white/90">
            Archivos adjuntos
          </div>
          <div className="mt-1 text-xs text-white/50">
            Archivos del pedido.
          </div>
        </div>

        <div className="mt-3">
          {filesLoading ? (
            <div className="text-sm text-white/60">Cargando…</div>
          ) : files.length === 0 ? (
            <div className="rounded-xl border border-dashed border-white/10 px-3 py-4 text-sm text-white/60 italic">
              No hay archivos adjuntos.
            </div>
          ) : (
            <ul className="space-y-2">
              {files.map((f) => (
                <li key={f.url}>
                  <a
                    href={f.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex min-h-11 items-center rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5 text-sm text-emerald-200 hover:bg-white/[0.07] hover:text-emerald-100 transition break-all"
                  >
                    {f.name}
                  </a>
                </li>
              ))}
            </ul>
          )}
        </div>

        {isAdmin && (
          <div className="mt-5">
            <button onClick={onCotizar} className={btnSoft}>
              Cotizar servicio
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
