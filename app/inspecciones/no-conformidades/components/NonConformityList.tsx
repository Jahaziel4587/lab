"use client";

import {
  useMemo,
  useState,
} from "react";

import {
  CheckCircle2,
  ChevronRight,
  CircleDashed,
  FolderPlus,
  Search,
  X,
} from "lucide-react";

import type {
  NonConformityLot,
} from "../types";

type NonConformityListProps = {
  lots: NonConformityLot[];
  loading?: boolean;
  error?: string | null;

  onSelect: (
    lot: NonConformityLot,
  ) => void;

  onAdd: () => void;
};

function formatDate(
  value: unknown,
) {
  if (
    value &&
    typeof value === "object" &&
    "toDate" in value &&
    typeof (
      value as {
        toDate?: unknown;
      }
    ).toDate === "function"
  ) {
    return (
      value as {
        toDate: () => Date;
      }
    )
      .toDate()
      .toLocaleString(
        "es-MX",
        {
          day: "2-digit",
          month: "short",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        },
      );
  }

  return "";
}

function normalizeSearch(
  value: string,
) {
  return value
    .normalize("NFD")
    .replace(
      /[\u0300-\u036f]/g,
      "",
    )
    .toLocaleLowerCase(
      "es-MX",
    )
    .trim();
}

