import {
  useCallback,
  useEffect,
  useState,
} from "react";

import { useAuth } from
  "@/src/Context/AuthContext";

import type {
  BoxCatalogProject,
  BoxCatalogWorkInstruction,
  InspectionCatalogScope,
} from "../types";

type CatalogResponse = {
  ok: boolean;
  error?: string;

  projects?: BoxCatalogProject[];

  workInstructions?:
    BoxCatalogWorkInstruction[];

  folderFound?: boolean;
  folderId?: string | null;
  folderName?: string | null;
};

type UseInspectionCatalogOptions = {
  scope: InspectionCatalogScope | null;
  projectId?: string | null;
  enabled?: boolean;
};

export function useInspectionCatalog({
  scope,
  projectId,
  enabled = true,
}: UseInspectionCatalogOptions) {
  const { user } = useAuth();

  const [projects, setProjects] = useState<
    BoxCatalogProject[]
  >([]);

  const [
    workInstructions,
    setWorkInstructions,
  ] = useState<
    BoxCatalogWorkInstruction[]
  >([]);

  const [folderFound, setFolderFound] =
    useState<boolean | null>(null);

  const [folderName, setFolderName] =
    useState<string | null>(null);

  const [loading, setLoading] =
    useState(false);

  const [error, setError] =
    useState<string | null>(null);

  const loadCatalog = useCallback(
    async (signal?: AbortSignal) => {
      if (
        !enabled ||
        !scope ||
        !user
      ) {
        return;
      }

      if (
        (scope === "incoming" ||
          scope === "process") &&
        !projectId
      ) {
        setError(
          "Falta seleccionar un proyecto.",
        );
        return;
      }

      try {
        setLoading(true);
        setError(null);

        const idToken =
          await user.getIdToken();

        const query =
          new URLSearchParams({
            scope,
          });

        if (projectId) {
          query.set(
            "projectId",
            projectId,
          );
        }

        const response = await fetch(
          `/api/box/catalog?${query.toString()}`,
          {
            method: "GET",
            headers: {
              Authorization:
                `Bearer ${idToken}`,
            },
            cache: "no-store",
            signal,
          },
        );

        const data =
          (await response.json()) as CatalogResponse;

        if (!response.ok || !data.ok) {
          throw new Error(
            data.error ||
              "No se pudo obtener el catálogo.",
          );
        }

        setProjects(
          data.projects ?? [],
        );

        setWorkInstructions(
          data.workInstructions ?? [],
        );

        setFolderFound(
          data.folderFound ?? null,
        );

        setFolderName(
          data.folderName ?? null,
        );
      } catch (caughtError) {
        if (
          caughtError instanceof DOMException &&
          caughtError.name === "AbortError"
        ) {
          return;
        }

        console.error(
          "Error cargando catálogo:",
          caughtError,
        );

        setError(
          caughtError instanceof Error
            ? caughtError.message
            : "Error desconocido cargando catálogo.",
        );
      } finally {
        if (!signal?.aborted) {
          setLoading(false);
        }
      }
    },
    [
      enabled,
      projectId,
      scope,
      user,
    ],
  );

  useEffect(() => {
    const controller =
      new AbortController();

    loadCatalog(controller.signal);

    return () => controller.abort();
  }, [loadCatalog]);

  return {
    projects,
    workInstructions,
    folderFound,
    folderName,
    loading,
    error,
    reload: () => loadCatalog(),
  };
}