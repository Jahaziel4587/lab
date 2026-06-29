import type { ReactNode } from "react";

export function Info({ label, value }: { label: string; value?: any }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-[0.18em] text-white/40">
        {label}
      </p>
      <p className="mt-1 break-words text-sm text-white/85">{value || "—"}</p>
    </div>
  );
}

export function InfoText({ label, value }: { label: string; value?: any }) {
  return (
    <div className="mt-3">
      <p className="text-sm font-semibold text-white/75">{label}</p>
      <p className="mt-1 whitespace-pre-wrap rounded-2xl border border-white/10 bg-black/20 p-4 text-sm leading-relaxed text-white/75">
        {value || "—"}
      </p>
    </div>
  );
}

export function BooleanInfo({
  label,
  value,
}: {
  label: string;
  value?: boolean;
}) {
  return (
    <div className="flex items-center gap-2 text-sm text-white/75">
      <span
        className={`h-2.5 w-2.5 rounded-full ${
          value ? "bg-emerald-300" : "bg-white/20"
        }`}
      />
      {label}: {value ? "Sí" : "No"}
    </div>
  );
}

export function Block({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
      <h3 className="font-semibold text-white/90">{title}</h3>
      <div className="mt-3">{children}</div>
    </div>
  );
}