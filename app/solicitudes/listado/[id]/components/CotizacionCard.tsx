"use client";

import { btnPrimary, btnSoft, cardClass, cardPad } from "../styles";
import { formatMoney } from "../utils";
import { QuoteDraft, QuoteLine, QuoteMeta } from "../types";

type Props = {
  pedido: any;
  quoteMeta: QuoteMeta | null;
  quoteLines: Array<{ id: string; data: QuoteLine }>;
  loadingQuote: boolean;
  draft: QuoteDraft;
  isGen: boolean;
  setIsGen: React.Dispatch<React.SetStateAction<boolean>>;
  cargarCotizacionViva: () => Promise<void>;
  handleGenerarPDF: () => Promise<boolean>;
  buildDetailsForLine: (d: QuoteLine) => string[];
  subtotalBaseMXN: number;
  gananciaMonto: number;
  subtotalConGananciaMXN: number;
  ivaMonto: number;
  totalFinal: number;
};

export default function CotizacionCard({
  pedido,
  quoteMeta,
  quoteLines,
  loadingQuote,
  draft,
  isGen,
  setIsGen,
  cargarCotizacionViva,
  handleGenerarPDF,
  buildDetailsForLine,
  subtotalBaseMXN,
  gananciaMonto,
  subtotalConGananciaMXN,
  ivaMonto,
  totalFinal,
}: Props) {
  return (
    <div id="cotizacion-viva" className={`mt-6 ${cardClass} ${cardPad}`}>
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-white/90">Cotización</h2>
          <p className="mt-1 text-sm text-white/60">
            Cotización viva del pedido.
          </p>
        </div>

        <button
          onClick={cargarCotizacionViva}
          className={btnSoft}
          title="Actualizar"
        >
          Refrescar
        </button>
      </div>

      <div className="mt-4">
        {loadingQuote ? (
          <p className="text-sm text-white/60">Cargando cotización…</p>
        ) : quoteLines.length === 0 ? (
          <p className="text-sm text-white/60">
            No se han adjuntado servicios a esta cotización.
          </p>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm text-white/70">
              <div>
                <span className="font-medium text-white/80">Moneda base:</span>{" "}
                MXN
              </div>

              <div>
                <span className="font-medium text-white/80">
                  Tasa USD→MXN:
                </span>{" "}
                {quoteMeta?.exchangeRate ?? 17}
              </div>

              <div>
                <span className="font-medium text-white/80">
                  IVA (default):
                </span>{" "}
                16.00%
              </div>
            </div>

            <div className="mt-4 rounded-2xl border border-white/10 bg-black/20 overflow-hidden">
              <div className="w-full overflow-x-auto">
                <table className="min-w-[900px] w-full text-sm">
                  <thead className="bg-white/[0.04] text-white/70">
                    <tr>
                      <th className="text-left px-4 py-3 font-semibold">
                        Servicio
                      </th>
                      <th className="text-left px-4 py-3 font-semibold">
                        Título del pedido
                      </th>
                      <th className="text-left px-4 py-3 font-semibold">
                        Total
                      </th>
                      <th className="text-left px-4 py-3 font-semibold">
                        Detalles del servicio
                      </th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-white/10">
                    {quoteLines.map((ln) => {
                      const d = ln.data;
                      const base = d.subtotalMXN ?? 0;
                      const inflado =
                        base * (1 + (Number(draft.gananciaPct) || 0) / 100);
                      const details = buildDetailsForLine(d);

                      return (
                        <tr
                          key={ln.id}
                          className="align-top hover:bg-emerald-500/[0.04] transition"
                        >
                          <td className="px-4 py-3">
                            <div className="font-medium text-white/90">
                              {d.serviceName || d.serviceId || "—"}
                            </div>
                          </td>

                          <td className="px-4 py-3 text-white/80">
                            {pedido.titulo || "Sin título"}
                          </td>

                          <td className="px-4 py-3 text-white/85 whitespace-nowrap">
                            MXN {inflado.toFixed(2)}
                          </td>

                          <td className="px-4 py-3">
                            {details.length === 0 ? (
                              <span className="text-white/50">—</span>
                            ) : (
                              <ul className="list-disc pl-5 space-y-1 text-white/80">
                                {details.map((txt, i) => (
                                  <li key={i}>{txt}</li>
                                ))}
                              </ul>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="mt-5 grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                <div className="text-sm text-white/60">
                  * El PDF mostrará los importes por servicio{" "}
                  <span className="text-white/80 font-semibold">
                    ya con ganancia
                  </span>
                  , sin revelar el %.
                </div>

                <div className="mt-4 flex items-center gap-3">
                  <button
                    onClick={async () => {
                      try {
                        setIsGen(true);
                        const ok = await handleGenerarPDF();
                        if (ok) await cargarCotizacionViva();
                      } finally {
                        setIsGen(false);
                      }
                    }}
                    disabled={isGen}
                    className={btnPrimary}
                  >
                    {isGen ? "Generando…" : "Generar PDF"}
                  </button>
                </div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                <div className="space-y-2 text-sm text-white/80">
                  <div className="flex items-center justify-between">
                    <span className="text-white/70">
                      Subtotal sin ganancia
                    </span>
                    <span className="font-semibold text-white/90">
                      {formatMoney(subtotalBaseMXN)}
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-white/70">Ganancia</span>
                    <span className="font-semibold text-white/90">
                      {formatMoney(gananciaMonto)}
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-white/70">
                      Subtotal con ganancia
                    </span>
                    <span className="font-semibold text-white/90">
                      {formatMoney(subtotalConGananciaMXN)}
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-white/70">IVA (16%)</span>
                    <span className="font-semibold text-white/90">
                      {formatMoney(ivaMonto)}
                    </span>
                  </div>

                  <div className="pt-2 border-t border-white/10 flex items-center justify-between">
                    <span className="text-white/80 font-semibold">TOTAL</span>
                    <span className="text-lg font-bold text-white/95">
                      {formatMoney(totalFinal)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}