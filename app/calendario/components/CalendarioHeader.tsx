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
    <div className="relative px-6 py-5 border-b border-white/10 flex items-center justify-between overflow-hidden">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-emerald-500/10 to-transparent" />

      <button
        type="button"
        onClick={onPrevMonth}
        className="relative h-10 w-10 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 text-white flex items-center justify-center"
        aria-label="Mes anterior"
        title="Mes anterior"
      >
        ◀
      </button>

      <div className="relative text-center">
        <h1 className="text-lg md:text-xl font-semibold text-white">
          Calendario de pedidos
        </h1>

        <p className="text-sm text-white/70 capitalize">{mes}</p>
      </div>

      <button
        type="button"
        onClick={onNextMonth}
        className="relative h-10 w-10 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 text-white flex items-center justify-center"
        aria-label="Mes siguiente"
        title="Mes siguiente"
      >
        ▶
      </button>
    </div>
  );
}