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
    <div className={`${cardClass} ${cardPad} lg:col-span-2`}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-white/90">Resumen</h2>
          <p className="mt-1 text-sm text-white/60">
            Información general del pedido.
          </p>
        </div>

        <span className={statusPillClass(pedido.status || "enviado")}>
          {statusLabel(pedido.status || "enviado")}
        </span>
      </div>

      <div className="mt-5 space-y-3 text-sm">
        <div>
          <div className={label}>Título</div>
          <div className={`${value} font-medium break-words`}>
            {pedido.titulo || "Sin título"}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <div className={label}>Proyecto</div>
            <div className={`${value} break-words`}>
              {pedido.proyecto || "—"}
            </div>
          </div>

          <div>
            <div className={label}>Servicio</div>
            <div className={value}>{pedido.servicio || "—"}</div>
          </div>

          <div>
            <div className={label}>Máquina</div>
            <div className={value}>{pedido.maquina || "—"}</div>
          </div>

          <div>
            <div className={label}>Material</div>
            <div className={value}>{pedido.material || "—"}</div>
          </div>
        </div>

        <div>
          <div className={label}>Descripción</div>
          <div className={`${value} whitespace-pre-wrap leading-relaxed`}>
            {pedido.descripcion || "—"}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <div className={label}>Entrega propuesta</div>
            <div className={value}>{pedido.fechaLimite || "—"}</div>
          </div>

          <div>
            <div className={label}>Entrega real</div>
            <div className={value}>
              {pedido.fechaEntregaReal || "Pendiente"}
            </div>
          </div>
        </div>
      </div>

      <div className="mt-5 border-t border-white/10 pt-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-sm font-semibold text-white/90">
              Archivos adjuntos
            </div>
            <div className="text-xs text-white/50">
              Archivos del pedido (Storage).
            </div>
          </div>
        </div>

        <div className="mt-3">
          {filesLoading ? (
            <div className="text-sm text-white/60">Cargando…</div>
          ) : files.length === 0 ? (
            <div className="text-sm text-white/60 italic">
              No hay archivos adjuntos.
            </div>
          ) : (
            <ul className="space-y-2">
              {files.map((f) => (
                <li
                  key={f.url}
                  className="flex items-center justify-between gap-3"
                >
                  <a
                    href={f.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-emerald-200 hover:text-emerald-100 underline decoration-white/20 text-sm break-all"
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