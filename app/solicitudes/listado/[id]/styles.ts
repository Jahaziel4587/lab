export const cardClass =
  "rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-sm sm:backdrop-blur-xl shadow-none sm:shadow-[0_30px_120px_-90px_rgba(0,0,0,0.95)]";

export const cardPad = "p-4 sm:p-6";

export const muted = "text-white/60";

export const label = "text-xs sm:text-sm text-white/70";

export const value = "text-sm text-white/90";

export const inputClass =
  "w-full min-h-12 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-base sm:text-sm text-white outline-none focus:border-emerald-400 " +
  "[color-scheme:dark]";

export const textareaClass =
  "w-full min-h-24 rounded-xl border border-white/10 bg-black/30 px-3 py-3 text-base sm:text-sm text-white placeholder:text-white/35 " +
  "focus:outline-none focus:ring-2 focus:ring-emerald-400/30 resize-none";

export const pillBase =
  "px-3 py-1.5 rounded-full text-[11px] font-semibold border inline-flex items-center justify-center whitespace-nowrap";

export const statusPillClass = (status: any) => {
  const s = String(status || "").trim().toLowerCase();

  if (s === "en proceso") {
    return `${pillBase} bg-yellow-500/15 text-yellow-200 border-yellow-400/30 shadow-none sm:shadow-[0_10px_28px_-18px_rgba(234,179,8,0.75)]`;
  }

  if (s === "listo") {
    return `${pillBase} bg-emerald-500/15 text-emerald-200 border-emerald-400/30 shadow-none sm:shadow-[0_10px_28px_-18px_rgba(45,212,191,0.75)]`;
  }

  if (s === "cancelado") {
    return `${pillBase} bg-red-500/15 text-red-200 border-red-400/30 shadow-none sm:shadow-[0_10px_28px_-18px_rgba(239,68,68,0.7)]`;
  }

  return `${pillBase} bg-white/5 text-white/80 border-white/15`;
};

export const statusLabel = (s: any) => {
  const v = String(s || "enviado");
  return v.replace(/\b\w/g, (c) => c.toUpperCase());
};

export const btnGhost =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl sm:rounded-full border border-white/15 bg-white/5 px-4 py-2.5 text-sm text-white/90 hover:bg-white/10 active:bg-white/15 transition";

export const btnSoft =
  "inline-flex min-h-11 w-full sm:w-auto items-center justify-center rounded-xl border border-white/12 bg-white/5 px-4 py-2.5 text-sm text-white/85 hover:bg-white/10 active:bg-white/15 transition";

export const btnPrimary =
  "inline-flex min-h-11 w-full sm:w-auto items-center justify-center rounded-xl bg-emerald-500/15 border border-emerald-400/30 px-4 py-2.5 text-sm text-emerald-100 hover:bg-emerald-500/20 active:bg-emerald-500/25 transition shadow-none sm:shadow-[0_12px_30px_-22px_rgba(16,185,129,0.9)]";

export const btnDanger =
  "inline-flex min-h-11 w-full sm:w-auto items-center justify-center rounded-xl border border-red-400/25 bg-red-500/10 px-3 py-2.5 text-sm text-red-200 hover:bg-red-500/15 active:bg-red-500/20 transition";
