import { collection, getDocs, orderBy, query } from "firebase/firestore";
import { db } from "@/src/firebase/firebaseConfig";
import type {
  FixtureVersion,
  LinkedPedido,
  UserPermissionData,
} from "../types";

export const getFixtureSubcollections = async (
  pedidoId: string
): Promise<{
  conceptos: FixtureVersion[];
  pruebas: FixtureVersion[];
  betas: FixtureVersion[];
}> => {
  const conceptoSnap = await getDocs(
    query(
      collection(db, "pedidos", pedidoId, "fixture_conceptos"),
      orderBy("createdAt", "asc")
    )
  );

  const pruebaSnap = await getDocs(
    query(
      collection(db, "pedidos", pedidoId, "fixture_pruebas"),
      orderBy("createdAt", "asc")
    )
  );

  const betaSnap = await getDocs(
    query(
      collection(db, "pedidos", pedidoId, "fixture_betas"),
      orderBy("createdAt", "asc")
    )
  );

  return {
    conceptos: conceptoSnap.docs.map((d) => ({
      id: d.id,
      ...(d.data() as any),
    })),
    pruebas: pruebaSnap.docs.map((d) => ({
      id: d.id,
      ...(d.data() as any),
    })),
    betas: betaSnap.docs.map((d) => ({
      id: d.id,
      ...(d.data() as any),
    })),
  };
};

export const getSolicitudArchivos = async (pedidoId: string) => {
  const snap = await getDocs(
    collection(db, "pedidos", pedidoId, "archivosFixture")
  );

  if (snap.empty) {
    return {
      visuales: [],
      tecnicos: [],
    };
  }

  const data = snap.docs[0].data();

  return {
    visuales: data.visuales || [],
    tecnicos: data.tecnicos || [],
  };
};


export const getLinkedPedidos = async (
  pedidoId: string
): Promise<LinkedPedido[]> => {
  const snap = await getDocs(collection(db, "pedidos"));
  const rows: LinkedPedido[] = [];

  snap.forEach((d) => {
    const data = d.data() as any;

    if (data.fixtureRelacionadoId === pedidoId) {
      rows.push({
        id: d.id,
        titulo: data.titulo,
        servicio: data.servicio,
        subtotal: data.subtotalMXN || data.totalMXN || 0,
        status: data.status,
      });
    }
  });

  return rows;
};

export const getUserPermissionsByEmail = async (
  email?: string
): Promise<UserPermissionData | null> => {
  if (!email) return null;

  const snap = await getDocs(collection(db, "users"));
  let found: UserPermissionData | null = null;

  snap.forEach((docSnap) => {
    const data = docSnap.data() as any;

    if (
      String(data?.email || "").toLowerCase() ===
      String(email).toLowerCase()
    ) {
      found = {
        email: data.email,
        nombre: data.nombre,
        apellido: data.apellido,
        displayName: data.displayName,
        pmProjects: Array.isArray(data.pmProjects) ? data.pmProjects : [],
        isDesigner: data.isDesigner === true,
        processOwnerOf: Array.isArray(data.processOwnerOf)
          ? data.processOwnerOf
          : [],
      };
    }
  });

  return found;
};