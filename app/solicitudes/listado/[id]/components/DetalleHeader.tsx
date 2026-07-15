"use client";

import { FiArrowLeft } from "react-icons/fi";
import { btnGhost } from "../styles";

type Props = {
  id: string;
  onBack: () => void;
};

export default function DetalleHeader({ id, onBack }: Props) {
  return (
    <>
      <div className="flex items-center justify-between">
        <button onClick={onBack} className={btnGhost}>
          <FiArrowLeft /> Regresar
        </button>
      </div>

      <div className="mt-6">
        <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-white/95">
          Detalles del pedido
        </h1>

        <div className="mt-2 text-sm text-white/60">
          <span className="text-white/75">ID:</span>{" "}
          <span className="font-semibold text-white/85 break-all">{id}</span>
        </div>
      </div>
    </>
  );
}