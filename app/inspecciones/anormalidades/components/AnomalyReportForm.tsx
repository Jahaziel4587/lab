"use client";

import {
  Camera,
  FileImage,
  LoaderCircle,
  Send,
  Trash2,
} from "lucide-react";
import {
  ChangeEvent,
  FormEvent,
  useRef,
  useState,
} from "react";

import type {
  NewAnomalyReportInput,
  ResponsiblePm,
} from "../hooks/useAnomalies";

type AnomalyReportFormProps = {
  responsiblePms: ResponsiblePm[];
  loadingPms?: boolean;
  saving?: boolean;
  onSubmit: (
    input: NewAnomalyReportInput,
  ) => Promise<void>;
  onCancel: () => void;
};

export default function AnomalyReportForm({
  responsiblePms,
  loadingPms = false,
  saving = false,
  onSubmit,
  onCancel,
}: AnomalyReportFormProps) {
  const fileInputReference =
    useRef<HTMLInputElement | null>(
      null,
    );

  const [description, setDescription] =
    useState("");

  const [lot, setLot] =
    useState("");

  const [
    affectedQuantity,
    setAffectedQuantity,
  ] = useState("");

  const [
    sampleQuantity,
    setSampleQuantity,
  ] = useState("");

  const [
    responsiblePmEmail,
    setResponsiblePmEmail,
  ] = useState("");

  const [photos, setPhotos] =
    useState<File[]>([]);

  const [formError, setFormError] =
    useState("");

  const handlePhotos = (
    event:
      ChangeEvent<HTMLInputElement>,
  ) => {
    const selectedFiles =
      Array.from(
        event.target.files || [],
      );

    setPhotos((current) => {
      const existingFiles =
        new Set(
          current.map(
            (file) =>
              `${file.name}-${file.size}-${file.lastModified}`,
          ),
        );

      const newFiles =
        selectedFiles.filter(
          (file) => {
            const key =
              `${file.name}-${file.size}-${file.lastModified}`;

            if (
              existingFiles.has(key)
            ) {
              return false;
            }

            existingFiles.add(key);
            return true;
          },
        );

      return [
        ...current,
        ...newFiles,
      ];
    });

    event.target.value = "";
    setFormError("");
  };

  const removePhoto = (
    index: number,
  ) => {
    setPhotos((current) =>
      current.filter(
        (_, currentIndex) =>
          currentIndex !== index,
      ),
    );
  };

  const handleSubmit = async (
    event:
      FormEvent<HTMLFormElement>,
  ) => {
    event.preventDefault();

    const responsiblePm =
      responsiblePms.find(
        (pm) =>
          pm.email ===
          responsiblePmEmail,
      );

    if (!description.trim()) {
      setFormError(
        "Agrega una descripción.",
      );
      return;
    }

    if (!lot.trim()) {
      setFormError(
        "Agrega el lote.",
      );
      return;
    }

    const affected =
      Number(affectedQuantity);

    const sample =
      Number(sampleQuantity);

    if (
      !Number.isInteger(affected) ||
      affected < 1
    ) {
      setFormError(
        "El número de muestra debe ser mayor a cero.",
      );
      return;
    }

    if (
      !Number.isInteger(sample) ||
      sample < 1
    ) {
      setFormError(
        "La cantidad de la muestra debe ser mayor a cero.",
      );
      return;
    }

    if (affected > sample) {
      setFormError(
        "El número de muestra no puede superar el tamaño de la muestra.",
      );
      return;
    }

    if (photos.length === 0) {
      setFormError(
        "Agrega al menos una fotografía.",
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
        description:
          description.trim(),
        lot:
          lot.trim(),
        affectedQuantity:
          affected,
        sampleQuantity:
          sample,
        photos,
        responsiblePm,
      });
    } catch (submitError) {
      setFormError(
        submitError instanceof Error
          ? submitError.message
          : "No fue posible enviar el reporte.",
      );
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-6"
    >
      <div>
        <label
          htmlFor="anomaly-description"
          className="text-sm font-medium
            text-white/75"
        >
          Descripción
        </label>

        <textarea
          id="anomaly-description"
          value={description}
          onChange={(event) => {
            setDescription(
              event.target.value,
            );
            setFormError("");
          }}
          rows={5}
          disabled={saving}
          placeholder={
            "Describe claramente la anormalidad observada."
          }
          className="mt-2 w-full resize-y
            rounded-2xl border
            border-white/15 bg-black/25
            px-4 py-3 text-white
            outline-none transition
            placeholder:text-white/30
            focus:border-emerald-400/45
            focus:ring-2
            focus:ring-emerald-400/10
            disabled:opacity-50"
        />
      </div>

      <div
        className="grid grid-cols-1
          gap-4 sm:grid-cols-3"
      >
        <div>
          <label
            htmlFor="anomaly-affected"
            className="text-sm font-medium
              text-white/75"
          >
            # de muestra
          </label>

          <input
            id="anomaly-affected"
            type="number"
            min="1"
            step="1"
            value={affectedQuantity}
            onChange={(event) => {
              setAffectedQuantity(
                event.target.value,
              );
              setFormError("");
            }}
            disabled={saving}
              placeholder="Ej. 15"
            className="mt-2 min-h-12
              w-full rounded-xl border
              border-white/15 bg-black/25
              px-4 text-white outline-none
              transition placeholder:text-white/30
              focus:border-emerald-400/45
              focus:ring-2
              focus:ring-emerald-400/10
              disabled:opacity-50"
          />
        </div>

        <div>
          <label
            htmlFor="anomaly-sample"
            className="text-sm font-medium
              text-white/75"
          >
            Tamaño de muestra
          </label>

          <input
            id="anomaly-sample"
            type="number"
            min="1"
            step="1"
            value={sampleQuantity}
            onChange={(event) => {
              setSampleQuantity(
                event.target.value,
              );
              setFormError("");
            }}
            disabled={saving}
            placeholder="Ej. 20"
            className="mt-2 min-h-12
              w-full rounded-xl border
              border-white/15 bg-black/25
              px-4 text-white outline-none
              transition placeholder:text-white/30
              focus:border-emerald-400/45
              focus:ring-2
              focus:ring-emerald-400/10
              disabled:opacity-50"
          />
        </div>

        <div>
          <label
            htmlFor="anomaly-lot"
            className="text-sm font-medium
              text-white/75"
          >
            Lote
          </label>

          <input
            id="anomaly-lot"
            value={lot}
            onChange={(event) => {
              setLot(
                event.target.value,
              );
              setFormError("");
            }}
            disabled={saving}
            placeholder="Ej. LOT-2026-015"
            className="mt-2 min-h-12
              w-full rounded-xl border
              border-white/15 bg-black/25
              px-4 text-white outline-none
              transition placeholder:text-white/30
              focus:border-emerald-400/45
              focus:ring-2
              focus:ring-emerald-400/10
              disabled:opacity-50"
          />
        </div>
      </div>

      <div>
        <label
          htmlFor="anomaly-pm"
          className="text-sm font-medium
            text-white/75"
        >
          PM responsable
        </label>

        <select
          id="anomaly-pm"
          value={responsiblePmEmail}
          onChange={(event) => {
            setResponsiblePmEmail(
              event.target.value,
            );
            setFormError("");
          }}
          disabled={
            saving ||
            loadingPms
          }
          className="mt-2 min-h-12
            w-full rounded-xl border
            border-white/15 bg-[#111816]
            px-4 text-white outline-none
            transition focus:border-emerald-400/45
            focus:ring-2
            focus:ring-emerald-400/10
            disabled:opacity-50"
        >
          <option value="">
            {loadingPms
              ? "Cargando responsables..."
              : "Selecciona un responsable"}
          </option>

          {responsiblePms.map(
            (pm) => (
              <option
                key={pm.email}
                value={pm.email}
              >
                {pm.name} — {pm.email}
              </option>
            ),
          )}
        </select>

        {!loadingPms &&
          responsiblePms.length === 0 && (
            <p
              className="mt-2 text-sm
                text-amber-200/75"
            >
              No se encontraron usuarios PM
              asignados a este proyecto.
            </p>
          )}
      </div>

      <div>
        <div
          className="flex flex-wrap
            items-center justify-between
            gap-3"
        >
          <div>
            <p
              className="text-sm font-medium
                text-white/75"
            >
              Fotografías
            </p>

            <p
              className="mt-1 text-xs
                text-white/40"
            >
              Puedes seleccionar o tomar
              varias fotografías.
            </p>
          </div>

          <button
            type="button"
            onClick={() =>
              fileInputReference
                .current
                ?.click()
            }
            disabled={saving}
            className="inline-flex min-h-11
              items-center justify-center gap-2
              rounded-xl border
              border-emerald-400/30
              bg-emerald-400/10 px-4
              text-sm font-medium
              text-emerald-200 transition
              hover:bg-emerald-400/15
              disabled:opacity-40"
          >
            <Camera size={17} />
            Agregar fotos
          </button>

          <input
            ref={fileInputReference}
            type="file"
            accept="image/*"
            multiple
            onChange={handlePhotos}
            className="hidden"
          />
        </div>

        {photos.length > 0 && (
          <div
            className="mt-4 space-y-2"
          >
            {photos.map(
              (photo, index) => (
                <div
                  key={
                    `${photo.name}-${photo.lastModified}`
                  }
                  className="flex items-center
                    justify-between gap-3
                    rounded-xl border
                    border-white/10
                    bg-white/[0.035]
                    px-4 py-3"
                >
                  <div
                    className="flex min-w-0
                      items-center gap-3"
                  >
                    <FileImage
                      size={18}
                      className="shrink-0
                        text-emerald-300"
                    />

                    <div className="min-w-0">
                      <p
                        className="truncate
                          text-sm text-white/80"
                      >
                        {photo.name}
                      </p>

                      <p
                        className="mt-0.5 text-xs
                          text-white/35"
                      >
                        {(
                          photo.size /
                          1024 /
                          1024
                        ).toFixed(2)}{" "}
                        MB
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() =>
                      removePhoto(index)
                    }
                    disabled={saving}
                    aria-label={
                      `Eliminar ${photo.name}`
                    }
                    className="inline-flex h-9 w-9
                      shrink-0 items-center
                      justify-center rounded-lg
                      text-white/45 transition
                      hover:bg-red-400/10
                      hover:text-red-300
                      disabled:opacity-40"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ),
            )}
          </div>
        )}
      </div>

      {formError && (
        <div
          className="rounded-xl border
            border-red-400/20
            bg-red-400/[0.06]
            px-4 py-3 text-sm
            text-red-200"
        >
          {formError}
        </div>
      )}

      <div
        className="flex flex-col-reverse
          gap-3 border-t
          border-white/10 pt-5
          sm:flex-row sm:justify-end"
      >
        <button
          type="button"
          onClick={onCancel}
          disabled={saving}
          className="min-h-11 rounded-xl
            border border-white/10
            px-5 text-sm text-white/65
            transition hover:bg-white/5
            disabled:opacity-40"
        >
          Cancelar
        </button>

        <button
          type="submit"
          disabled={
            saving ||
            loadingPms ||
            responsiblePms.length === 0
          }
          className="inline-flex min-h-11
            items-center justify-center gap-2
            rounded-xl border
            border-emerald-400/30
            bg-emerald-400/15 px-5
            text-sm font-medium
            text-emerald-100 transition
            hover:bg-emerald-400/20
            disabled:cursor-not-allowed
            disabled:opacity-40"
        >
          {saving ? (
            <LoaderCircle
              size={17}
              className="animate-spin"
            />
          ) : (
            <Send size={17} />
          )}

          {saving
            ? "Guardando..."
            : "Enviar al responsable"}
        </button>
      </div>
    </form>
  );
}
