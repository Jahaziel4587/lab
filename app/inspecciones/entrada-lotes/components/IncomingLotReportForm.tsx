"use client";
import { findingLabel } from "../types";

import {
  Camera,
  LoaderCircle,
  Trash2,
  X,
} from "lucide-react";
import {
  ChangeEvent,
  FormEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import type {
  CreateIncomingLotReportInput,
  IncomingLotFindingKind,
  IncomingInspectionMethodPlan,
  IncomingLotReportMode,
  SpecCountingMode,
} from "../types";

type Props = {
  initialKind: IncomingLotFindingKind;
  initialMode: IncomingLotReportMode;
  lockedSpecMode: SpecCountingMode;
  methodPlans: IncomingInspectionMethodPlan[];
  saving?: boolean;
  onSubmit: (input: CreateIncomingLotReportInput) => Promise<void>;
  onCancel: () => void;
};

export default function IncomingLotReportForm({
  initialKind,
  initialMode,
  lockedSpecMode,
  methodPlans,
  saving = false,
  onSubmit,
  onCancel,
}: Props) {
  const fileReference = useRef<HTMLInputElement | null>(null);
  const [mode, setMode] = useState<IncomingLotReportMode>(
    initialKind === "spec_rejection" && lockedSpecMode
      ? lockedSpecMode
      : initialMode,
  );
  const [title, setTitle] = useState("");
  const [inspectionMethod, setInspectionMethod] = useState(methodPlans[0]?.method || "visual");
  const [description, setDescription] = useState("");
  const [quantity, setQuantity] = useState("");
  const [sampleNumber, setSampleNumber] = useState("");
  const [photos, setPhotos] = useState<File[]>([]);
  const [formError, setFormError] = useState("");

  useEffect(() => {
    if (initialKind === "spec_rejection" && lockedSpecMode) {
      setMode(lockedSpecMode);
    }
  }, [initialKind, lockedSpecMode]);

  const previews = useMemo(() => photos.map((file) => ({
    file,
    url: URL.createObjectURL(file),
  })), [photos]);

  useEffect(() => () => {
    previews.forEach((preview) => URL.revokeObjectURL(preview.url));
  }, [previews]);

  const addPhotos = (event: ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(event.target.files || [])
      .filter((file) => file.type.startsWith("image/"));
    setPhotos((current) => [...current, ...selected]);
    event.target.value = "";
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const parsedQuantity = Number(quantity);
    const parsedSample = Number(sampleNumber);
    const selectedPlan = methodPlans.find((plan) => plan.method === inspectionMethod) || methodPlans[0];

    if (initialKind !== "anomaly" && !title.trim()) {
      setFormError("Agrega el título del rechazo por SPEC.");
      return;
    }
    if (
      mode === "quantity" &&
      (!Number.isInteger(parsedQuantity) || parsedQuantity < 1)
    ) {
      setFormError("Agrega una cantidad válida.");
      return;
    }
    if (
      mode === "sample_number" &&
      (
        !Number.isInteger(parsedSample) ||
        parsedSample < 1 ||
        parsedSample > selectedPlan.inspectedQuantity
      )
    ) {
      setFormError(
        `El número de muestra debe estar entre 1 y ${selectedPlan.inspectedQuantity}.`,
      );
      return;
    }
    try {
      setFormError("");
      await onSubmit({
        kind: initialKind,
        mode,
        title: initialKind === "anomaly" ? "Pendiente de título" : title.trim(),
        description: description.trim(),
        quantity: mode === "quantity" ? parsedQuantity : undefined,
        sampleNumber: mode === "sample_number" ? parsedSample : undefined,
        photos,
        inspectionMethod,
      });
    } catch (cause) {
      setFormError(cause instanceof Error ? cause.message : "No fue posible guardar el reporte.");
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/75 p-4 backdrop-blur-sm">
      <div className="mx-auto my-5 max-w-2xl rounded-3xl border border-white/10 bg-[#0d1512] p-5 shadow-2xl sm:p-7">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-300">Nuevo reporte</p>
            <h2 className="mt-2 text-2xl font-semibold text-white">
              {`Registrar ${findingLabel(initialKind).toLowerCase()}`}
            </h2>
          </div>
          <button type="button" onClick={onCancel} className="rounded-xl border border-white/10 p-2 text-white/60 hover:bg-white/5">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={submit} className="mt-6 space-y-5">
          {methodPlans.length > 1 && <div><p className="mb-2 text-sm text-white/70">Método de inspección del reporte</p><div className="grid grid-cols-2 gap-2">{methodPlans.map((plan) => <button key={plan.method} type="button" onClick={() => setInspectionMethod(plan.method)} className={`rounded-xl border px-3 py-3 text-sm ${inspectionMethod === plan.method ? "border-emerald-400/35 bg-emerald-400/10 text-emerald-100" : "border-white/10 text-white/45"}`}>{plan.method === "documentary" ? "Documental" : plan.method === "visual" ? "Visual" : plan.method === "dimensional" ? "Dimensional" : "Funcional"}</button>)}</div></div>}
          <div>
            <p className="mb-2 text-sm text-white/70">Manera de reportar</p>
            <div className="grid grid-cols-2 gap-2">
              {(["quantity", "sample_number"] as IncomingLotReportMode[]).map((value) => {
                const disabled = initialKind === "spec_rejection" && Boolean(lockedSpecMode) && lockedSpecMode !== value;
                return (
                  <button
                    key={value}
                    type="button"
                    disabled={disabled}
                    onClick={() => setMode(value)}
                    className={`rounded-xl border px-3 py-3 text-sm ${mode === value ? "border-emerald-400/35 bg-emerald-400/10 text-emerald-100" : "border-white/10 text-white/45"} disabled:opacity-30`}
                  >
                    {value === "quantity" ? "Cantidad de piezas" : "Número de muestra"}
                  </button>
                );
              })}
            </div>
            {initialKind === "spec_rejection" && lockedSpecMode && (
              <p className="mt-2 text-xs text-amber-200/70">La modalidad quedó definida por el primer rechazo registrado.</p>
            )}
          </div>

          {initialKind !== "anomaly" && (
            <label className="block text-sm text-white/70">
              Título del rechazo
              <input value={title} onChange={(event) => setTitle(event.target.value)} className="mt-2 w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none focus:border-emerald-400/40" placeholder="Ej. Piezas amarillas" />
            </label>
          )}

          <label className="block text-sm text-white/70">
            Descripción (opcional)
            <textarea value={description} onChange={(event) => setDescription(event.target.value)} rows={4} className="mt-2 w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none focus:border-emerald-400/40" placeholder="Describe lo observado. Puedes incluir aquí el rango inspeccionado." />
          </label>

          <label className="block text-sm text-white/70">
            {mode === "quantity" ? "Cantidad de piezas con el hallazgo" : "Número de muestra"}
            <input type="number" min="1" value={mode === "quantity" ? quantity : sampleNumber} onChange={(event) => mode === "quantity" ? setQuantity(event.target.value) : setSampleNumber(event.target.value)} className="mt-2 w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none focus:border-emerald-400/40" />
          </label>

          <div>
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm text-white/70">Fotografías</p>
                <p className="text-xs text-white/35">Opcionales para este reporte.</p>
              </div>
              <button type="button" onClick={() => fileReference.current?.click()} className="inline-flex items-center gap-2 rounded-xl border border-white/10 px-4 py-2 text-sm text-white/70 hover:bg-white/5">
                <Camera size={16} /> Agregar
              </button>
              <input ref={fileReference} type="file" accept="image/*" multiple className="hidden" onChange={addPhotos} />
            </div>
            {previews.length > 0 && (
              <div className="mt-3 grid grid-cols-3 gap-3 sm:grid-cols-4">
                {previews.map((preview, index) => (
                  <div key={`${preview.file.name}-${index}`} className="relative aspect-square overflow-hidden rounded-xl border border-white/10">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={preview.url} alt="Vista previa" className="h-full w-full object-cover" />
                    <button type="button" onClick={() => setPhotos((current) => current.filter((_, currentIndex) => currentIndex !== index))} className="absolute right-1 top-1 rounded-lg bg-black/75 p-1.5 text-red-200">
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {formError && <p className="rounded-xl border border-red-400/20 bg-red-400/10 p-3 text-sm text-red-100">{formError}</p>}

          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onCancel} disabled={saving} className="rounded-xl border border-white/10 px-5 py-3 text-sm text-white/60">Cancelar</button>
            <button type="submit" disabled={saving} className="inline-flex items-center gap-2 rounded-xl border border-emerald-400/30 bg-emerald-400/15 px-5 py-3 text-sm font-medium text-emerald-100 disabled:opacity-50">
              {saving && <LoaderCircle size={16} className="animate-spin" />}
              Guardar reporte
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
