"use client";

import { useState } from "react";
import { FiDownload, FiFileText } from "react-icons/fi";
import { cardClass, btnPrimary } from "../styles";

export default function SpecDraft({
  pedidoId,
  specDraftGenerada,
  loading,
  isAdmin,
  onGenerarSpecDraft,
}: {
  pedidoId: string;
  specDraftGenerada: boolean;
  loading: boolean;
  isAdmin: boolean;
  onGenerarSpecDraft: () => Promise<void> | void;
}) {
  const [generandoDocx, setGenerandoDocx] = useState(false);

  const descargarDocx = async () => {
    try {
      setGenerandoDocx(true);

      // Registra Spec Draft si aún no existe
      if (!specDraftGenerada) {
        await onGenerarSpecDraft();
      }

      const response = await fetch(
        `/api/fixtures/${pedidoId}/spec-draft-docx`,
        {
          method: "POST",
        }
      );

      if (!response.ok) {
        throw new Error("No se pudo generar el documento.");
      }

      const blob = await response.blob();

      const url = window.URL.createObjectURL(blob);

      const a = document.createElement("a");
      a.href = url;
      a.download = "Spec Draft.docx";
      document.body.appendChild(a);
      a.click();
      a.remove();

      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error(err);
      alert("No se pudo generar el Spec Draft.");
    } finally {
      setGenerandoDocx(false);
    }
  };

  return (
    <section className={cardClass}>
      <h2 className="text-xl font-semibold">
        Spec Draft
      </h2>

      <p className="mt-1 text-sm text-white/55">
        Se genera cuando la confirmación conceptual queda aprobada y será la
        guía para el desarrollo de la versión Beta.
      </p>

      {specDraftGenerada && (
        <div className="mt-5 rounded-2xl border border-emerald-300/20 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-100">
          ✓ Spec Draft registrada para este pedido.
        </div>
      )}

      <div className="mt-6 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={descargarDocx}
          disabled={loading || generandoDocx || !isAdmin}
          className={btnPrimary}
        >
          {specDraftGenerada ? (
            <>
              <FiDownload />
              {generandoDocx
                ? "Generando DOCX..."
                : "Descargar Spec Draft"}
            </>
          ) : (
            <>
              <FiFileText />
              {generandoDocx
                ? "Generando DOCX..."
                : "Generar Spec Draft"}
            </>
          )}
        </button>
      </div>
    </section>
  );
}