"use client";

import {
  useMemo,
  useState,
} from "react";
import {
  ArrowRight,
  FolderOpen,
  Search,
  X,
} from "lucide-react";

export type CatalogListItem = {
  id: string;
  title: string;
  description?: string;
};

type CatalogListProps = {
  items: CatalogListItem[];
  emptyMessage: string;
  searchPlaceholder?: string;
  onSelect: (
    item: CatalogListItem,
  ) => void;
};

function normalizeSearch(
  value: string,
) {
  return value
    .normalize("NFD")
    .replace(
      /[\u0300-\u036f]/g,
      "",
    )
    .toLocaleLowerCase("es-MX")
    .trim();
}

export default function CatalogList({
  items,
  emptyMessage,
  searchPlaceholder,
  onSelect,
}: CatalogListProps) {
  const [search, setSearch] =
    useState("");

  const filteredItems =
    useMemo(() => {
      const normalizedSearch =
        normalizeSearch(search);

      if (!normalizedSearch) {
        return items;
      }

      return items.filter(
        (item) =>
          normalizeSearch(
            `${item.title} ${item.description || ""}`,
          ).includes(
            normalizedSearch,
          ),
      );
    }, [
      items,
      search,
    ]);

  if (items.length === 0) {
    return (
      <div
        className="rounded-2xl border border-dashed
          border-white/15 bg-black/15 p-7 text-center"
      >
        <FolderOpen
          size={28}
          className="mx-auto text-white/40"
        />

        <p className="mt-3 text-sm text-white/55">
          {emptyMessage}
        </p>
      </div>
    );
  }

  return (
    <div>
      {searchPlaceholder && (
        <label className="relative mb-4 block">
          <span className="sr-only">
            {searchPlaceholder}
          </span>

          <Search
            size={18}
            className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-white/35"
          />

          <input
            type="search"
            value={search}
            onChange={(event) =>
              setSearch(
                event.target.value,
              )
            }
            placeholder={
              searchPlaceholder
            }
            className="min-h-12 w-full rounded-2xl border border-white/12 bg-black/20 pl-11 pr-11 text-base text-white outline-none placeholder:text-white/35 focus:border-emerald-400/40 sm:text-sm"
          />

          {search && (
            <button
              type="button"
              onClick={() =>
                setSearch("")
              }
              aria-label="Limpiar búsqueda"
              className="absolute right-2 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-xl text-white/45 hover:bg-white/[0.06] hover:text-white"
            >
              <X size={17} />
            </button>
          )}
        </label>
      )}

      {filteredItems.length ===
      0 ? (
        <div className="rounded-2xl border border-dashed border-white/15 bg-black/15 p-7 text-center">
          <Search
            size={26}
            className="mx-auto text-white/35"
          />

          <p className="mt-3 text-sm text-white/55">
            No se encontraron resultados
            para “{search}”.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredItems.map(
            (item) => (
              <button
                key={item.id}
                type="button"
                onClick={() =>
                  onSelect(item)
                }
                className="group flex min-h-16 w-full items-center
                  justify-between gap-4 rounded-2xl border
                  border-white/10 bg-white/[0.04] px-4 py-4
                  text-left transition hover:border-emerald-400/30
                  hover:bg-white/[0.07] sm:px-5"
              >
                <div className="min-w-0">
                  <p className="break-words font-medium text-white/90">
                    {item.title}
                  </p>

                  {item.description && (
                    <p className="mt-1 break-words text-xs text-white/50">
                      {
                        item.description
                      }
                    </p>
                  )}
                </div>

                <ArrowRight
                  size={18}
                  className="shrink-0 text-white/35 transition
                    group-hover:translate-x-1 group-hover:text-emerald-300"
                />
              </button>
            ),
          )}
        </div>
      )}
    </div>
  );
}
