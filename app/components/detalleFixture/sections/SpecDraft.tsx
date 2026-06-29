"use client";

import { FiFileText } from "react-icons/fi";
import { cardClass, btnPrimary } from "../styles";

export default function SpecDraft({
  specDraftGenerada,
  loading,
  isAdmin,
  onGenerarSpecDraft,
}: {
  specDraftGenerada: boolean;
  loading: boolean;
  isAdmin: boolean;
  onGenerarSpecDraft: () => void;
}) {
  return (
    <section className={cardClass}>
      <h2 className="text-xl font-semibold">Spec Draft</h2>
      <p className="mt-1 text-sm text-white/55">
        Se genera cuando la confirmación conceptual queda aprobada. Será la guía
        para la versión beta.
      </p>

      {specDraftGenerada && (
        <div className="mt-5 rounded-2xl border border-emerald-300/20 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-100">
          Spec Draft registrada para este pedido.
        </div>
      )}

      <div className="mt-5 flex flex-wrap gap-3">
        <button
          onClick={onGenerarSpecDraft}
          disabled={loading || !isAdmin}
          className={btnPrimary}
        >
          <FiFileText /> Registrar Spec Draft
        </button>
      </div>
    </section>
  );
}