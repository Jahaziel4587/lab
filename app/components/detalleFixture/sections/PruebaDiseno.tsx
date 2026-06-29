"use client";

import type {
  Dispatch,
  FormEvent,
  RefObject,
  SetStateAction,
} from "react";
import { useRouter } from "next/navigation";
import { FiCheck, FiLink } from "react-icons/fi";
import type { FixtureVersion, LinkedPedido } from "../types";
import { cardClass, inputClass, btnPrimary } from "../styles";
import FilePicker from "../components/FilePicker";
import VersionList from "../components/VersionList";

export default function PruebaDiseno({
  pruebas,
  linkedPedidos,
  isAdmin,
  loading,
  nextPruebaLabel,
  pruebaDesc,
  setPruebaDesc,
  pruebaFiles,
  setPruebaFiles,
  pruebaInputRef,
  addFiles,
  removeFile,
  onGuardarPrueba,
}: {
  pruebas: FixtureVersion[];
  linkedPedidos: LinkedPedido[];
  isAdmin: boolean;
  loading: boolean;
  nextPruebaLabel: string;
  pruebaDesc: string;
  setPruebaDesc: Dispatch<SetStateAction<string>>;
  pruebaFiles: File[];
  setPruebaFiles: Dispatch<SetStateAction<File[]>>;
  pruebaInputRef: RefObject<HTMLInputElement | null>;
  addFiles: (
    list: FileList | null,
    setter: Dispatch<SetStateAction<File[]>>,
    inputRef: RefObject<HTMLInputElement | null>
  ) => void;
  removeFile: (
    index: number,
    setter: Dispatch<SetStateAction<File[]>>
  ) => void;
  onGuardarPrueba: (e: FormEvent) => void;
}) {
  const router = useRouter();

  return (
    <section className={cardClass}>
      <h2 className="text-xl font-semibold">Prueba de diseño</h2>
      <p className="mt-1 text-sm text-white/55">
        Las piezas fabricadas para esta fase deben ser pedidos normales
        asociados a este fixture.
      </p>

      <div className="mt-5 rounded-2xl border border-white/10 bg-black/20 p-4">
        <h3 className="font-semibold text-white/90">
          Pedidos normales asociados
        </h3>

        {linkedPedidos.length === 0 ? (
          <p className="mt-2 text-sm text-white/55">
            Todavía no hay pedidos asociados a este fixture.
          </p>
        ) : (
          <ul className="mt-3 space-y-2">
            {linkedPedidos.map((p) => (
              <li key={p.id}>
                <button
                  onClick={() => router.push(`/solicitudes/listado/${p.id}`)}
                  className="inline-flex items-center gap-2 text-sm text-emerald-200 underline decoration-white/20 hover:text-emerald-100"
                >
                  <FiLink /> {p.titulo || p.id}{" "}
                  {p.subtotal ? `(MXN ${p.subtotal.toFixed(2)})` : ""}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {isAdmin && (
        <form onSubmit={onGuardarPrueba} className="mt-5 space-y-4">
          <div className="rounded-2xl border border-emerald-300/20 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-100">
            Nueva prueba: <strong>{nextPruebaLabel}</strong>
          </div>

          <textarea
            className={`${inputClass} min-h-[110px]`}
            value={pruebaDesc}
            onChange={(e) => setPruebaDesc(e.target.value)}
            placeholder="Describe la prueba, ensamble, funcionalidad observada y decisiones críticas..."
          />

          <FilePicker
            label="Adjuntar fotos o videos del ensamble / prueba"
            files={pruebaFiles}
            inputRef={pruebaInputRef}
            onChange={(list) => addFiles(list, setPruebaFiles, pruebaInputRef)}
            onRemove={(i) => removeFile(i, setPruebaFiles)}
            accept="image/*,video/*"
          />

          <button disabled={loading} className={btnPrimary}>
            <FiCheck /> Guardar prueba
          </button>
        </form>
      )}

      <VersionList title="Pruebas registradas" items={pruebas} />
    </section>
  );
}