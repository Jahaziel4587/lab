"use client";

import {
  collection,
  doc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  writeBatch,
} from "firebase/firestore";
import {
  deleteObject,
  getDownloadURL,
  ref,
  uploadBytes,
} from "firebase/storage";
import {
  useCallback,
  useEffect,
  useState,
} from "react";

import { useAuth } from "@/src/Context/AuthContext";
import {
  db,
  storage,
} from "@/src/firebase/firebaseConfig";

import type {
  AnomalyContext,
  InspectionAnomaly,
} from "../types";

export type ResponsiblePm = {
  uid: string;
  email: string;
  name: string;
  pmProjects: string[];
};

export type NewAnomalyReportInput = {
  description: string;
  lot: string;
  affectedQuantity: number;
  sampleQuantity: number;
  photos: File[];
  responsiblePm: ResponsiblePm;
};

type UseAnomaliesParams = {
  context: AnomalyContext | null;
  enabled?: boolean;
};

function normalizeProjectName(
  value: string,
) {
  return value
    .trim()
    .replace(/^DMR\.\d+\s*/i, "")
    .replace(/\s+/g, " ")
    .toLocaleLowerCase("es-MX");
}

function sanitizeFileName(
  value: string,
) {
  return value
    .trim()
    .replace(/[^a-zA-Z0-9._-]/g, "_");
}

