"use client";

import {
  FormEvent,
  useEffect,
  useState,
} from "react";
import {
  LoaderCircle,
  PackagePlus,
} from "lucide-react";

import type {
  CreateIncomingInspectionLotInput,
  IncomingInspectionLevel,
  IncomingInspectionType,
  IncomingLotResponsible,
} from "../types";

type Props = {
  responsiblePms: IncomingLotResponsible[];
  loadingPms?: boolean;
  saving?: boolean;
  onSubmit: (
    input:
      CreateIncomingInspectionLotInput,
  ) => Promise<void>;
  onCancel: () => void;
};

const INSPECTION_LEVELS:
  IncomingInspectionLevel[] = [
    "I",
    "II",
    "III",
    "S1",
    "S2",
    "S3",
    "S4",
  ];

export default function IncomingLotForm({
  responsiblePms,
  loadingPms = false,
  saving = false,
  onSubmit,
  onCancel,
}: Props) {
  const [lotName, setLotName] =
    useState("");
  const [totalLotQuantity,
    setTotalLotQuantity] =
    useState("");
  const [inspectedQuantity,
    setInspectedQuantity] =
    useState("");
  const [inspectionType,
    setInspectionType] =
    useState<
      IncomingInspectionType | ""
    >("");
  const [inspectionLevel,
    setInspectionLevel] =
    useState<
      IncomingInspectionLevel | ""
    >("");
  const [aql, setAql] =
    useState("");
  const [allowedRejectedQuantity,
    setAllowedRejectedQuantity] =
    useState("");
  const [responsiblePmEmail,
    setResponsiblePmEmail] =
    useState("");
  const [formError, setFormError] =
    useState("");

  useEffect(() => {
    if (responsiblePms.length === 1) {
      setResponsiblePmEmail(
        responsiblePms[0].email,
      );
    }
  }, [responsiblePms]);

  const submit = async (
    event: FormEvent<HTMLFormElement>,
  ) => {
    event.preventDefault();

    const totalLot =
      Number(totalLotQuantity);
    const inspected =
      Number(inspectedQuantity);
    const allowed =
      Number(allowedRejectedQuantity);
    const responsiblePm =
      responsiblePms.find(
        (pm) =>
          pm.email ===
          responsiblePmEmail,
      );

    if (!lotName.trim()) {
      setFormError(
        "Agrega el nombre del lote.",
      );
      return;
    }

    if (
      !Number.isInteger(totalLot) ||
      totalLot < 1
    ) {
      setFormError(
        "La cantidad total del lote debe ser mayor a cero.",
      );
      return;
    }

    if (
      !Number.isInteger(inspected) ||
      inspected < 1 ||
      inspected > totalLot
    ) {
      setFormError(
        "La cantidad inspeccionada debe estar entre uno y el total del lote.",
      );
      return;
    }

    if (
      !inspectionType ||
      !inspectionLevel ||
      !aql.trim()
    ) {
      setFormError(
        "Completa el tipo, nivel de inspección y AQL.",
      );
      return;
    }

    if (
      !Number.isInteger(allowed) ||
      allowed < 0 ||
      allowed > inspected
    ) {
      setFormError(
        "Los rechazos permitidos deben estar entre cero y la cantidad inspeccionada.",
      );
      return;
    }

    if (!responsiblePm) {
      setFormError(
        "Selecciona al PM responsable.",
      );
      return;
    }

    try {
      setFormError("");
      await onSubmit({
        lotName: lotName.trim(),
        totalLotQuantity: totalLot,
        inspectedQuantity: inspected,
        inspectionType,
        inspectionLevel,
        aql: aql.trim(),
        allowedRejectedQuantity:
          allowed,
        responsiblePm,
      });
    } catch (cause) {
      setFormError(
        cause instanceof Error
          ? cause.message
          : "No fue posible crear el lote.",
      );
    }
  };

  const clearError = () =>
    setFormError("");

  return (
    <form
      onSubmit={submit}
      className="space-y-6"
    >
      <div className="flex items-start gap-4 rounded-2xl border border-emerald-400/20 bg-emerald-400/[0.06] p-4 sm:p-5">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-emerald-400/25 bg-emerald-400/10 text-emerald-300">
          <PackagePlus size={21} />
        </div>
        <div>
          <h2 className="font-semibold text-white">
            Agregar lote de inspección
          </h2>
          <p className="mt-1 text-sm leading-relaxed text-white/55">
            El lote permanecerá en curso hasta que el inspector lo finalice manualmente.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
        <div>
          <label htmlFor="incoming-lot-name" className="text-sm font-medium text-white/75">
            Nombre del lote
          </label>
          <input
            id="incoming-lot-name"
            value={lotName}
            onChange={(event) => {
              setLotName(event.target.value);
              clearError();
            }}
            disabled={saving}
            placeholder="Ej. LOT-2026-015"
            className="mt-2 min-h-12 w-full rounded-xl border border-white/15 bg-black/25 px-4 text-white outline-none placeholder:text-white/30 focus:border-emerald-400/45 disabled:opacity-50"
          />
        </div>

        <div>
          <label htmlFor="incoming-total-quantity" className="text-sm font-medium text-white/75">
            Cantidad total del lote
          </label>
          <input
            id="incoming-total-quantity"
            type="number"
            min="1"
            step="1"
            inputMode="numeric"
            value={totalLotQuantity}
            onChange={(event) => {
              setTotalLotQuantity(
                event.target.value,
              );
              clearError();
            }}
            disabled={saving}
            placeholder="Ej. 1000"
            className="mt-2 min-h-12 w-full rounded-xl border border-white/15 bg-black/25 px-4 text-white outline-none placeholder:text-white/30 focus:border-emerald-400/45 disabled:opacity-50"
          />
        </div>

        <div>
          <label htmlFor="incoming-inspected-quantity" className="text-sm font-medium text-white/75">
            Cantidad por inspeccionar
          </label>
          <input
            id="incoming-inspected-quantity"
            type="number"
            min="1"
            step="1"
            inputMode="numeric"
            value={inspectedQuantity}
            onChange={(event) => {
              setInspectedQuantity(
                event.target.value,
              );
              clearError();
            }}
            disabled={saving}
            placeholder="Ej. 125"
            className="mt-2 min-h-12 w-full rounded-xl border border-white/15 bg-black/25 px-4 text-white outline-none placeholder:text-white/30 focus:border-emerald-400/45 disabled:opacity-50"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
        <div>
          <label htmlFor="incoming-inspection-type" className="text-sm font-medium text-white/75">
            Tipo de inspección
          </label>
          <select
            id="incoming-inspection-type"
            value={inspectionType}
            onChange={(event) => {
              setInspectionType(
                event.target.value as
                  IncomingInspectionType | "",
              );
              clearError();
            }}
            disabled={saving}
            className="mt-2 min-h-12 w-full rounded-xl border border-white/15 bg-[#111916] px-4 text-white outline-none focus:border-emerald-400/45 disabled:opacity-50"
          >
            <option value="">
              Selecciona una opción
            </option>
            <option value="normal">
              Normal
            </option>
            <option value="special">
              Especial
            </option>
          </select>
        </div>

        <div>
          <label htmlFor="incoming-inspection-level" className="text-sm font-medium text-white/75">
            Nivel de inspección
          </label>
          <select
            id="incoming-inspection-level"
            value={inspectionLevel}
            onChange={(event) => {
              setInspectionLevel(
                event.target.value as
                  IncomingInspectionLevel | "",
              );
              clearError();
            }}
            disabled={saving}
            className="mt-2 min-h-12 w-full rounded-xl border border-white/15 bg-[#111916] px-4 text-white outline-none focus:border-emerald-400/45 disabled:opacity-50"
          >
            <option value="">
              Selecciona un nivel
            </option>
            {INSPECTION_LEVELS.map(
              (level) => (
                <option
                  key={level}
                  value={level}
                >
                  {level}
                </option>
              ),
            )}
          </select>
        </div>

        <div>
          <label htmlFor="incoming-aql" className="text-sm font-medium text-white/75">
            AQL
          </label>
          <input
            id="incoming-aql"
            value={aql}
            onChange={(event) => {
              setAql(event.target.value);
              clearError();
            }}
            disabled={saving}
            placeholder="Ej. 1.0"
            className="mt-2 min-h-12 w-full rounded-xl border border-white/15 bg-black/25 px-4 text-white outline-none placeholder:text-white/30 focus:border-emerald-400/45 disabled:opacity-50"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <div>
          <label htmlFor="incoming-allowed-rejections" className="text-sm font-medium text-white/75">
            Cantidad de rechazos permitida
          </label>
          <input
            id="incoming-allowed-rejections"
            type="number"
            min="0"
            step="1"
            inputMode="numeric"
            value={allowedRejectedQuantity}
            onChange={(event) => {
              setAllowedRejectedQuantity(
                event.target.value,
              );
              clearError();
            }}
            disabled={saving}
            placeholder="Ej. 9"
            className="mt-2 min-h-12 w-full rounded-xl border border-white/15 bg-black/25 px-4 text-white outline-none placeholder:text-white/30 focus:border-emerald-400/45 disabled:opacity-50"
          />
          <p className="mt-2 text-xs leading-relaxed text-white/40">
            Si las piezas únicas rechazadas superan este valor, se solicitará confirmar la notificación.
          </p>
        </div>

        <div>
          <label htmlFor="incoming-responsible-pm" className="text-sm font-medium text-white/75">
            PM responsable
          </label>
          <select
            id="incoming-responsible-pm"
            value={responsiblePmEmail}
            onChange={(event) => {
              setResponsiblePmEmail(
                event.target.value,
              );
              clearError();
            }}
            disabled={
              saving || loadingPms
            }
            className="mt-2 min-h-12 w-full rounded-xl border border-white/15 bg-[#111916] px-4 text-white outline-none focus:border-emerald-400/45 disabled:opacity-50"
          >
            <option value="">
              {loadingPms
                ? "Cargando responsables..."
                : "Selecciona un responsable"}
            </option>
            {responsiblePms.map((pm) => (
              <option
                key={pm.email}
                value={pm.email}
              >
                {pm.name} — {pm.email}
              </option>
            ))}
          </select>
        </div>
      </div>

      {formError && (
        <p className="rounded-xl border border-red-400/25 bg-red-400/[0.08] px-4 py-3 text-sm text-red-100">
          {formError}
        </p>
      )}

      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <button
          type="button"
          onClick={onCancel}
          disabled={saving}
          className="min-h-11 rounded-xl border border-white/15 px-5 text-sm text-white/65 disabled:opacity-50"
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={saving}
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-emerald-400/30 bg-emerald-400/15 px-5 text-sm font-medium text-emerald-100 disabled:opacity-50"
        >
          {saving && (
            <LoaderCircle
              size={17}
              className="animate-spin"
            />
          )}
          {saving
            ? "Creando lote..."
            : "Crear lote"}
        </button>
      </div>
    </form>
  );
}
