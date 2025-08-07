"use client";

export default function LaserPage() {
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
    
      <h1 className="text-2xl font-bold mb-4">Corte Láser</h1>
      <p className="mb-2">
        El corte láser es una técnica de fabricación que utiliza un rayo láser para cortar materiales
        con gran precisión. Es ideal para cortes finos, detallados y limpios, especialmente en materiales
        como acrílico, MDF, cartón, tela y otros polímeros.
      </p>
      <ul className="list-disc pl-5">
        <li>Corte sin contacto físico</li>
        <li>Alta velocidad y precisión</li>
        <li>Materiales compatibles: acrílico, MDF, papel, cartón, cuero, tela</li>
      </ul>
    </div>
     </div>
  );
}