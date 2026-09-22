"use client";

import { FormEvent, useEffect, useState } from "react";
import { FolderPlus, LoaderCircle } from "lucide-react";

import type {
  CreateNonConformityLotInput,
  NonConformitySourceType,
  ResponsibleNonConformityPm,
} from "../types";

type Props = {
  sourceType: NonConformitySourceType;
  responsiblePms: ResponsibleNonConformityPm[];
  loadingPms?: boolean;
  saving?: boolean;
  onSubmit: (input: CreateNonConformityLotInput) => Promise<void>;
  onCancel: () => void;
};

export default function NonConformityLotForm({
  sourceType,
  responsiblePms,
  loadingPms = false,
  saving = false,
  onSubmit,
  onCancel,
}: Props) {
  const [lotName, setLotName] = useState("");
  const [sampleQuantity, setSampleQuantity] = useState("");
  const [lotQuantity, setLotQuantity] = useState("");
  const [inspectionType, setInspectionType] = useState<"normal" | "special" | "">("");
  const [inspectionLevel, setInspectionLevel] = useState("");
  const [aql, setAql] = useState("");
  const [responsiblePmEmail, setResponsiblePmEmail] = useState("");
  const [formError, setFormError] = useState("");
  const isMts = sourceType === "entrada_mts";

  useEffect(() => {
    if (responsiblePms.length === 1) {
      setResponsiblePmEmail(responsiblePms[0].email);
    }
  }, [responsiblePms]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const cleanLotName = lotName.trim();
    const totalSamples = Number(sampleQuantity);
    const totalLot = Number(lotQuantity);

    if (!cleanLotName) {
      setFormError("Agrega el nombre del lote.");
      return;
    }

    if (!Number.isInteger(totalSamples) || totalSamples < 1) {
      setFormError(
        "La cantidad de muestras debe ser un número entero mayor a cero.",
      );
      return;
    }

    if (!Number.isInteger(totalLot) || totalLot < 1) {
      setFormError("La cantidad total del lote debe ser un número entero mayor a cero.");
      return;
    }

    if (totalSamples > totalLot) {
      setFormError("La cantidad inspeccionada no puede superar la cantidad total del lote.");
      return;
    }

    if (!inspectionType || !inspectionLevel || !aql.trim()) {
      setFormError("Completa el tipo, nivel de inspección y AQL.");
      return;
    }

    const responsiblePm = responsiblePms.find(
      (pm) => pm.email === responsiblePmEmail,
    );

    if (!responsiblePm) {
      setFormError(
        isMts
          ? "Selecciona al encargado de este lote MTS."
          : "Selecciona al PM responsable.",
      );
      return;
    }

    try {
      setFormError("");
      await onSubmit({
        lotName: cleanLotName,
        sampleQuantity: totalSamples,
        lotQuantity: totalLot,
        inspectionType,
        inspectionLevel: inspectionLevel as CreateNonConformityLotInput["inspectionLevel"],
        aql: aql.trim(),
        responsiblePm,
      });
    } catch (error) {
      setFormError(
        error instanceof Error
          ? error.message
          : "No fue posible crear el lote.",
      );
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="flex items-start gap-4 rounded-2xl border border-emerald-400/20 bg-emerald-400/[0.06] p-4 sm:p-5">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-emerald-400/25 bg-emerald-400/10 text-emerald-300">
          <FolderPlus size={21} />
        </div>
        <div>
          <h2 className="font-semibold text-white">Agregar lote</h2>
          <p className="mt-1 text-sm leading-relaxed text-white/55">
            Crea el lote antes de registrar las muestras que no cumplan con la especificación.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
        <div>
          <label htmlFor="spec-inspection-type" className="text-sm font-medium text-white/75">Tipo de inspección</label>
          <select id="spec-inspection-type" value={inspectionType} onChange={(event) => { setInspectionType(event.target.value as "normal" | "special" | ""); setFormError(""); }} disabled={saving} className="mt-2 min-h-12 w-full rounded-xl border border-white/15 bg-[#111916] px-4 text-white outline-none focus:border-emerald-400/45 disabled:opacity-50">
            <option value="">Selecciona una opción</option><option value="normal">Normal</option><option value="special">Especial</option>
          </select>
        </div>
        <div>
          <label htmlFor="spec-inspection-level" className="text-sm font-medium text-white/75">Nivel de inspección</label>
          <select id="spec-inspection-level" value={inspectionLevel} onChange={(event) => { setInspectionLevel(event.target.value); setFormError(""); }} disabled={saving} className="mt-2 min-h-12 w-full rounded-xl border border-white/15 bg-[#111916] px-4 text-white outline-none focus:border-emerald-400/45 disabled:opacity-50">
            <option value="">Selecciona un nivel</option>{["I", "II", "III", "S1", "S2", "S3", "S4"].map((level) => <option key={level} value={level}>{level}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="spec-aql" className="text-sm font-medium text-white/75">AQL</label>
          <input id="spec-aql" value={aql} onChange={(event) => { setAql(event.target.value); setFormError(""); }} disabled={saving} placeholder="Ej. 1.0" className="mt-2 min-h-12 w-full rounded-xl border border-white/15 bg-black/25 px-4 text-white outline-none placeholder:text-white/30 focus:border-emerald-400/45 disabled:opacity-50" />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
        <div>
          <label htmlFor="nonconformity-lot-name" className="text-sm font-medium text-white/75">
            Nombre del lote
          </label>
          <input
            id="nonconformity-lot-name"
            value={lotName}
            onChange={(event) => {
              setLotName(event.target.value);
              setFormError("");
            }}
            disabled={saving}
            placeholder="Ej. LOT-2026-015"
            autoComplete="off"
            className="mt-2 min-h-12 w-full rounded-xl border border-white/15 bg-black/25 px-4 text-white outline-none transition placeholder:text-white/30 focus:border-emerald-400/45 focus:ring-2 focus:ring-emerald-400/10 disabled:opacity-50"
          />
        </div>

        <div>
          <label htmlFor="nonconformity-sample-quantity" className="text-sm font-medium text-white/75">
            Cantidad inspeccionada
          </label>
          <input
            id="nonconformity-sample-quantity"
            type="number"
            min="1"
            step="1"
            inputMode="numeric"
            value={sampleQuantity}
            onChange={(event) => {
              setSampleQuantity(event.target.value);
              setFormError("");
            }}
            disabled={saving}
            placeholder="Ej. 200"
            className="mt-2 min-h-12 w-full rounded-xl border border-white/15 bg-black/25 px-4 text-white outline-none transition placeholder:text-white/30 focus:border-emerald-400/45 focus:ring-2 focus:ring-emerald-400/10 disabled:opacity-50"
          />
          <p className="mt-2 text-xs leading-relaxed text-white/40">
            Cantidad de piezas que forman parte de la inspección.
          </p>
        </div>

        <div>
          <label htmlFor="nonconformity-lot-quantity" className="text-sm font-medium text-white/75">
            Cantidad total del lote
          </label>
          <input
            id="nonconformity-lot-quantity"
            type="number"
            min="1"
            step="1"
            inputMode="numeric"
            value={lotQuantity}
            onChange={(event) => {
              setLotQuantity(event.target.value);
              setFormError("");
            }}
            disabled={saving}
            placeholder="Ej. 500"
            className="mt-2 min-h-12 w-full rounded-xl border border-white/15 bg-black/25 px-4 text-white outline-none transition placeholder:text-white/30 focus:border-emerald-400/45 focus:ring-2 focus:ring-emerald-400/10 disabled:opacity-50"
          />
          <p className="mt-2 text-xs leading-relaxed text-white/40">
            Cantidad completa de piezas que contiene el lote.
          </p>
        </div>
      </div>

      <div>
        <label htmlFor="nonconformity-pm" className="text-sm font-medium text-white/75">
          {isMts ? "Encargado del lote MTS" : "Project Manager responsable"}
        </label>

        {loadingPms ? (
          <div className="mt-2 flex min-h-12 items-center gap-3 rounded-xl border border-white/15 bg-black/25 px-4 text-sm text-white/50">
            <LoaderCircle size={17} className="animate-spin" />
            Cargando responsables...
          </div>
        ) : (
          <select
            id="nonconformity-pm"
            value={responsiblePmEmail}
            onChange={(event) => {
              setResponsiblePmEmail(event.target.value);
              setFormError("");
            }}
            disabled={saving || responsiblePms.length === 0}
            className="mt-2 min-h-12 w-full rounded-xl border border-white/15 bg-[#111916] px-4 text-white outline-none transition focus:border-emerald-400/45 focus:ring-2 focus:ring-emerald-400/10 disabled:opacity-50"
          >
            <option value="">
              {responsiblePms.length === 0
                ? "No hay responsables disponibles"
                : "Selecciona un responsable"}
            </option>
            {responsiblePms.map((pm) => (
              <option key={pm.uid} value={pm.email}>
                {pm.name} — {pm.email}
              </option>
            ))}
          </select>
        )}

        <p className="mt-2 text-xs leading-relaxed text-white/40">
          {isMts
            ? "Selecciona al encargado correspondiente a la orden de compra."
            : responsiblePms.length === 1
              ? "El PM del proyecto fue seleccionado automáticamente."
              : "Selecciona uno de los PM asignados al proyecto."}
        </p>
      </div>

      {formError && (
        <div role="alert" className="rounded-xl border border-red-400/25 bg-red-400/[0.08] px-4 py-3 text-sm text-red-100">
          {formError}
        </div>
      )}

      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <button
          type="button"
          onClick={onCancel}
          disabled={saving}
          className="min-h-11 rounded-xl border border-white/15 bg-white/[0.04] px-5 text-sm font-medium text-white/70 transition hover:bg-white/[0.08] disabled:opacity-50"
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={saving || loadingPms || responsiblePms.length === 0}
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-emerald-400/30 bg-emerald-400/10 px-5 text-sm font-medium text-emerald-200 transition hover:bg-emerald-400/15 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {saving ? (
            <>
              <LoaderCircle size={17} className="animate-spin" />
              Creando lote...
            </>
          ) : (
            <>
              <FolderPlus size={17} />
              Crear lote
            </>
          )}
        </button>
      </div>
    </form>
  );
}
