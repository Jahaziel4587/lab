// app/about/servicios/fixture/page.tsx
"use client";

export default function FixturePage() {
  return (
    <div className="bg-black bg-opacity-80 text-white rounded-xl p-6 max-w-4xl mx-auto mt-10 text-sm">
      {/* Botón de regreso */}
      <div className="max-w-6xl mx-auto mb-6">
        <button
          onClick={() => window.history.back()}
          className="mb-4 bg-white text-black px-4 py-2 rounded flex items-center gap-2 hover:bg-white-800"
        >
          ← Regresar
        </button>
      </div>
      <h1 className="text-2xl font-bold mb-4">Fixture</h1>
      <p className="mb-4">
        Un fixture es un dispositivo o herramienta utilizada para sujetar,
        soportar o asegurar una pieza de trabajo durante un proceso de
        manufactura, como el ensamblado, fresado, corte o inspección. Su
        propósito principal es garantizar precisión, repetibilidad y
        eficiencia.
      </p>
      <p className="mb-4">
        En nuestro laboratorio, contamos con la capacidad de diseñar fixtures
        personalizados según las necesidades específicas de tu proyecto. Puedes
        proporcionarnos los planos listos para fabricar, o bien, contarnos tus
        requerimientos y nuestro equipo se encargará del diseño completo.
      </p>
      <p className="mb-2">
        Si no tienes planos, no te preocupes: trabajamos contigo para entender
        las dimensiones, materiales y funcionalidad deseada del fixture y te
        proponemos una solución óptima para tu caso.
      </p>
    </div>
  );
}
