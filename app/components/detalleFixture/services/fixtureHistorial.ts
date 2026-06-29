import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { db } from "@/src/firebase/firebaseConfig";

export const registrarHistorialFixture = async ({
  pedidoId,
  tipo,
  descripcion,
  userEmail,
}: {
  pedidoId: string;
  tipo: string;
  descripcion: string;
  userEmail?: string;
}) => {
  await addDoc(collection(db, "pedidos", pedidoId, "historialFixture"), {
    tipo,
    descripcion,
    creadoPor: userEmail || "",
    createdAt: serverTimestamp(),
  });
};