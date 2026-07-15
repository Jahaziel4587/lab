"use client";

import { cardClass, cardPad, inputClass, textareaClass } from "../styles";
import { QuoteDraft } from "../types";

type Props = {
  draft: QuoteDraft;
  scheduleSave: (next: QuoteDraft) => void;
};

export default function QuoteDraftCard({ draft, scheduleSave }: Props) {
  return (
    <div className={`mt-6 ${cardClass} ${cardPad}`}>
      <div>
        <h2 className="text-lg font-semibold text-white/90">
          Datos de cotización (draft)
        </h2>
        <p className="mt-1 text-sm text-white/60">
          Se guarda automáticamente y alimentará el PDF final.
        </p>
      </div>

      <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-white/80 mb-2">
            Cliente
          </label>
          <input
            className={inputClass}
            value={draft.cliente ?? ""}
            onChange={(e) =>
              scheduleSave({ ...draft, cliente: e.target.value })
            }
            placeholder="Nombre / empresa"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-white/80 mb-2">
            Atención a
          </label>
          <input
            className={inputClass}
            value={draft.atencionA ?? ""}
            onChange={(e) =>
              scheduleSave({ ...draft, atencionA: e.target.value })
            }
            placeholder="Contacto"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-white/80 mb-2">
            Ganancia (%)
          </label>
          <input
            type="number"
            step="10"
            min="0"
            className={inputClass}
            value={draft.gananciaPct}
            onChange={(e) =>
              scheduleSave({
                ...draft,
                gananciaPct: Number(e.target.value),
              })
            }
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-white/80 mb-2">
            Envío (MXN)
          </label>
          <input
            type="number"
            step="10"
            min="0"
            className={inputClass}
            value={draft.envio ?? 0}
            onChange={(e) =>
              scheduleSave({ ...draft, envio: Number(e.target.value) })
            }
          />
        </div>

        <div className="sm:col-span-2">
          <label className="block text-sm font-medium text-white/80 mb-2">
            Notas
          </label>
          <textarea
            className={textareaClass}
            rows={3}
            value={draft.notas ?? ""}
            onChange={(e) => scheduleSave({ ...draft, notas: e.target.value })}
            placeholder="Notas internas que aparecerán en el PDF (opcional)"
          />
        </div>
      </div>
    </div>
  );
}