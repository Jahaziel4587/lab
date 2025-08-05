"use client";

export default function FilamentoPage() {
  return (
    <div className="min-h-screen bg-white text-gray-900 px-6 py-20">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-3xl font-bold mb-6 text-blue-700">Impresión en Filamento</h1>

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
