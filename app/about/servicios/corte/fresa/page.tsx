"use client";

export default function FresaPage() {
  return (
    <div className="min-h-screen text-white px-6 py-20">
  <div className="max-w-4xl mx-auto bg-black rounded-lg p-8 shadow-lg">
 {/* Botón de regreso */}
      <div className="max-w-6xl mx-auto mb-6">
        <button
          onClick={() => window.history.back()}
          className="mb-4 bg-white text-black px-4 py-2 rounded flex items-center gap-2 hover:bg-white-800"
        >
          ← Regresar
        </button>
      </div>
      <h1 className="text-2xl font-bold mb-4">Corte con Fresa</h1>
      <p className="mb-2">
        El corte con fresa es un proceso de mecanizado utilizado para trabajar materiales más duros
        como madera gruesa, plásticos resistentes y metales suaves. Utiliza herramientas rotativas para
        realizar cortes precisos y profundos.
      </p>
      <ul className="list-disc pl-5">
        <li>Ideal para cortes tridimensionales y estructurales</li>
        <li>Alta potencia para materiales gruesos</li>
        <li>Materiales compatibles: madera, PVC, acrílico grueso, aluminio suave</li>
      </ul>
    </div>
    </div>
  );
}