"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "../../src/firebase/firebaseConfig";
import { useAuth } from "../../src/Context/AuthContext";
import Image from "next/image";
import { FiArrowRight } from "react-icons/fi";

const proyectosImagenes: { [key: string]: string } = {
  "001.Ocumetics": "/ocumetics.jpeg",
  "002.Labella": "/Bioana.jpeg",
  //"003.XSONXS": "/XSONX.png",
  "004.Solvein": "/Bioana.jpeg",
  "005.XSONXS Wound Heads": "/XSONX.png",
  "006.AGMI": "/Bioana.jpeg",
  "007.LumeNXT": "/LumeNXT.jpg",
  "008.Panter": "/Bioana.jpeg",
  "009.Recopad": "/Bioana.jpeg",
  "010.Juno": "/Bioana.jpeg",
  //"012.Neurocap": "/Bioana.jpeg",
  "013.T-EZ": "/Bioana.jpeg",
  "014.QIKCap handle": "/Bioana.jpeg",
  "015.QIKCap disposible": "/Bioana.jpeg",
  "016.Portacad shield": "/Bioana.jpeg",
  "017.JNM": "/Bioana.jpeg",
  "027.XSCRUB": "/Bioana.jpeg",
  "030.MUV": "/Bioana.jpeg",
 // "E001.Avarie Menstrual Pads": "/Bioana.jpeg",
  "E011.Orthodoxo Anclas": "/Bioana.jpeg",
  "E012.Falcon View": "/Bioana.jpeg",
  "E019.Othotek": "/Bioana.jpeg",
  "E020.Hero Cap": "/Bioana.jpeg",
  "E022.Injectable Dermis": "/Bioana.jpeg",
  "E023.DiViDiaper": "/Bioana.jpeg",
  //"E006.Structural Heart": "/Bioana.jpeg",
  //"E007.Leg wrap": "/Bioana.jpeg",
  "E025.InjectMate": "/Bioana.jpeg",
  "E026.Birchconcepts": "/Bioana.jpeg",
  "E028.Peniflex": "/Bioana.jpeg",
  "E029.Zipstich": "/Bioana.jpeg",
  "E031.Orthodoxo Cople": "/Bioana.jpeg",
  "E033.Sport Care": "/Bioana.jpeg",
  "E034.Sage guard": "/Bioana.jpeg",
  "Otro": "/otro.jpg",
};

export default function SolicitudesPage() {
  const { user } = useAuth(); // usamos tu Auth
  const router = useRouter();
  const [proyectos, setProyectos] = useState<string[]>([]);

  useEffect(() => {
    const obtenerProyectos = async () => {
      if (!user?.email) return;
      const myEmail = String(user.email); // narrow a string

      const setProy = new Set<string>();

      // A) Proyectos donde el usuario tiene pedidos propios
      const qPropios = query(
        collection(db, "pedidos"),
        where("usuario", "==", myEmail)
      );
      const snapPropios = await getDocs(qPropios);
      snapPropios.forEach((d) => {
        const data = d.data() as any;
        if (data?.proyecto) setProy.add(data.proyecto);
      });

      // B) Proyectos compartidos explícitamente con este usuario
      const sharesSnap = await getDocs(collection(db, "proyectos_shares"));
      sharesSnap.forEach((docu) => {
        const datos = docu.data() as any;
        const arr: string[] = Array.isArray(datos?.users) ? datos.users : [];
        if (arr.includes(myEmail)) {
          setProy.add(docu.id);
        }
      });

      setProyectos([...setProy].sort());
    };

    obtenerProyectos();
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