export function useAnomalies({
  context,
  enabled = true,
}: UseAnomaliesParams) {
  const {
    user,
    displayName,
  } = useAuth();

  const [anomalies, setAnomalies] =
    useState<InspectionAnomaly[]>([]);

  const [responsiblePms, setResponsiblePms] =
    useState<ResponsiblePm[]>([]);

  const [loading, setLoading] =
    useState(false);

  const [loadingPms, setLoadingPms] =
    useState(false);

  const [saving, setSaving] =
    useState(false);

  const [error, setError] =
    useState<string | null>(null);

  /*
   * Escucha los títulos de anormalidad
   * pertenecientes al componente actual.
   */
  useEffect(() => {
    if (
      !enabled ||
      !context
    ) {
      setAnomalies([]);
      setLoading(false);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);

    const anomaliesReference = collection(
      db,
      "inspection_anomalies",
      context.scopeKey,
      "anomalies",
    );

    const anomaliesQuery = query(
      anomaliesReference,
      orderBy("createdAt", "desc"),
    );

    const unsubscribe = onSnapshot(
      anomaliesQuery,
      (snapshot) => {
        const nextAnomalies =
          snapshot.docs.map(
            (anomalyDocument) => {
              const data =
                anomalyDocument.data();

              return {
                id: anomalyDocument.id,
                title: String(
                  data.title || "",
                ),
                normalizedTitle: String(
                  data.normalizedTitle || "",
                ),
                status:
                  data.status ||
                  "pending_title",
                decision:
                  data.decision || null,
                decisionComment:
                  data.decisionComment
                    ? String(
                        data.decisionComment,
                      )
                    : undefined,
                decidedByUid:
                  data.decidedByUid
                    ? String(
                        data.decidedByUid,
                      )
                    : undefined,
                decidedByEmail:
                  data.decidedByEmail
                    ? String(
                        data.decidedByEmail,
                      )
                    : undefined,
                decidedAt:
                  data.decidedAt,
                createdByUid: String(
                  data.createdByUid || "",
                ),
                createdByEmail: String(
                  data.createdByEmail || "",
                ),
                createdAt:
                  data.createdAt,
                updatedAt:
                  data.updatedAt,
              } satisfies InspectionAnomaly;
            },
          );

        setAnomalies(nextAnomalies);
        setLoading(false);
        setError(null);
      },
      (snapshotError) => {
        console.error(
          "Error cargando anormalidades:",
          snapshotError,
        );

        setAnomalies([]);
        setLoading(false);
        setError(
          "No fue posible cargar las anormalidades registradas.",
        );
      },
    );

    return unsubscribe;
  }, [
    context,
    enabled,
  ]);

  /*
   * Carga los usuarios que tienen proyectos
   * asignados en pmProjects.
   *
   * Para MTS se muestran todos los PM.
   * Para proyecto y proceso se muestran los PM
   * asignados al proyecto seleccionado.
   */
  useEffect(() => {
    let cancelled = false;

    const loadPms = async () => {
      if (
        !enabled ||
        !context
      ) {
        setResponsiblePms([]);
        setLoadingPms(false);
        return;
      }

      try {
        setLoadingPms(true);

        const usersSnapshot =
          await getDocs(
            collection(db, "users"),
          );

        const projectName =
          context.projectName
            ? normalizeProjectName(
                context.projectName,
              )
            : "";

        const users =
          usersSnapshot.docs
            .map((userDocument) => {
              const data =
                userDocument.data();

              const pmProjects =
                Array.isArray(
                  data.pmProjects,
                )
                  ? data.pmProjects
                      .map(
                        (
                          project:
                            unknown,
                        ) =>
                          String(
                            project || "",
                          ).trim(),
                      )
                      .filter(Boolean)
                  : [];

              const email = String(
                data.email || "",
              ).trim();

              const name =
                [
                  data.nombre,
                  data.apellido,
                ]
                  .map((value) =>
                    String(
                      value || "",
                    ).trim(),
                  )
                  .filter(Boolean)
                  .join(" ") ||
                String(
                  data.displayName || "",
                ).trim() ||
                email;

              return {
                uid:
                  String(
                    data.uid ||
                    userDocument.id,
                  ),
                email,
                name,
                pmProjects,
              } satisfies ResponsiblePm;
            })
            .filter(
              (pm) =>
                pm.email &&
                pm.pmProjects.length > 0,
            )
            .filter((pm) => {
              if (
                context.sourceType ===
                "entrada_mts"
              ) {
                return true;
              }

              return pm.pmProjects.some(
                (project) =>
                  normalizeProjectName(
                    project,
                  ) === projectName,
              );
            })
            .sort((first, second) =>
              first.name.localeCompare(
                second.name,
                "es",
              ),
            );

        if (!cancelled) {
          setResponsiblePms(users);
        }
      } catch (pmError) {
        console.error(
          "Error cargando PM:",
          pmError,
        );

        if (!cancelled) {
          setResponsiblePms([]);
        }
      } finally {
        if (!cancelled) {
          setLoadingPms(false);
        }
      }
    };

    void loadPms();

    return () => {
      cancelled = true;
    };
  }, [
    context,
    enabled,
  ]);

  const createNewReport = useCallback(
    async (
      input: NewAnomalyReportInput,
    ) => {
      if (
        !context ||
        !user
      ) {
        throw new Error(
          "No hay una sesión activa o falta información del componente.",
        );
      }

      const description =
        input.description.trim();

      const lot =
        input.lot.trim();

      if (!description) {
        throw new Error(
          "Agrega una descripción de la anormalidad.",
        );
      }

      if (!lot) {
        throw new Error(
          "Agrega el número o nombre del lote.",
        );
      }

      if (
        !Number.isInteger(
          input.affectedQuantity,
        ) ||
        input.affectedQuantity < 1
      ) {
        throw new Error(
          "La cantidad afectada debe ser mayor a cero.",
        );
      }

      if (
        !Number.isInteger(
          input.sampleQuantity,
        ) ||
        input.sampleQuantity < 1
      ) {
        throw new Error(
          "La cantidad de la muestra debe ser mayor a cero.",
        );
      }

      if (
        input.affectedQuantity >
        input.sampleQuantity
      ) {
        throw new Error(
          "La cantidad afectada no puede ser mayor que la muestra.",
        );
      }

      if (
        input.photos.length === 0
      ) {
        throw new Error(
          "Agrega al menos una fotografía.",
        );
      }

      if (
        !input.responsiblePm?.email
      ) {
        throw new Error(
          "Selecciona al PM responsable.",
        );
      }

      const scopeReference = doc(
        db,
        "inspection_anomalies",
        context.scopeKey,
      );

      const anomalyReference = doc(
        collection(
          scopeReference,
          "anomalies",
        ),
      );

      const occurrenceReference = doc(
        collection(
          anomalyReference,
          "occurrences",
        ),
      );

      const uploadedReferences:
        ReturnType<typeof ref>[] = [];

      try {
        setSaving(true);

        const uploadedPhotos =
          await Promise.all(
            input.photos.map(
              async (
                photo,
                index,
              ) => {
                const fileName =
                  sanitizeFileName(
                    photo.name,
                  );

                const storagePath =
                  "inspection-anomalies/" +
                  `${context.scopeKey}/` +
                  `${anomalyReference.id}/` +
                  `${occurrenceReference.id}/` +
                  `${Date.now()}-${index}-${fileName}`;

                const photoReference =
                  ref(
                    storage,
                    storagePath,
                  );

                uploadedReferences.push(
                  photoReference,
                );

                await uploadBytes(
                  photoReference,
                  photo,
                  {
                    contentType:
                      photo.type ||
                      "image/jpeg",
                  },
                );

                const url =
                  await getDownloadURL(
                    photoReference,
                  );

                return {
                  name: photo.name,
                  url,
                  storagePath,
                };
              },
            ),
          );

        const batch =
          writeBatch(db);

        batch.set(
          scopeReference,
          {
            ...context,
            active: true,
            updatedAt:
              serverTimestamp(),
          },
          {
            merge: true,
          },
        );

        /*
         * El inspector todavía no asigna el
         * título ni la decisión.
         *
         * El PM completará estos campos.
         */
        batch.set(
          anomalyReference,
          {
            title: "",
            normalizedTitle: "",
            status: "pending_title",
            decision: null,
            decisionComment: "",
            responsiblePmUid:
              input.responsiblePm.uid,
            responsiblePmEmail:
              input.responsiblePm.email,
            responsiblePmName:
              input.responsiblePm.name,
            createdByUid:
              user.uid,
            createdByEmail:
              user.email || "",
            createdAt:
              serverTimestamp(),
            updatedAt:
              serverTimestamp(),
          },
        );

        batch.set(
          occurrenceReference,
          {
            anomalyId:
              anomalyReference.id,
            description,
            lot,
            affectedQuantity:
              input.affectedQuantity,
            sampleQuantity:
              input.sampleQuantity,
            photos:
              uploadedPhotos,
            responsiblePmUid:
              input.responsiblePm.uid,
            responsiblePmEmail:
              input.responsiblePm.email,
            responsiblePmName:
              input.responsiblePm.name,
            createdByUid:
              user.uid,
            createdByEmail:
              user.email || "",
            createdByName:
              displayName ||
              user.displayName ||
              user.email ||
              "Usuario",
            createdAt:
              serverTimestamp(),
          },
        );

        await batch.commit();

        return {
          anomalyId:
            anomalyReference.id,
          occurrenceId:
            occurrenceReference.id,
        };
      } catch (saveError) {
        /*
         * Si Firestore falla después de cargar
         * las imágenes, intentamos retirarlas
         * de Storage.
         */
        await Promise.allSettled(
          uploadedReferences.map(
            (photoReference) =>
              deleteObject(
                photoReference,
              ),
          ),
        );

        console.error(
          "Error guardando anormalidad:",
          saveError,
        );

        if (
          saveError instanceof Error &&
          saveError.message
        ) {
          throw saveError;
        }

        throw new Error(
          "No fue posible guardar la anormalidad.",
        );
      } finally {
        setSaving(false);
      }
    },
    [
      context,
      displayName,
      user,
    ],
  );

  const titledAnomalies =
    anomalies.filter(
      (anomaly) =>
        anomaly.title.trim() !== "",
    );

  const pendingAnomalies =
    anomalies.filter(
      (anomaly) =>
        anomaly.status ===
          "pending_title" ||
        anomaly.title.trim() === "",
    );

  return {
    anomalies,
    titledAnomalies,
    pendingAnomalies,
    responsiblePms,
    hasAnomalies:
      titledAnomalies.length > 0,
    loading,
    loadingPms,
    saving,
    error,
    createNewReport,
  };
}