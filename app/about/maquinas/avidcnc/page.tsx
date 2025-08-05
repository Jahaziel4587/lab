"use client";

export default function avidcncPage() {
  return (
    <div className="min-h-screen bg-white text-gray-900 px-6 py-20">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-6">avidcnc</h1>

        <p className="mb-6">
          La Lasermex es una cortadora láser de alta precisión, ideal para cortar y grabar materiales como acrílico, madera y MDF.
        </p>

        <h2 className="text-xl font-semibold mb-2">Materiales disponibles:</h2>
        <ul className="list-disc list-inside space-y-1">
          <li>Acrílico 3mm y 5mm</li>
          <li>MDF 3mm y 6mm</li>
          <li>Madera contrachapada</li>
        </ul>
      </div>
    </div>
  );
}
