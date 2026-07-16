"use client";

import { getPageItems } from "../../../utils";

type ProyectoPaginationProps = {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
};

export default function ProyectoPagination({
  page,
  totalPages,
  onPageChange,
}: ProyectoPaginationProps) {
  if (totalPages <= 1) return null;

  const items = getPageItems(page, totalPages);

  return (
    <div className="mt-4 flex flex-wrap items-center justify-center gap-2 text-sm">
      <button
        type="button"
        onClick={() => onPageChange(Math.max(1, page - 1))}
        disabled={page === 1}
        className={`rounded-xl border px-3 py-2 transition ${
          page === 1
            ? "border-white/10 bg-white/5 text-white/30 cursor-not-allowed"
            : "border-white/15 bg-white/5 text-white/80 hover:bg-white/10"
        }`}
      >
        Anterior
      </button>

      {items.map((item, index) =>
        item === "..." ? (
          <span
            key={`dots-${index}`}
            className="px-2 text-white/40"
          >
            …
          </span>
        ) : (
          <button
            key={item}
            type="button"
            onClick={() => onPageChange(item)}
            className={`min-w-[40px] rounded-xl border px-3 py-2 transition ${
              item === page
                ? "border-emerald-400/30 bg-emerald-500/15 text-emerald-100 shadow-[0_12px_30px_-22px_rgba(16,185,129,0.9)]"
                : "border-white/15 bg-white/5 text-white/80 hover:bg-white/10"
            }`}
          >
            {item}
          </button>
        )
      )}

      <button
        type="button"
        onClick={() =>
          onPageChange(Math.min(totalPages, page + 1))
        }
        disabled={page === totalPages}
        className={`rounded-xl border px-3 py-2 transition ${
          page === totalPages
            ? "border-white/10 bg-white/5 text-white/30 cursor-not-allowed"
            : "border-white/15 bg-white/5 text-white/80 hover:bg-white/10"
        }`}
      >
        Siguiente
      </button>
    </div>
  );
}