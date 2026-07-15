"use client";

import { cardClass, cardPad } from "../styles";
import { formatMoney } from "../utils";

type QuoteVersion = {
  id: string;
  url: string;
  total: number;
  createdAt?: any;
};

type Props = {
  versions: QuoteVersion[];
};

export default function QuoteVersionsCard({ versions }: Props) {
  return (
    <div className={`mt-6 ${cardClass} ${cardPad}`}>
      <div>
        <h2 className="text-lg font-semibold text-white/90">
          Versiones generadas
        </h2>
        <p className="mt-1 text-sm text-white/60">
          Historial de PDFs generados.
        </p>
      </div>

      <div className="mt-4">
        {versions.length === 0 ? (
          <p className="text-sm text-white/60">Aún no hay versiones.</p>
        ) : (
          <ul className="space-y-3">
            {versions.map((v) => {
              const fecha =
                v.createdAt?.toDate?.() instanceof Date
                  ? v.createdAt.toDate()
                  : null;

              return (
                <li
                  key={v.id}
                  className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 rounded-2xl border border-white/10 bg-white/[0.04] p-4"
                >
                  <div>
                    <div className="font-semibold text-white/90">{v.id}</div>
                    <div className="text-xs text-white/55 mt-1">
                      {fecha ? fecha.toLocaleString() : "—"} · Total:{" "}
                      <span className="text-white/80 font-semibold">
                        {formatMoney(v.total || 0)}
                      </span>
                    </div>
                  </div>

                  <a
                    className="inline-flex items-center justify-center rounded-xl border border-white/12 bg-white/5 px-4 py-2 text-sm text-white/85 hover:bg-white/10 transition"
                    href={v.url}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Ver PDF
                  </a>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}