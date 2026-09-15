"use client";

import {
  addDoc,
  collection,
  doc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
} from "firebase/firestore";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import { useAuth } from "@/src/Context/AuthContext";
import { db } from "@/src/firebase/firebaseConfig";

export type ProcessComponent = {
  id: string;
  title: string;
  normalizedTitle: string;
  createdByUid: string;
  createdByEmail: string;
  createdAt?: unknown;
  updatedAt?: unknown;
  updatedByEmail?: string;
};

type UseProcessComponentsParams = {
  projectId?: string | null;
  projectName?: string | null;
  wiCode?: string | null;
  wiTitle?: string | null;
  enabled?: boolean;
};

function normalizeTitle(value: string) {
  return value
    .trim()
    .replace(/\s+/g, " ")
    .toLocaleLowerCase("es-MX");
}

function normalizeProjectName(value: string) {
  return value
    .trim()
    .replace(/^DMR\.\d+\s*/i, "")
    .replace(/\s+/g, " ")
    .toLocaleLowerCase("es-MX");
}

function buildWorkInstructionKey(
  projectId: string,
  wiCode: string,
) {
  const safeProjectId = projectId
    .trim()
    .replaceAll("/", "_");

  const safeWiCode = wiCode
    .trim()
    .replaceAll("/", "_");

  return `${safeProjectId}__${safeWiCode}`;
}

