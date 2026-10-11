"use client";

import type {
  IncomingNonconformanceCategory,
  IncomingNonconformanceDetails,
} from "../types";

type Props = {
  value: IncomingNonconformanceDetails;
  onChange: (value: IncomingNonconformanceDetails) => void;
};

const categories: Array<{ value: IncomingNonconformanceCategory; label: string }> = [
  { value: "labeling", label: "Etiquetado" },
  { value: "quality", label: "Calidad" },
  { value: "performance", label: "Desempeño" },
  { value: "safety", label: "Seguridad" },
  { value: "other", label: "Otro" },
];

const inputClass = "mt-2 w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2.5 text-sm text-white outline-none focus:border-emerald-400/40";

export default function IncomingNonconformanceFields({ value, onChange }: Props) {
  const update = <K extends keyof IncomingNonconformanceDetails>(key: K, next: IncomingNonconformanceDetails[K]) => onChange({ ...value, [key]: next });
  return (
    <section className="space-y-5 rounded-2xl border border-red-400/20 bg-red-400/[0.045] p-4">
      <div>
        <h3 className="font-semibold text-red-100">Datos para la no conformidad</h3>
        <p className="mt-1 text-xs leading-5 text-white/50">Este lote excedió al menos uno de los límites permitidos. Estos datos se guardarán con el lote y completarán el formato oficial.</p>
      </div>
      <div>
        <p className="text-sm text-white/70">Categoría</p>
        <div className="mt-2 flex flex-wrap gap-2">{categories.map((item) => <button key={item.value} type="button" onClick={() => update("category", item.value)} className={`rounded-xl border px-3 py-2 text-xs ${value.category === item.value ? "border-red-400/35 bg-red-400/10 text-red-100" : "border-white/10 text-white/50"}`}>{item.label}</button>)}</div>
        {value.category === "other" && <input value={value.categoryOtherText || ""} onChange={(event) => update("categoryOtherText", event.target.value)} placeholder="Especifica la categoría" className={inputClass} />}
      </div>
      <label className="block text-sm text-white/70">Acciones inmediatas<textarea rows={3} value={value.immediateActions} onChange={(event) => update("immediateActions", event.target.value)} className={inputClass} placeholder="Ej. Segregar y retener el lote; notificar a las áreas responsables." /></label>
    </section>
  );
}
