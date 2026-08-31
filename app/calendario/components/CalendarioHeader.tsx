"use client";

type CalendarioHeaderProps = {
  mes: string;
  onPrevMonth: () => void;
  onNextMonth: () => void;
};

export default function CalendarioHeader({
  mes,
  onPrevMonth,
  onNextMonth,
}: CalendarioHeaderProps) {
  return (
    <div
      className="relative flex items-center justify-between
        overflow-hidden border-b border-white/10
        px-3 py-4 sm:px-6 sm:py-5"
    >
      <div
        className="pointer-events-none absolute inset-x-0
          top-0 h-24 bg-gradient-to-b
          from-emerald-500/10 to-transparent"
      />

      <button
        type="button"
        onClick={onPrevMonth}
        className="relative flex h-11 w-11 shrink-0
          items-center justify-center rounded-xl
          border border-white/10 bg-white/5
          text-white transition hover:bg-white/10"
        aria-label="Mes anterior"
        title="Mes anterior"
      >
        <span aria-hidden="true">‹</span>
      </button>

      <div className="relative min-w-0 px-2 text-center">
        <h1
          className="truncate text-base font-semibold
            text-white sm:text-xl"
        >
          Calendario de pedidos
        </h1>

        <p
          className="mt-0.5 text-xs capitalize
            text-white/70 sm:text-sm"
        >
          {mes}
        </p>
      </div>

      <button
        type="button"
        onClick={onNextMonth}
        className="relative flex h-11 w-11 shrink-0
          items-center justify-center rounded-xl
          border border-white/10 bg-white/5
          text-white transition hover:bg-white/10"
        aria-label="Mes siguiente"
        title="Mes siguiente"
      >
        <span aria-hidden="true">›</span>
      </button>
    </div>
  );
}