export function useProcessComponents({
  projectId,
  projectName,
  wiCode,
  wiTitle,
  enabled = true,
}: UseProcessComponentsParams) {
  const { user } = useAuth();

  const [components, setComponents] =
    useState<ProcessComponent[]>([]);

  const [pmProjects, setPmProjects] =
    useState<string[]>([]);

  const [loading, setLoading] =
    useState(false);

  const [saving, setSaving] =
    useState(false);

  const [error, setError] =
    useState<string | null>(null);

  const workInstructionKey = useMemo(() => {
    if (!projectId || !wiCode) {
      return null;
    }

    return buildWorkInstructionKey(
      projectId,
      wiCode,
    );
  }, [projectId, wiCode]);

  /*
   * Se revisan los permisos del usuario.
   *
   * En el proyecto actual la colección users
   * no siempre utiliza el UID como ID del
   * documento, por eso se busca también
   * mediante el correo.
   */
  useEffect(() => {
    let cancelled = false;

    const loadPermissions = async () => {
      if (!user?.email) {
        setPmProjects([]);
        return;
      }

      try {
        const usersSnapshot = await getDocs(
          collection(db, "users"),
        );

        const normalizedEmail =
          user.email.trim().toLowerCase();

        const matchingUser =
          usersSnapshot.docs.find((userDocument) => {
            const data = userDocument.data();

            return String(data.email || "")
              .trim()
              .toLowerCase() === normalizedEmail;
          });

        if (cancelled) {
          return;
        }

        const data = matchingUser?.data();

        setPmProjects(
          Array.isArray(data?.pmProjects)
            ? data.pmProjects
                .map((value: unknown) =>
                  String(value || "").trim(),
                )
                .filter(Boolean)
            : [],
        );
      } catch (permissionError) {
        console.error(
          "No se pudieron cargar los permisos PM:",
          permissionError,
        );

        if (!cancelled) {
          setPmProjects([]);
        }
      }
    };

    void loadPermissions();

    return () => {
      cancelled = true;
    };
  }, [user?.email]);

  const canEdit = useMemo(() => {
    if (!projectName) {
      return false;
    }

    const currentProject =
      normalizeProjectName(projectName);

    return pmProjects.some(
      (pmProject) =>
        normalizeProjectName(pmProject) ===
        currentProject,
    );
  }, [pmProjects, projectName]);

  /*
   * Escucha en tiempo real los componentes
   * registrados para la WI seleccionada.
   */
  useEffect(() => {
    if (
      !enabled ||
      !workInstructionKey
    ) {
      setComponents([]);
      setLoading(false);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);

    const componentsReference = collection(
      db,
      "inspection_process_work_instructions",
      workInstructionKey,
      "components",
    );

    const componentsQuery = query(
      componentsReference,
      orderBy("createdAt", "asc"),
    );

    const unsubscribe = onSnapshot(
      componentsQuery,
      (snapshot) => {
        const nextComponents =
          snapshot.docs.map((componentDocument) => {
            const data = componentDocument.data();

            return {
              id: componentDocument.id,
              title: String(data.title || ""),
              normalizedTitle: String(
                data.normalizedTitle || "",
              ),
              createdByUid: String(
                data.createdByUid || "",
              ),
              createdByEmail: String(
                data.createdByEmail || "",
              ),
              createdAt: data.createdAt,
              updatedAt: data.updatedAt,
              updatedByEmail: data.updatedByEmail
                ? String(data.updatedByEmail)
                : undefined,
            };
          });

        setComponents(nextComponents);
        setLoading(false);
        setError(null);
      },
      (snapshotError) => {
        console.error(
          "Error cargando componentes:",
          snapshotError,
        );

        setComponents([]);
        setLoading(false);
        setError(
          "No fue posible cargar los componentes de esta WI.",
        );
      },
    );

    return unsubscribe;
  }, [
    enabled,
    workInstructionKey,
  ]);

  const addComponent = useCallback(
    async (rawTitle: string) => {
      if (
        !user ||
        !projectId ||
        !projectName ||
        !wiCode ||
        !wiTitle ||
        !workInstructionKey
      ) {
        throw new Error(
          "Falta información del proyecto o de la WI.",
        );
      }

      const title = rawTitle
        .trim()
        .replace(/\s+/g, " ");

      if (!title) {
        throw new Error(
          "Escribe el nombre del componente.",
        );
      }

      const normalizedTitle =
        normalizeTitle(title);

      const duplicateExists =
        components.some(
          (component) =>
            component.normalizedTitle ===
            normalizedTitle,
        );

      if (duplicateExists) {
        throw new Error(
          "Ya existe un componente con ese título.",
        );
      }

      try {
        setSaving(true);

        const workInstructionReference = doc(
          db,
          "inspection_process_work_instructions",
          workInstructionKey,
        );

        /*
         * El documento padre conserva los datos
         * de la WI. Se actualizan si Box cambia
         * únicamente la revisión o el título visible.
         */
        await setDoc(
          workInstructionReference,
          {
            projectId,
            projectName,
            wiCode,
            wiTitle,
            active: true,
            updatedAt: serverTimestamp(),
          },
          {
            merge: true,
          },
        );

        await addDoc(
          collection(
            workInstructionReference,
            "components",
          ),
          {
            title,
            normalizedTitle,
            createdByUid: user.uid,
            createdByEmail:
              user.email || "",
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
            updatedByEmail:
              user.email || "",
          },
        );
      } catch (saveError) {
        console.error(
          "Error guardando componente:",
          saveError,
        );

        throw new Error(
          "No fue posible guardar el componente.",
        );
      } finally {
        setSaving(false);
      }
    },
    [
      components,
      projectId,
      projectName,
      user,
      wiCode,
      wiTitle,
      workInstructionKey,
    ],
  );

  const editComponent = useCallback(
    async (
      componentId: string,
      rawTitle: string,
    ) => {
      if (
        !user ||
        !workInstructionKey
      ) {
        throw new Error(
          "No hay una sesión activa.",
        );
      }

      if (!canEdit) {
        throw new Error(
          "Solo un PM asignado a este proyecto puede editar el título.",
        );
      }

      const title = rawTitle
        .trim()
        .replace(/\s+/g, " ");

      if (!title) {
        throw new Error(
          "Escribe el nombre del componente.",
        );
      }

      const normalizedTitle =
        normalizeTitle(title);

      const duplicateExists =
        components.some(
          (component) =>
            component.id !== componentId &&
            component.normalizedTitle ===
              normalizedTitle,
        );

      if (duplicateExists) {
        throw new Error(
          "Ya existe otro componente con ese título.",
        );
      }

      try {
        setSaving(true);

        await updateDoc(
          doc(
            db,
            "inspection_process_work_instructions",
            workInstructionKey,
            "components",
            componentId,
          ),
          {
            title,
            normalizedTitle,
            updatedAt: serverTimestamp(),
            updatedByEmail:
              user.email || "",
          },
        );
      } catch (editError) {
        console.error(
          "Error editando componente:",
          editError,
        );

        throw new Error(
          "No fue posible editar el componente.",
        );
      } finally {
        setSaving(false);
      }
    },
    [
      canEdit,
      components,
      user,
      workInstructionKey,
    ],
  );

  return {
    components,
    loading,
    saving,
    error,
    canEdit,
    addComponent,
    editComponent,
  };
}