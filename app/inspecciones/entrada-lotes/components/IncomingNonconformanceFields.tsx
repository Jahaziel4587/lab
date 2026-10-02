"use client";

import type {
  IncomingDisposition,
  IncomingNonconformanceCategory,
  IncomingNonconformanceDetails,
  IncomingRiskLevel,
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

const dispositions: Array<{ value: IncomingDisposition; label: string }> = [
  { value: "rework", label: "Retrabajo" },
  { value: "return_supplier", label: "Devolución a proveedor" },
  { value: "use_as_is", label: "Usar tal cual" },
  { value: "rnd", label: "Enviar a I+D" },
  { value: "scrap", label: "Scrap" },
  { value: "other", label: "Otra" },
];

const inputClass = "mt-2 w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2.5 text-sm text-white outline-none focus:border-emerald-400/40";

export default function IncomingNonconformanceFields({ value, onChange }: Props) {
  const update = <K extends keyof IncomingNonconformanceDetails>(key: K, next: IncomingNonconformanceDetails[K]) => onChange({ ...value, [key]: next });
  const toggleDisposition = (item: IncomingDisposition) => update(
    "dispositions",
    value.dispositions.includes(item)
      ? value.dispositions.filter((entry) => entry !== item)
      : [...value.dispositions, item],
  );

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
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="text-sm text-white/70">Severidad<input value={value.riskSeverity} onChange={(event) => update("riskSeverity", event.target.value)} className={inputClass} placeholder="Describe el impacto" /></label>
        <label className="text-sm text-white/70">Ocurrencia<input value={value.riskOccurrence} onChange={(event) => update("riskOccurrence", event.target.value)} className={inputClass} placeholder="Frecuencia o probabilidad" /></label>
      </div>
      <div>
        <p className="text-sm text-white/70">Nivel de riesgo</p>
        <div className="mt-2 grid grid-cols-3 gap-2">{(["high", "medium", "low"] as IncomingRiskLevel[]).map((level) => <button key={level} type="button" onClick={() => update("riskLevel", level)} className={`rounded-xl border px-3 py-2 text-xs ${value.riskLevel === level ? "border-red-400/35 bg-red-400/10 text-red-100" : "border-white/10 text-white/50"}`}>{level === "high" ? "Alto" : level === "medium" ? "Medio" : "Bajo"}</button>)}</div>
      </div>
      <label className="flex items-center gap-3 rounded-xl border border-white/10 p-3 text-sm text-white/70"><input type="checkbox" checked={value.capaRequired} onChange={(event) => update("capaRequired", event.target.checked)} className="h-4 w-4 accent-red-400" />Se requiere CAPA</label>
      <div>
        <p className="text-sm text-white/70">Disposición propuesta</p>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">{dispositions.map((item) => <label key={item.value} className="flex items-center gap-2 rounded-xl border border-white/10 p-3 text-xs text-white/65"><input type="checkbox" checked={value.dispositions.includes(item.value)} onChange={() => toggleDisposition(item.value)} className="accent-red-400" />{item.label}</label>)}</div>
        {value.dispositions.includes("other") && <input value={value.dispositionOtherText || ""} onChange={(event) => update("dispositionOtherText", event.target.value)} placeholder="Especifica la disposición" className={inputClass} />}
      </div>
      <label className="block text-sm text-white/70">Justificación de la disposición<textarea rows={3} value={value.dispositionJustification} onChange={(event) => update("dispositionJustification", event.target.value)} className={inputClass} /></label>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="text-sm text-white/70">IIF (opcional)<input value={value.iifReference || ""} onChange={(event) => update("iifReference", event.target.value)} className={inputClass} /></label>
        <label className="text-sm text-white/70">QCI (opcional)<input value={value.qciReference || ""} onChange={(event) => update("qciReference", event.target.value)} className={inputClass} /></label>
        <label className="text-sm text-white/70">CAPA (opcional)<input value={value.capaReference || ""} onChange={(event) => update("capaReference", event.target.value)} className={inputClass} /></label>
        <label className="text-sm text-white/70">SCAR (opcional)<input value={value.scarReference || ""} onChange={(event) => update("scarReference", event.target.value)} className={inputClass} /></label>
        <label className="text-sm text-white/70">Retiro / Recall (opcional)<input value={value.recallReference || ""} onChange={(event) => update("recallReference", event.target.value)} className={inputClass} /></label>
        <label className="text-sm text-white/70">Otros (opcional)<input value={value.otherReferences || ""} onChange={(event) => update("otherReferences", event.target.value)} className={inputClass} /></label>
      </div>
      <label className="block text-sm text-white/70">Acciones correctivas (opcional)<textarea rows={2} value={value.correctiveActions || ""} onChange={(event) => update("correctiveActions", event.target.value)} className={inputClass} /></label>
    </section>
  );
}
