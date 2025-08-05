"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "../../src/firebase/firebaseConfig";
import { useAuth } from "../../src/Context/AuthContext";
import Image from "next/image";
import { FiArrowRight } from "react-icons/fi";

const proyectosImagenes: { [key: string]: string } = {
  MUV: "/MUV.jpg",
  Ocumetics: "/ocumetics.jpg",
  Solvein: "/solvein.jpg",
  AGMI: "/AGMI.jpg",
  XSONXS: "/XSONX.png",
  Lumenex: "/Lumenex.jpeg",
  Otro: "/otro.jpg",
};

export default function SolicitudesPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [proyectos, setProyectos] = useState<string[]>([]);

  useEffect(() => {
    const obtenerProyectosConPedidos = async () => {
      if (!user) return;

      const q = query(collection(db, "pedidos"), where("usuario", "==", user.email));
      const querySnapshot = await getDocs(q);

      const proyectosSet = new Set<string>();

      querySnapshot.forEach((doc) => {
        const data = doc.data();
        proyectosSet.add(data.proyecto);
      });

      setProyectos(Array.from(proyectosSet));
    };

    obtenerProyectosConPedidos();
  }, [user]);

  const irAListado = (proyecto: string) => {
    router.push(`/solicitudes/listado?proyecto=${encodeURIComponent(proyecto)}`);
  };

  return (
    <div>
      <h1 className="text-xl mb-6 font-semibold">Tus proyectos</h1>
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
        {proyectos.map((nombre) => (
          <button
            key={nombre}
            onClick={() => irAListado(nombre)}
            className="relative rounded-xl overflow-hidden shadow-lg group"
          >
            <Image
              src={proyectosImagenes[nombre] || "/otro.jpg"}
              alt={nombre}
              width={500}
              height={300}
              className="w-full h-48 object-cover group-hover:scale-105 transition-transform duration-300"
            />
            <div className="absolute bottom-3 left-3 right-3 bg-white text-black rounded-full px-4 py-1 flex justify-between items-center">
              <span className="text-sm font-medium">{nombre}</span>
              <FiArrowRight />
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
