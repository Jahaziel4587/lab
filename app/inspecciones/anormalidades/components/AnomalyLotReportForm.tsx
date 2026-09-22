"use client";

import { ChangeEvent, FormEvent, useRef, useState } from "react";
import { Camera, FileImage, LoaderCircle, Send, Trash2 } from "lucide-react";

export type NewAnomalyLotReportInput = {
  description: string;
  lot: string;
  affectedQuantity: number;
  inspectedQuantity: number;
  lotQuantity: number;
  photos: File[];
};

type Props = {
  saving?: boolean;
  onSubmit: (input: NewAnomalyLotReportInput) => Promise<void>;
  onCancel: () => void;
};

export default function AnomalyLotReportForm({ saving = false, onSubmit, onCancel }: Props) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [description, setDescription] = useState("");
  const [lot, setLot] = useState("");
  const [affected, setAffected] = useState("");
  const [inspected, setInspected] = useState("");
  const [lotQuantity, setLotQuantity] = useState("");
  const [photos, setPhotos] = useState<File[]>([]);
  const [error, setError] = useState("");

  const addPhotos = (event: ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(event.target.files || []);
    setPhotos((current) => {
      const keys = new Set(current.map((file) => `${file.name}-${file.size}-${file.lastModified}`));
      return [...current, ...selected.filter((file) => {
        const key = `${file.name}-${file.size}-${file.lastModified}`;
        if (keys.has(key)) return false;
        keys.add(key);
        return true;
      })];
    });
    event.target.value = "";
    setError("");
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const affectedValue = Number(affected);
    const inspectedValue = Number(inspected);
    const lotValue = Number(lotQuantity);

    if (!lot.trim()) return setError("Agrega el nombre del lote.");
    if (!description.trim()) return setError("Agrega una descripción.");
    if (!Number.isInteger(affectedValue) || affectedValue < 1) return setError("La cantidad con anormalidad debe ser mayor a cero.");
    if (!Number.isInteger(inspectedValue) || inspectedValue < 1) return setError("La cantidad inspeccionada debe ser mayor a cero.");
    if (!Number.isInteger(lotValue) || lotValue < 1) return setError("La cantidad total del lote debe ser mayor a cero.");
    if (affectedValue > inspectedValue) return setError("La cantidad con anormalidad no puede superar la cantidad inspeccionada.");
    if (inspectedValue > lotValue) return setError("La cantidad inspeccionada no puede superar la cantidad total del lote.");

    try {
      setError("");
      await onSubmit({
        description: description.trim(),
        lot: lot.trim(),
        affectedQuantity: affectedValue,
        inspectedQuantity: inspectedValue,
        lotQuantity: lotValue,
        photos,
      });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No fue posible guardar el reporte por lote.");
    }
  };

  const numberField = (id: string, label: string, value: string, setter: (value: string) => void, placeholder: string) => (
    <div>
      <label htmlFor={id} className="text-sm font-medium text-white/75">{label}</label>
      <input id={id} type="number" min="1" step="1" value={value} onChange={(event) => { setter(event.target.value); setError(""); }} disabled={saving} placeholder={placeholder} className="mt-2 min-h-12 w-full rounded-xl border border-white/15 bg-black/25 px-4 text-white outline-none placeholder:text-white/30 focus:border-emerald-400/45 disabled:opacity-50" />
    </div>
  );

  return (
    <form onSubmit={submit} className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="lot-report-name" className="text-sm font-medium text-white/75">Nombre del lote</label>
          <input id="lot-report-name" value={lot} onChange={(event) => { setLot(event.target.value); setError(""); }} disabled={saving} placeholder="Ej. LOT-2026-015" className="mt-2 min-h-12 w-full rounded-xl border border-white/15 bg-black/25 px-4 text-white outline-none placeholder:text-white/30 focus:border-emerald-400/45 disabled:opacity-50" />
        </div>
        {numberField("lot-report-affected", "Piezas con esta anormalidad", affected, setAffected, "Ej. 4")}
        {numberField("lot-report-inspected", "Piezas inspeccionadas", inspected, setInspected, "Ej. 20")}
        {numberField("lot-report-total", "Cantidad total del lote", lotQuantity, setLotQuantity, "Ej. 100")}
      </div>

      <div>
        <label htmlFor="lot-report-description" className="text-sm font-medium text-white/75">Descripción</label>
        <textarea id="lot-report-description" rows={4} value={description} onChange={(event) => { setDescription(event.target.value); setError(""); }} disabled={saving} placeholder="Describe el resultado o cualquier detalle relevante del lote." className="mt-2 w-full resize-y rounded-2xl border border-white/15 bg-black/25 px-4 py-3 text-white outline-none placeholder:text-white/30 focus:border-emerald-400/45 disabled:opacity-50" />
      </div>

      <div>
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-white/75">Fotografías</p>
            <p className="mt-1 text-xs text-white/40">Opcional. Puedes adjuntar solo las necesarias para representar el lote.</p>
          </div>
          <button type="button" onClick={() => inputRef.current?.click()} disabled={saving} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-white/15 bg-white/[0.05] px-4 text-sm text-white/75 disabled:opacity-50"><Camera size={17} />Agregar fotos</button>
        </div>
        <input ref={inputRef} type="file" accept="image/*" multiple className="hidden" onChange={addPhotos} />
        {photos.length > 0 && <div className="mt-3 space-y-2">{photos.map((photo, index) => <div key={`${photo.name}-${photo.lastModified}`} className="flex items-center justify-between rounded-xl border border-white/10 bg-black/20 px-3 py-2"><span className="flex min-w-0 items-center gap-2 text-sm text-white/65"><FileImage size={16} className="shrink-0" /><span className="truncate">{photo.name}</span></span><button type="button" onClick={() => setPhotos((current) => current.filter((_, i) => i !== index))} disabled={saving} aria-label={`Quitar ${photo.name}`} className="ml-3 text-white/40 hover:text-red-300"><Trash2 size={16} /></button></div>)}</div>}
      </div>

      {error && <p className="rounded-xl border border-red-400/20 bg-red-400/[0.07] px-4 py-3 text-sm text-red-200">{error}</p>}
      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <button type="button" onClick={onCancel} disabled={saving} className="min-h-11 rounded-xl border border-white/15 px-5 text-sm text-white/65 disabled:opacity-50">Cancelar</button>
        <button type="submit" disabled={saving} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-emerald-400/30 bg-emerald-400/15 px-5 text-sm font-medium text-emerald-100 disabled:opacity-50">{saving ? <LoaderCircle size={17} className="animate-spin" /> : <Send size={17} />}{saving ? "Guardando..." : "Agregar reporte por lote"}</button>
      </div>
    </form>
  );
}
