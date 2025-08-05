// app/collection/cortes/page.tsx
"use client";

export default function CollectionCortes() {
  return (
    <div className="p-6 grid md:grid-cols-2 gap-6 text-white">
      <div className="bg-black rounded-xl overflow-hidden shadow-md">
        <img src="/proyectos/corte-laser.jpg" alt="Corte Láser" className="w-full h-64 object-cover" />
        <div className="p-4">
          <h3 className="text-lg font-bold mb-2">Soporte de acrílico para sensores</h3>
          <p className="text-sm">Corte preciso en acrílico para montaje de sensores en una carcasa personalizada.</p>
        </div>
      </div>

      <div className="bg-black rounded-xl overflow-hidden shadow-md">
        <img src="/proyectos/corte-fresa.jpg" alt="Corte Fresa" className="w-full h-64 object-cover" />
        <div className="p-4">
          <h3 className="text-lg font-bold mb-2">Base mecanizada para pieza mecánica</h3>
          <p className="text-sm">Fresado de precisión en madera para ensamble de partes mecánicas.</p>
        </div>
      </div>
    </div>
  );
}

