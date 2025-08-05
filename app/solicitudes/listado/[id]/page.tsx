"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/src/firebase/firebaseConfig";
import { FiArrowLeft } from "react-icons/fi";

export default function DetallePedidoPage() {
  const { id } = useParams();
  const router = useRouter();
  const [pedido, setPedido] = useState<any>(null);

  useEffect(() => {
    if (!id) return;

    const cargarPedido = async () => {
      try {
        const docRef = doc(db, "pedidos", id as string);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setPedido(docSnap.data());
        } else {
          alert("Pedido no encontrado.");
          router.push("/solicitudes");
        }
      } catch (err) {
        console.error("Error al obtener el pedido:", err);
        alert("Error al cargar el pedido.");
      }
    };

    cargarPedido();
  }, [id]);

  if (!pedido) return <p className="text-black p-4">Cargando...</p>;

  return (
    <div className="max-w-3xl mx-auto p-4 text-black space-y-6">
      <button
        onClick={() => router.back()}
        className="bg-white text-black px-4 py-2 rounded hover:bg-gray-200 flex items-center gap-2"
      >
        <FiArrowLeft /> Regresar
      </button>

      <h1 className="text-xl font-bold">Detalles del pedido</h1>

      <div className="bg-white shadow rounded-xl p-6 space-y-4">
        <p><strong>Título:</strong> {pedido.titulo || "Sin título"}</p>
        <p><strong>Proyecto:</strong> {pedido.proyecto}</p>
        <p><strong>Servicio:</strong> {pedido.servicio}</p>
        <p><strong>Máquina:</strong> {pedido.maquina}</p>
        <p><strong>Material:</strong> {pedido.material}</p>
        <p><strong>Descripción:</strong> {pedido.descripcion}</p>
        <p><strong>Fecha de entrega propuesta:</strong> {pedido.fechaLimite}</p>
        <p><strong>Fecha de entrega real:</strong> {pedido.fechaEntregaReal || "No definida"}</p>
       <p>
  <strong>Cotización:</strong>{" "}
  {pedido.costo && pedido.nombreCosto ? (
    <a
      href={pedido.costo}
      target="_blank"
      rel="noopener noreferrer"
      className="text-blue-600 underline"
    >
      {pedido.nombreCosto}
    </a>
  ) : (
    "No definido"
  )}
</p>

        <p><strong>Status:</strong> {pedido.status || "Enviado"}</p>

        {pedido.archivos?.length > 0 && (
          <div>
            <strong>Archivos:</strong>
            <ul className="list-disc list-inside mt-1 space-y-1">
              {pedido.archivos.map((url: string, idx: number) => {
                const nombre = decodeURIComponent(url.split("/").pop()?.split("?")[0] || `Archivo_${idx + 1}`);
                return (
                  <li key={idx}>
                    <a
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      download={nombre}
                      className="text-blue-600 hover:underline"
                    >
                      {nombre}
                    </a>
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        {pedido.videoURL && (
          <div>
            <strong>Video:</strong>
            <video
              controls
              src={pedido.videoURL}
              className="mt-2 w-full rounded shadow"
            />
          </div>
        )}
      </div>
    </div>
  );
}