export default function NonConformityList({
  lots,
  loading = false,
  error = null,
  onSelect,
  onAdd,
}: NonConformityListProps) {
  const [search, setSearch] =
    useState("");

  const filteredLots =
    useMemo(() => {
      const term =
        normalizeSearch(search);

      if (!term) {
        return lots;
      }

      return lots.filter(
        (lot) =>
          normalizeSearch(
            lot.lotName,
          ).includes(term),
      );
    }, [
      lots,
      search,
    ]);

  if (loading) {
    return (
      <div
        className="rounded-2xl
          border border-white/10
          bg-black/15 p-6
          text-center text-sm
          text-white/55"
      >
        Cargando lotes...
      </div>
    );
  }

  if (error) {
    return (
      <div
        className="rounded-2xl
          border border-red-400/20
          bg-red-400/[0.06]
          p-5 text-sm
          text-red-100/80"
      >
        {error}
      </div>
    );
  }

  return (
    <div>
      <div
        className="flex flex-col
          gap-4 sm:flex-row
          sm:items-center
          sm:justify-between"
      >
        <div>
          <h2
            className="text-lg
              font-semibold text-white"
          >
            Lotes inspeccionados
          </h2>

          <p
            className="mt-1 text-sm
              text-white/50"
          >
            Abre un lote para registrar
            o consultar sus muestras
            rechazadas.
          </p>
        </div>

        <button
          type="button"
          onClick={onAdd}
          className="inline-flex
            min-h-11 w-full
            items-center justify-center
            gap-2 rounded-xl
            border
            border-emerald-400/30
            bg-emerald-400/10
            px-5 text-sm font-medium
            text-emerald-200
            transition
            hover:bg-emerald-400/15
            sm:w-auto"
        >
          <FolderPlus size={17} />
          Agregar lote
        </button>
      </div>

      {lots.length > 0 && (
        <div className="relative mt-5">
          <Search
            size={18}
            className="pointer-events-none
              absolute left-4 top-1/2
              -translate-y-1/2
              text-white/35"
          />

          <input
            value={search}
            onChange={(event) =>
              setSearch(
                event.target.value,
              )
            }
            placeholder="Buscar lote..."
            className="min-h-12 w-full
              rounded-xl border
              border-white/15
              bg-black/20
              pl-11 pr-12
              text-sm text-white
              outline-none transition
              placeholder:text-white/30
              focus:border-emerald-400/40
              focus:ring-2
              focus:ring-emerald-400/10"
          />

          {search && (
            <button
              type="button"
              aria-label="Limpiar búsqueda"
              onClick={() =>
                setSearch("")
              }
              className="absolute right-2
                top-1/2 flex h-9 w-9
                -translate-y-1/2
                items-center justify-center
                rounded-lg text-white/40
                transition
                hover:bg-white/[0.07]
                hover:text-white"
            >
              <X size={17} />
            </button>
          )}
        </div>
      )}

      {lots.length === 0 ? (
        <div
          className="mt-5 rounded-2xl
            border border-dashed
            border-white/15
            bg-black/15 p-8
            text-center"
        >
          <p
            className="font-medium
              text-white/75"
          >
            No hay lotes registrados
          </p>

          <p
            className="mt-2 text-sm
              leading-relaxed
              text-white/45"
          >
            Agrega el primer lote para
            comenzar a registrar las
            muestras que no cumplan con
            la especificación.
          </p>
        </div>
      ) : filteredLots.length === 0 ? (
        <div
          className="mt-5 rounded-2xl
            border border-dashed
            border-white/15
            bg-black/15 p-7
            text-center"
        >
          <p
            className="text-sm
              text-white/55"
          >
            No se encontraron lotes
            con ese nombre.
          </p>
        </div>
      ) : (
        <div
          className="mt-5
            space-y-3"
        >
          {filteredLots.map(
            (lot) => {
              const isFinalized =
                lot.status ===
                "finalized";

              const rejectedCount =
                isFinalized
                  ? lot
                      .rejectedSampleCount ??
                    lot.reportCount ??
                    0
                  : lot.reportCount ??
                    0;

              return (
                <button
                  key={lot.id}
                  type="button"
                  onClick={() =>
                    onSelect(lot)
                  }
                  className="group flex
                    min-h-20 w-full
                    items-center gap-4
                    rounded-2xl border
                    border-white/10
                    bg-white/[0.035]
                    p-4 text-left
                    transition
                    hover:border-emerald-400/25
                    hover:bg-emerald-400/[0.05]
                    sm:p-5"
                >
                  <div
                    className={
                      "flex h-11 w-11 " +
                      "shrink-0 items-center " +
                      "justify-center " +
                      "rounded-2xl border " +
                      (
                        isFinalized
                          ? "border-emerald-400/25 bg-emerald-400/10 text-emerald-300"
                          : "border-amber-400/25 bg-amber-400/10 text-amber-200"
                      )
                    }
                  >
                    {isFinalized ? (
                      <CheckCircle2
                        size={21}
                      />
                    ) : (
                      <CircleDashed
                        size={21}
                      />
                    )}
                  </div>

                  <div
                    className="min-w-0
                      flex-1"
                  >
                    <div
                      className="flex
                        flex-col gap-2
                        sm:flex-row
                        sm:items-center"
                    >
                      <p
                        className="break-words
                          font-semibold
                          text-white"
                      >
                        {lot.lotName}
                      </p>

                      <span
                        className={
                          "w-fit rounded-full " +
                          "border px-2.5 py-1 " +
                          "text-[11px] " +
                          "font-semibold " +
                          "uppercase " +
                          "tracking-wide " +
                          (
                            isFinalized
                              ? "border-emerald-400/25 bg-emerald-400/10 text-emerald-200"
                              : "border-amber-400/25 bg-amber-400/10 text-amber-100"
                          )
                        }
                      >
                        {isFinalized
                          ? "Finalizado"
                          : "En registro"}
                      </span>
                    </div>

                    <p
                      className="mt-2
                        text-sm
                        text-white/55"
                    >
                      {lot.sampleQuantity}
                      {" "}
                      piezas inspeccionadas
                      {" · "}
                      {lot.lotQuantity}
                      {" piezas totales · "}
                      {rejectedCount}
                      {" "}
                      {rejectedCount === 1
                        ? "muestra rechazada"
                        : "muestras rechazadas"}
                    </p>

                    <p className="mt-1 text-xs text-white/40">
                      Inspección {lot.inspectionType === "special" ? "especial" : "normal"}
                      {" · Nivel "}{lot.inspectionLevel || "no registrado"}
                      {" · AQL "}{lot.aql || "no registrado"}
                    </p>

                    {formatDate(
                      lot.createdAt,
                    ) && (
                      <p
                        className="mt-1
                          text-xs
                          text-white/35"
                      >
                        Creado el{" "}
                        {formatDate(
                          lot.createdAt,
                        )}
                      </p>
                    )}
                  </div>

                  <ChevronRight
                    size={19}
                    className="shrink-0
                      text-white/30
                      transition
                      group-hover:translate-x-0.5
                      group-hover:text-emerald-300"
                  />
                </button>
              );
            },
          )}
        </div>
      )}
    </div>
  );
}
