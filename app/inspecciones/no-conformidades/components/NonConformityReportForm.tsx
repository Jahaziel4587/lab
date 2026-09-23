"use client";

import {
  ChangeEvent,
  FormEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  Camera,
  Images,
  LoaderCircle,
  Plus,
  Trash2,
} from "lucide-react";

import type {
  AddNonConformityReportInput,
} from "../types";

type NonConformityReportFormProps = {
  lotName: string;
  sampleQuantity: number;

  existingSampleNumbers:
    number[];

  saving?: boolean;

  onSubmit: (
    input:
      AddNonConformityReportInput,
  ) => Promise<void>;

  onCancel: () => void;
};

function buildFileKey(
  file: File,
) {
  return (
    `${file.name}-` +
    `${file.size}-` +
    `${file.lastModified}`
  );
}

export default function NonConformityReportForm({
  lotName,
  sampleQuantity,
  existingSampleNumbers,
  saving = false,
  onSubmit,
  onCancel,
}: NonConformityReportFormProps) {
  const cameraInputReference =
    useRef<HTMLInputElement | null>(
      null,
    );

  const galleryInputReference =
    useRef<HTMLInputElement | null>(
      null,
    );

  const [
    sampleNumber,
    setSampleNumber,
  ] = useState("");

  const [
    description,
    setDescription,
  ] = useState("");

  const [photos, setPhotos] =
    useState<File[]>([]);

  const [
    formError,
    setFormError,
  ] = useState("");

  /*
   * Genera vistas previas locales.
   * Todavía no se suben a Firebase.
   */
  const photoPreviews =
    useMemo(
      () =>
        photos.map((photo) => ({
          file: photo,
          url:
            URL.createObjectURL(
              photo,
            ),
        })),
      [photos],
    );

  /*
   * Libera las URL temporales cuando
   * cambian las fotografías o se
   * desmonta el formulario.
   */
  useEffect(() => {
    return () => {
      photoPreviews.forEach(
        (preview) => {
          URL.revokeObjectURL(
            preview.url,
          );
        },
      );
    };
  }, [photoPreviews]);

  const addPhotos = (
    selectedFiles: File[],
  ) => {
    const validImages =
      selectedFiles.filter(
        (file) =>
          file.type.startsWith(
            "image/",
          ),
      );

    if (
      validImages.length !==
      selectedFiles.length
    ) {
      setFormError(
        "Solo se pueden adjuntar archivos de imagen.",
      );
    } else {
      setFormError("");
    }

    setPhotos((current) => {
      const existingKeys =
        new Set(
          current.map(
            buildFileKey,
          ),
        );

      const newPhotos =
        validImages.filter(
          (file) => {
            const key =
              buildFileKey(file);

            if (
              existingKeys.has(key)
            ) {
              return false;
            }

            existingKeys.add(key);
            return true;
          },
        );

      return [
        ...current,
        ...newPhotos,
      ];
    });
  };

  const handleCameraPhoto = (
    event:
      ChangeEvent<HTMLInputElement>,
  ) => {
    addPhotos(
      Array.from(
        event.target.files || [],
      ),
    );

    event.target.value = "";
  };

  const handleGalleryPhotos = (
    event:
      ChangeEvent<HTMLInputElement>,
  ) => {
    addPhotos(
      Array.from(
        event.target.files || [],
      ),
    );

    event.target.value = "";
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

    setFormError("");
  };

  const handleSubmit = async (
    event:
      FormEvent<HTMLFormElement>,
  ) => {
    event.preventDefault();

    const parsedSampleNumber =
      Number(sampleNumber);

    if (
      !Number.isInteger(
        parsedSampleNumber,
      )
    ) {
      setFormError(
        "Agrega un número de muestra válido.",
      );
      return;
    }

    if (
      parsedSampleNumber < 1 ||
      parsedSampleNumber >
        sampleQuantity
    ) {
      setFormError(
        "El número de muestra debe estar entre 1 y " +
          `${sampleQuantity}.`,
      );
      return;
    }

    if (
      existingSampleNumbers.includes(
        parsedSampleNumber,
      )
    ) {
      setFormError(
        `La muestra ${parsedSampleNumber} ` +
          "ya tiene un rechazo por SPEC registrado.",
      );
      return;
    }

    const cleanDescription =
      description.trim();

    if (!cleanDescription) {
      setFormError(
        "Agrega la descripción del rechazo por SPEC.",
      );
      return;
    }

    try {
      setFormError("");

      await onSubmit({
        sampleNumber:
          parsedSampleNumber,

        description:
          cleanDescription,

        photos,
      });
    } catch (submitError) {
      setFormError(
        submitError instanceof Error
          ? submitError.message
          : "No fue posible guardar la muestra rechazada.",
      );
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-6"
    >
      <div
        className="rounded-2xl border
          border-amber-400/20
          bg-amber-400/[0.06]
          p-4 sm:p-5"
      >
        <p
          className="text-xs
            font-semibold uppercase
            tracking-[0.18em]
            text-amber-200"
        >
          Registrar rechazo por SPEC
        </p>

        <h2
          className="mt-2
            break-words text-lg
            font-semibold text-white"
        >
          {lotName}
        </h2>

        <p
          className="mt-2 text-sm
            leading-relaxed
            text-white/55"
        >
          Cantidad inspeccionada registrada:{" "}
          {sampleQuantity}{" "}
          {sampleQuantity === 1
            ? "pieza"
            : "piezas"}.
        </p>
      </div>

      <div>
        <label
          htmlFor="nonconformity-sample-number"
          className="text-sm
            font-medium text-white/75"
        >
          Número de muestra rechazada
        </label>

        <input
          id="nonconformity-sample-number"
          type="number"
          min="1"
          max={sampleQuantity}
          step="1"
          inputMode="numeric"
          value={sampleNumber}
          onChange={(event) => {
            setSampleNumber(
              event.target.value,
            );

            setFormError("");
          }}
          disabled={saving}
          placeholder={
            `Número del 1 al ` +
            `${sampleQuantity}`
          }
          className="mt-2 min-h-12
            w-full rounded-xl border
            border-white/15
            bg-black/25 px-4
            text-white outline-none
            transition
            placeholder:text-white/30
            focus:border-emerald-400/45
            focus:ring-2
            focus:ring-emerald-400/10
            disabled:opacity-50"
        />

        <p
          className="mt-2 text-xs
            leading-relaxed
            text-white/40"
        >
          Indica qué muestra específica
          dentro del lote no cumplió con
          la especificación.
        </p>
      </div>

      <div>
        <label
          htmlFor="nonconformity-description"
          className="text-sm
            font-medium text-white/75"
        >
          Descripción del rechazo por SPEC
        </label>

        <textarea
          id="nonconformity-description"
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
            "Describe qué requisito no cumplió la muestra y qué se observó."
          }
          className="mt-2 w-full
            resize-y rounded-2xl
            border border-white/15
            bg-black/25 px-4 py-3
            text-white outline-none
            transition
            placeholder:text-white/30
            focus:border-emerald-400/45
            focus:ring-2
            focus:ring-emerald-400/10
            disabled:opacity-50"
        />
      </div>

      <div>
        <p
          className="text-sm
            font-medium text-white/75"
        >
          Evidencia fotográfica (opcional)
        </p>

        <p
          className="mt-1 text-xs
            leading-relaxed
            text-white/40"
        >
          Si es necesario, puedes tomar fotografías con
          la cámara o seleccionar varias
          desde el dispositivo.
        </p>

        <input
          ref={cameraInputReference}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={
            handleCameraPhoto
          }
          disabled={saving}
          className="hidden"
        />

        <input
          ref={galleryInputReference}
          type="file"
          accept="image/*"
          multiple
          onChange={
            handleGalleryPhotos
          }
          disabled={saving}
          className="hidden"
        />

        <div
          className="mt-4 grid
            grid-cols-1 gap-3
            sm:grid-cols-2"
        >
          <button
            type="button"
            onClick={() =>
              cameraInputReference
                .current
                ?.click()
            }
            disabled={saving}
            className="inline-flex
              min-h-12 items-center
              justify-center gap-2
              rounded-xl border
              border-emerald-400/25
              bg-emerald-400/[0.07]
              px-4 text-sm font-medium
              text-emerald-200
              transition
              hover:bg-emerald-400/10
              disabled:cursor-not-allowed
              disabled:opacity-50"
          >
            <Camera size={18} />
            Tomar fotografía
          </button>

          <button
            type="button"
            onClick={() =>
              galleryInputReference
                .current
                ?.click()
            }
            disabled={saving}
            className="inline-flex
              min-h-12 items-center
              justify-center gap-2
              rounded-xl border
              border-white/15
              bg-white/[0.04]
              px-4 text-sm font-medium
              text-white/70
              transition
              hover:bg-white/[0.08]
              disabled:cursor-not-allowed
              disabled:opacity-50"
          >
            <Images size={18} />
            Seleccionar imágenes
          </button>
        </div>
      </div>

      {photoPreviews.length > 0 && (
        <div>
          <div
            className="flex items-center
              justify-between gap-4"
          >
            <p
              className="text-sm
                font-medium
                text-white/70"
            >
              Fotografías seleccionadas
            </p>

            <span
              className="rounded-full
                border border-white/10
                bg-white/[0.04]
                px-2.5 py-1
                text-xs text-white/45"
            >
              {photoPreviews.length}
            </span>
          </div>

          <div
            className="mt-3 grid
              grid-cols-2 gap-3
              sm:grid-cols-3"
          >
            {photoPreviews.map(
              (
                preview,
                index,
              ) => (
                <div
                  key={
                    buildFileKey(
                      preview.file,
                    )
                  }
                  className="group
                    overflow-hidden
                    rounded-2xl border
                    border-white/10
                    bg-black/20"
                >
                  <div
                    className="relative
                      aspect-square
                      overflow-hidden
                      bg-black/30"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={preview.url}
                      alt={
                        `Evidencia ` +
                        `${index + 1}`
                      }
                      className="h-full
                        w-full object-cover"
                    />

                    <button
                      type="button"
                      aria-label={
                        "Eliminar fotografía"
                      }
                      onClick={() =>
                        removePhoto(index)
                      }
                      disabled={saving}
                      className="absolute
                        right-2 top-2
                        flex h-9 w-9
                        items-center
                        justify-center
                        rounded-xl border
                        border-white/15
                        bg-black/70
                        text-white/70
                        backdrop-blur
                        transition
                        hover:bg-red-500/80
                        hover:text-white
                        disabled:opacity-50"
                    >
                      <Trash2
                        size={16}
                      />
                    </button>
                  </div>

                  <p
                    className="truncate
                      px-3 py-2
                      text-xs
                      text-white/45"
                    title={
                      preview.file.name
                    }
                  >
                    {preview.file.name}
                  </p>
                </div>
              ),
            )}
          </div>
        </div>
      )}

      {formError && (
        <div
          role="alert"
          className="rounded-xl
            border border-red-400/25
            bg-red-400/[0.08]
            px-4 py-3 text-sm
            text-red-100"
        >
          {formError}
        </div>
      )}

      <div
        className="flex flex-col-reverse
          gap-3 sm:flex-row
          sm:justify-end"
      >
        <button
          type="button"
          onClick={onCancel}
          disabled={saving}
          className="min-h-11
            rounded-xl border
            border-white/15
            bg-white/[0.04]
            px-5 text-sm font-medium
            text-white/70 transition
            hover:bg-white/[0.08]
            disabled:cursor-not-allowed
            disabled:opacity-50"
        >
          Cancelar
        </button>

        <button
          type="submit"
          disabled={saving}
          className="inline-flex
            min-h-11 items-center
            justify-center gap-2
            rounded-xl border
            border-emerald-400/30
            bg-emerald-400/10
            px-5 text-sm font-medium
            text-emerald-200
            transition
            hover:bg-emerald-400/15
            disabled:cursor-not-allowed
            disabled:opacity-50"
        >
          {saving ? (
            <>
              <LoaderCircle
                size={17}
                className="animate-spin"
              />

              Guardando...
            </>
          ) : (
            <>
              <Plus size={17} />
              Registrar muestra
            </>
          )}
        </button>
      </div>
    </form>
  );
}
