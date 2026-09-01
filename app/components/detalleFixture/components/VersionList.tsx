import type { ReactNode } from "react";
import type { FixtureVersion } from "../types";
import { formatFirebaseDate } from "../helpers";

export default function VersionList({
  title,
  items,
  renderActions,
}: {
  title: string;
  items: FixtureVersion[];
  renderActions?: (item: FixtureVersion) => ReactNode;
}) {
  if (items.length === 0) {
    return (
      <div className="mt-5 rounded-2xl border border-white/10 bg-black/20 p-3.5 sm:p-4 text-sm text-white/55">
        Aún no hay registros en esta sección.
      </div>
    );
  }

  return (
    <div className="mt-6">
      <h3 className="text-base font-semibold text-white/90">{title}</h3>

      <div className="mt-3 space-y-3">
        {items.map((item) => {
          const fecha = formatFirebaseDate(item.createdAt);

          return (
            <div
              key={item.id}
              className="rounded-2xl border border-white/10 bg-black/20 p-3.5 sm:p-4"
            >
              <div className="flex flex-col gap-2 min-[390px]:flex-row min-[390px]:items-start min-[390px]:justify-between min-[390px]:gap-3">
                <div className="min-w-0">
                  <p className="break-words font-semibold text-white/90">
                    {item.versionLabel}
                  </p>
                  <p className="mt-1 text-xs text-white/45">{fecha}</p>
                </div>

                <span
                  className={`w-fit shrink-0 rounded-full border px-3 py-1 text-xs font-semibold ${
                    item.status === "aprobado"
                      ? "border-emerald-300/30 bg-emerald-400/10 text-emerald-100"
                      : item.status === "rechazado"
                      ? "border-red-300/30 bg-red-400/10 text-red-100"
                      : "border-yellow-300/30 bg-yellow-400/10 text-yellow-100"
                  }`}
                >
                  {item.status || "pendiente"}
                </span>
              </div>

              {item.descripcion && (
                <p className="mt-3 break-words whitespace-pre-wrap text-sm leading-relaxed text-white/75">
                  {item.descripcion}
                </p>
              )}

              {item.especificacionesExtra &&
                item.especificacionesExtra.length > 0 && (
                  <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-white/70">
                    {item.especificacionesExtra.map((s, i) => (
                      <li key={i} className="break-words">{s}</li>
                    ))}
                  </ul>
                )}

              {item.archivos && item.archivos.length > 0 && (
                <div className="mt-3 space-y-2">
                  {item.archivos.map((file) => (
                    <a
                      key={file.url}
                      href={file.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block min-w-0 truncate rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-emerald-200 underline decoration-white/20 transition hover:bg-white/[0.06] hover:text-emerald-100"
                      title={file.name}
                    >
                      {file.name}
                    </a>
                  ))}
                </div>
              )}

              {renderActions && (
                <div className="mt-4 border-t border-white/10 pt-4">
                  {renderActions(item)}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}