"use client";

import Link from "next/link";
import type { ProyectoStats } from "../types";

type ProyectoCardProps = {
  proyecto: string;
  stats: ProyectoStats;
};

export default function ProyectoCard({
  proyecto,
  stats,
}: ProyectoCardProps) {
  const porcentaje =
    stats.total > 0
      ? Math.round((stats.listos / stats.total) * 100)
      : 0;

  const diasDesdeActividad =
    stats.ultima > 0
      ? Math.max(
          0,
          Math.round(
            (Date.now() - stats.ultima) /
              (1000 * 60 * 60 * 24)
          )
        )
      : null;

  const actividadLabel =
    diasDesdeActividad === null
      ? "—"
      : diasDesdeActividad === 0
        ? "Hoy"
        : `Hace ${diasDesdeActividad} días`;

  return (
    <Link
      href={`/calendario/proyectos/${encodeURIComponent(proyecto)}`}
      className="group rounded-2xl border border-white/10 bg-white/5 hover:bg-white/10 transition overflow-hidden"
    >
      <div className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-xl font-semibold text-white truncate">
              {proyecto}
            </div>

            <div className="text-sm text-white/60">
              Última actividad: {actividadLabel}
            </div>
          </div>

          <div className="h-12 w-12 shrink-0 rounded-2xl border border-white/10 bg-white/5 flex items-center justify-center text-white/80 group-hover:text-white">
            →
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <div className="px-3 py-1 rounded-full border border-white/10 bg-white/5 text-white/80 text-sm">
            Pedidos:{" "}
            <span className="text-white font-semibold">
              {stats.total}
            </span>
          </div>

          <div className="px-3 py-1 rounded-full border border-white/10 bg-white/5 text-white/80 text-sm">
            Listos:{" "}
            <span className="text-white font-semibold">
              {stats.listos}
            </span>
          </div>
        </div>

        <div className="mt-4 flex items-center gap-3">
          <div className="flex-1 flex gap-2">
            {Array.from({ length: 9 }).map((_, index) => {
              const filled =
                index < Math.round((porcentaje / 100) * 9);

              return (
                <span
                  key={index}
                  className={[
                    "h-2 w-5 rounded-full border",
                    filled
                      ? "bg-emerald-400/90 border-emerald-400/40"
                      : "bg-white/5 border-white/10",
                  ].join(" ")}
                />
              );
            })}
          </div>

          <div className="text-sm text-white/70 w-10 text-right">
            {porcentaje}%
          </div>
        </div>

        <div className="mt-4 flex items-center justify-between text-sm text-white/60">
          <span>Solicitudes terminadas</span>
          <span className="text-white/80">Ver proyecto</span>
        </div>
      </div>
    </Link>
  );
}