"use client";

import { FiFileText } from "react-icons/fi";
import { cardClass, btnPrimary } from "../styles";

export default function SpecFinal({
  specFinalGenerada,
  loading,
  isAdmin,
  onGenerarSpecFinal,
}: {
  specFinalGenerada: boolean;
  loading: boolean;
  isAdmin: boolean;
  onGenerarSpecFinal: () => void;
}) {
  return (
    <section className={cardClass}>
      <h2 className="text-xl font-semibold">Spec Final y validación</h2>
      <p className="mt-1 text-sm text-white/55">
        La SPEC final se redacta en formato QMS y se valida por el encargado.
      </p>

      {specFinalGenerada && (
        <div className="mt-5 rounded-2xl border border-emerald-300/20 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-100">
          Spec Final registrada para este pedido.
        </div>
      )}

      <div className="mt-5 flex flex-wrap gap-3">
        <button
          onClick={onGenerarSpecFinal}
          disabled={loading || !isAdmin}
          className={btnPrimary}
        >
          <FiFileText /> Registrar Spec Final
        </button>
      </div>
    </section>
  );
}