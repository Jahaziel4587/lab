"use client";

export default function ResinaPage() {
  return (
    <div className="min-h-screen bg-white text-gray-900 px-6 py-20">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-3xl font-bold mb-6 text-purple-700">Impresión en Resina</h1>

        <p className="mb-6">
          La impresión con resina permite obtener piezas de alta precisión, excelente detalle y acabados lisos.
        </p>

        <h2 className="text-xl font-semibold mb-3">Materiales disponibles:</h2>
        <ul className="list-disc list-inside space-y-2">
          <li><strong>Resina estándar:</strong> Ideal para prototipos con buen detalle y acabado liso.</li>
          <li><strong>Resina Tough:</strong> Mayor resistencia al impacto y rigidez, útil para piezas funcionales.</li>
          <li><strong>Resina Flexible:</strong> Proporciona elasticidad, ideal para simular gomas.</li>
          <li><strong>Resina Dental:</strong> Alta precisión para modelos y moldes dentales.</li>
          <li><strong>Resina Transparente:</strong> Permite visualización interna, estética y técnica.</li>
          <li><strong>Resina resistente al calor:</strong> Soporta temperaturas elevadas, ideal para moldes o pruebas térmicas.</li>
        </ul>
      </div>
    </div>
  );
}
