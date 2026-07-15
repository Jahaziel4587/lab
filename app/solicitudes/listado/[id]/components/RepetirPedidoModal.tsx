"use client";

import { FiX } from "react-icons/fi";
import {
  cardClass,
  inputClass,
  textareaClass,
  btnSoft,
  btnPrimary,
} from "../styles";

type Props = {
  open: boolean;
  pedido: any;
  nuevaFecha: string;
  setNuevaFecha: (value: string) => void;
  notas: string;
  setNotas: (value: string) => void;
  creando: boolean;
  onClose: () => void;
  onConfirm: () => void;
};

export default function RepetirPedidoModal({
  open,
  pedido,
  nuevaFecha,
  setNuevaFecha,
  notas,
  setNotas,
  creando,
  onClose,
  onConfirm,
}: Props) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm px-4">
      <div className={`${cardClass} w-full max-w-md p-6`}>
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-white/95">
              Repetir pedido
            </h2>

            <p className="mt-1 text-sm text-white/60">
              Se creará una nueva ejecución de este pedido usando la misma
              información técnica y archivos originales.
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={creando}
            className="rounded-full border border-white/10 bg-white/5 p-2 text-white/70 hover:bg-white/10 disabled:opacity-50"
          >
            <FiX />
          </button>
        </div>

        <div className="mt-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-white/80 mb-2">
              Nueva fecha propuesta
            </label>

            <input
              type="date"
              value={nuevaFecha}
              onChange={(e) => setNuevaFecha(e.target.value)}
              className={inputClass}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-white/80 mb-2">
              Notas para esta repetición
            </label>

            <textarea
              rows={3}
              value={notas}
              onChange={(e) => setNotas(e.target.value)}
              className={textareaClass}
              placeholder="Opcional. Ejemplo: repetir exactamente igual, fabricar 2 piezas, cambio menor, etc."
            />
          </div>

          <div className="rounded-xl border border-white/10 bg-white/[0.04] p-3 text-sm text-white/70">
            <div>
              <span className="text-white/50">Pedido base:</span>{" "}
              <span className="text-white/85 font-medium">
                {pedido?.titulo || "Sin título"}
              </span>
            </div>

            <div className="mt-1">
              <span className="text-white/50">Fecha original:</span>{" "}
              <span className="text-white/85">
                {pedido?.fechaLimite || "—"}
              </span>
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={creando}
              className={btnSoft}
            >
              Cancelar
            </button>

            <button
              type="button"
              onClick={onConfirm}
              disabled={creando || !nuevaFecha}
              className={btnPrimary}
            >
              {creando ? "Creando…" : "Confirmar repetición"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}