"use client";

export default function FilamentoPage() {
  return (
     <div className="min-h-screen text-white px-6 py-20">
  <div className="max-w-4xl mx-auto bg-black rounded-lg p-8 shadow-lg">
        {/* Botón de regreso */}
      <div className="max-w-6xl mx-auto mb-6">
        <button
          onClick={() => window.history.back()}
          className="mb-4 bg-white text-black px-4 py-2 rounded flex items-center gap-2 "
        >
          ← Regresar
        </button>
      </div>

        <h1 className="text-3xl font-bold mb-6 text-black-700">Impresión en Filamento</h1>

        <p className="mb-6">
          La impresión FDM permite crear piezas resistentes, económicas y funcionales con diferentes propiedades.
        </p>

        <h2 className="text-xl font-semibold mb-3">Materiales disponibles:</h2>
        <ul className="list-disc list-inside space-y-2">
          <li><strong>PLA:</strong> Fácil de imprimir, biodegradable, ideal para piezas no estructurales y prototipos.</li>
          <li><strong>TPU:</strong> Filamento flexible con buena resistencia a la abrasión, útil para protectores o piezas elásticas.</li>
          <li><strong>ABS:</strong> Más resistente al calor que PLA, adecuado para piezas mecánicas o funcionales.</li>
        </ul>
      </div>
    </div>
  );
}
