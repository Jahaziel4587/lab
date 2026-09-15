"use client";

import {
  ChevronRight,
  LoaderCircle,
  Pencil,
  Plus,
  X,
} from "lucide-react";
import {
  FormEvent,
  useEffect,
  useState,
} from "react";

import type { CatalogListItem } from "./CatalogList";

type ProcessComponentListProps = {
  components: CatalogListItem[];
  loading?: boolean;
  saving?: boolean;
  error?: string | null;
  canEdit?: boolean;
  onSelect: (
    component: CatalogListItem,
  ) => void;
  onAdd: (
    title: string,
  ) => Promise<void>;
  onEdit: (
    componentId: string,
    title: string,
  ) => Promise<void>;
};

type FormMode =
  | {
      type: "add";
    }
  | {
      type: "edit";
      component: CatalogListItem;
    }
  | null;

export default function ProcessComponentList({
  components,
  loading = false,
  saving = false,
  error,
  canEdit = false,
  onSelect,
  onAdd,
  onEdit,
}: ProcessComponentListProps) {
  const [formMode, setFormMode] =
    useState<FormMode>(null);

  const [title, setTitle] =
    useState("");

  const [formError, setFormError] =
    useState("");

  useEffect(() => {
    if (formMode?.type === "edit") {
      setTitle(
        formMode.component.title,
      );
    } else {
      setTitle("");
    }

    setFormError("");
  }, [formMode]);

  const closeForm = () => {
    if (saving) {
      return;
    }

    setFormMode(null);
    setTitle("");
    setFormError("");
  };

  const handleSubmit = async (
    event: FormEvent<HTMLFormElement>,
  ) => {
    event.preventDefault();

    const cleanTitle = title
      .trim()
      .replace(/\s+/g, " ");

    if (!cleanTitle) {
      setFormError(
        "Escribe el nombre del componente.",
      );
      return;
    }

    try {
      setFormError("");

      if (formMode?.type === "edit") {
        await onEdit(
          formMode.component.id,
          cleanTitle,
        );
      } else {
        await onAdd(cleanTitle);
      }

      closeForm();
    } catch (submitError) {
      setFormError(
        submitError instanceof Error
          ? submitError.message
          : "No fue posible guardar el componente.",
      );
    }
  };

  return (
    <div>
      <div className="flex justify-end">
        <button
          type="button"
          onClick={() =>
            setFormMode({
              type: "add",
            })
          }
          className="inline-flex min-h-11 items-center
            justify-center gap-2 rounded-xl border
            border-emerald-400/30 bg-emerald-400/10
            px-5 py-2 text-sm font-medium text-emerald-200
            transition hover:bg-emerald-400/15"
        >
          <Plus size={17} />
          Agregar componente
        </button>
      </div>

      {error && (
        <div
          className="mt-5 rounded-2xl border
            border-red-400/20 bg-red-400/[0.06]
            p-4 text-sm text-red-100/80"
        >
          {error}
        </div>
      )}

      {loading ? (
        <div
          className="mt-5 flex min-h-32 items-center
            justify-center rounded-2xl border
            border-white/10 bg-black/15"
        >
          <LoaderCircle
            size={23}
            className="animate-spin text-emerald-300"
          />

          <span className="ml-3 text-sm text-white/55">
            Cargando componentes...
          </span>
        </div>
      ) : (
        <div className="mt-5 space-y-3">
          {components.length === 0 ? (
            <div
              className="rounded-2xl border
                border-dashed border-white/15
                bg-white/[0.025] p-7 text-center"
            >
              <p className="text-sm text-white/55">
                Esta WI todavía no tiene componentes
                de proceso registrados.
              </p>

              <button
                type="button"
                onClick={() =>
                  setFormMode({
                    type: "add",
                  })
                }
                className="mt-4 text-sm font-medium
                  text-emerald-300 transition
                  hover:text-emerald-200"
              >
                Agregar el primer componente
              </button>
            </div>
          ) : (
            components.map((component) => (
              <div
                key={component.id}
                className="group flex items-center
                  rounded-2xl border border-white/10
                  bg-white/[0.035] transition
                  hover:border-emerald-400/25
                  hover:bg-emerald-400/[0.055]"
              >
                <button
                  type="button"
                  onClick={() =>
                    onSelect(component)
                  }
                  className="flex min-h-20 flex-1
                    items-center justify-between
                    gap-4 px-5 py-4 text-left"
                >
                  <div>
                    <p
                      className="font-medium
                        text-white"
                    >
                      {component.title}
                    </p>

                    {component.description && (
                      <p
                        className="mt-1 text-sm
                          text-white/50"
                      >
                        {component.description}
                      </p>
                    )}
                  </div>

                  <ChevronRight
                    size={19}
                    className="shrink-0 text-white/40
                      transition group-hover:translate-x-0.5
                      group-hover:text-emerald-300"
                  />
                </button>

                {canEdit && (
                  <button
                    type="button"
                    title="Editar título"
                    aria-label={
                      `Editar ${component.title}`
                    }
                    onClick={() =>
                      setFormMode({
                        type: "edit",
                        component,
                      })
                    }
                    className="mr-4 inline-flex h-10 w-10
                      shrink-0 items-center justify-center
                      rounded-xl border border-white/10
                      bg-white/[0.04] text-white/55
                      transition hover:border-emerald-400/25
                      hover:bg-emerald-400/10
                      hover:text-emerald-200"
                  >
                    <Pencil size={16} />
                  </button>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {formMode && (
        <div
          className="fixed inset-0 z-[100]
            flex items-center justify-center
            bg-black/75 p-4 backdrop-blur-sm"
          onMouseDown={(event) => {
            if (
              event.target === event.currentTarget
            ) {
              closeForm();
            }
          }}
        >
          <div
            className="w-full max-w-md rounded-3xl
              border border-white/15 bg-[#111816]
              p-6 shadow-2xl"
          >
            <div
              className="flex items-start
                justify-between gap-4"
            >
              <div>
                <p
                  className="text-xs font-semibold
                    uppercase tracking-[0.2em]
                    text-emerald-300"
                >
                  Componente de proceso
                </p>

                <h2
                  className="mt-2 text-xl
                    font-semibold text-white"
                >
                  {formMode.type === "edit"
                    ? "Editar componente"
                    : "Agregar componente"}
                </h2>
              </div>

              <button
                type="button"
                onClick={closeForm}
                disabled={saving}
                className="inline-flex h-10 w-10
                  items-center justify-center rounded-xl
                  border border-white/10 text-white/55
                  transition hover:bg-white/10
                  hover:text-white disabled:opacity-40"
              >
                <X size={18} />
              </button>
            </div>

            <form
              onSubmit={handleSubmit}
              className="mt-6"
            >
              <label
                htmlFor="process-component-title"
                className="text-sm font-medium
                  text-white/75"
              >
                Nombre del componente
              </label>

              <input
                id="process-component-title"
                value={title}
                onChange={(event) => {
                  setTitle(event.target.value);
                  setFormError("");
                }}
                placeholder="Ej. Carcasa superior"
                autoFocus
                disabled={saving}
                className="mt-2 min-h-12 w-full
                  rounded-xl border border-white/15
                  bg-black/25 px-4 text-white
                  outline-none transition
                  placeholder:text-white/30
                  focus:border-emerald-400/45
                  focus:ring-2
                  focus:ring-emerald-400/10
                  disabled:opacity-50"
              />

              {formError && (
                <p
                  className="mt-2 text-sm
                    text-red-300"
                >
                  {formError}
                </p>
              )}

              <div
                className="mt-6 flex
                  justify-end gap-3"
              >
                <button
                  type="button"
                  onClick={closeForm}
                  disabled={saving}
                  className="min-h-11 rounded-xl
                    border border-white/10
                    px-4 text-sm text-white/65
                    transition hover:bg-white/5
                    disabled:opacity-40"
                >
                  Cancelar
                </button>

                <button
                  type="submit"
                  disabled={
                    saving ||
                    !title.trim()
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
                  {saving && (
                    <LoaderCircle
                      size={17}
                      className="animate-spin"
                    />
                  )}

                  {formMode.type === "edit"
                    ? "Guardar cambios"
                    : "Crear componente"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}