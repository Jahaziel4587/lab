"use client";

import {
  collection,
  doc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
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
  useMemo,
  useState,
} from "react";

import {
  useAuth,
} from "@/src/Context/AuthContext";

import {
  db,
  storage,
} from "@/src/firebase/firebaseConfig";

import type {
  AddNonConformityReportInput,
  CreateNonConformityLotInput,
  NonConformityContext,
  NonConformityLot,
  NonConformityReport,
  ResponsibleNonConformityPm,
} from "../types";

import {
  isValidSampleNumber,
  isValidSampleQuantity,
  normalizeLotName,
  normalizeProjectName,
  sanitizeFileName,
  sortReportsBySequence,
} from "../utils";

type UseNonConformitiesParams = {
  context:
    NonConformityContext | null;

  selectedLotId?:
    string | null;

  enabled?: boolean;
};

function mapLot(
  id: string,
  data: Record<string, unknown>,
): NonConformityLot {
  return {
    id,

    lotName:
      String(
        data.lotName || "",
      ),

    normalizedLotName:
      String(
        data.normalizedLotName || "",
      ),

    sampleQuantity:
      Number(
        data.sampleQuantity || 0,
      ),

    lotQuantity:
      Number(
        data.lotQuantity || data.sampleQuantity || 0,
      ),

    inspectionType:
      data.inspectionType === "special" ? "special" : "normal",

    inspectionLevel:
      String(data.inspectionLevel || "") as NonConformityLot["inspectionLevel"],

    aql: String(data.aql || ""),

    status:
      data.status === "finalized"
        ? "finalized"
        : "draft",

    rejectedSampleCount:
      typeof data.rejectedSampleCount ===
      "number"
        ? data.rejectedSampleCount
        : undefined,

    responsiblePmUid:
      String(
        data.responsiblePmUid || "",
      ),

    responsiblePmEmail:
      String(
        data.responsiblePmEmail || "",
      ),

    responsiblePmName:
      String(
        data.responsiblePmName || "",
      ),

    createdByUid:
      String(
        data.createdByUid || "",
      ),

    createdByEmail:
      String(
        data.createdByEmail || "",
      ),

    createdByName:
      String(
        data.createdByName || "",
      ),

    createdAt:
      data.createdAt,

    updatedAt:
      data.updatedAt,

    finalizedByUid:
      data.finalizedByUid
        ? String(
            data.finalizedByUid,
          )
        : undefined,

    finalizedByEmail:
      data.finalizedByEmail
        ? String(
            data.finalizedByEmail,
          )
        : undefined,

    finalizedByName:
      data.finalizedByName
        ? String(
            data.finalizedByName,
          )
        : undefined,

    finalizedAt:
      data.finalizedAt,

    notificationSent:
      data.notificationSent === true,

    notificationWarning:
      data.notificationWarning
        ? String(
            data.notificationWarning,
          )
        : undefined,

    reportCount:
      typeof data.reportCount ===
      "number"
        ? data.reportCount
        : 0,
  };
}

function mapReport(
  id: string,
  data: Record<string, unknown>,
): NonConformityReport {
  const rawPhotos =
    Array.isArray(data.photos)
      ? data.photos
      : [];

  const photos =
    rawPhotos
      .map((photo) => {
        if (
          !photo ||
          typeof photo !== "object"
        ) {
          return null;
        }

        const photoData =
          photo as Record<
            string,
            unknown
          >;

        const name =
          String(
            photoData.name || "",
          );

        const url =
          String(
            photoData.url || "",
          );

        const storagePath =
          String(
            photoData.storagePath || "",
          );

        if (
          !name ||
          !url ||
          !storagePath
        ) {
          return null;
        }

        return {
          name,
          url,
          storagePath,
        };
      })
      .filter(
        (
          photo,
        ): photo is {
          name: string;
          url: string;
          storagePath: string;
        } => photo !== null,
      );

  return {
    id,

    sampleNumber:
      Number(
        data.sampleNumber || 0,
      ),

    description:
      String(
        data.description || "",
      ),

    photos,

    sequence:
      Number(
        data.sequence || 0,
      ),

    createdByUid:
      String(
        data.createdByUid || "",
      ),

    createdByEmail:
      String(
        data.createdByEmail || "",
      ),

    createdByName:
      String(
        data.createdByName || "",
      ),

    createdAt:
      data.createdAt,

    updatedByUid:
      data.updatedByUid
        ? String(
            data.updatedByUid,
          )
        : undefined,

    updatedByEmail:
      data.updatedByEmail
        ? String(
            data.updatedByEmail,
          )
        : undefined,

    updatedByName:
      data.updatedByName
        ? String(
            data.updatedByName,
          )
        : undefined,

    updatedAt:
      data.updatedAt,
  };
}

export function useNonConformities({
  context,
  selectedLotId,
  enabled = true,
}: UseNonConformitiesParams) {
  const {
    user,
    displayName,
  } = useAuth();

  const [lots, setLots] =
    useState<NonConformityLot[]>(
      [],
    );

  const [reports, setReports] =
    useState<
      NonConformityReport[]
    >([]);

  const [
    responsiblePms,
    setResponsiblePms,
  ] = useState<
    ResponsibleNonConformityPm[]
  >([]);

  const [loading, setLoading] =
    useState(false);

  const [
    loadingReports,
    setLoadingReports,
  ] = useState(false);

  const [
    loadingPms,
    setLoadingPms,
  ] = useState(false);

  const [creatingLot, setCreatingLot] =
    useState(false);

  const [
    savingReport,
    setSavingReport,
  ] = useState(false);
const [
  finalizing,
  setFinalizing,
] = useState(false);
  const [error, setError] =
    useState<string | null>(
      null,
    );

  /*
   * Escucha todos los lotes del
   * componente seleccionado.
   */
  useEffect(() => {
    if (
      !enabled ||
      !context
    ) {
      setLots([]);
      setLoading(false);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);

    const lotsReference =
      collection(
        db,
        "inspection_nonconformities",
        context.scopeKey,
        "lots",
      );

    const lotsQuery =
      query(
        lotsReference,
        orderBy(
          "createdAt",
          "desc",
        ),
      );

    const unsubscribe =
      onSnapshot(
        lotsQuery,
        (snapshot) => {
          const nextLots =
            snapshot.docs.map(
              (lotDocument) =>
                mapLot(
                  lotDocument.id,
                  lotDocument.data(),
                ),
            );

          setLots(nextLots);
          setLoading(false);
          setError(null);
        },
        (snapshotError) => {
          console.error(
            "Error cargando lotes:",
            snapshotError,
          );

          setLots([]);
          setLoading(false);

          setError(
            "No fue posible cargar los lotes registrados.",
          );
        },
      );

    return unsubscribe;
  }, [
    context,
    enabled,
  ]);

  /*
   * Escucha las muestras rechazadas
   * pertenecientes al lote abierto.
   */
  useEffect(() => {
    if (
      !enabled ||
      !context ||
      !selectedLotId
    ) {
      setReports([]);
      setLoadingReports(false);
      return;
    }

    setLoadingReports(true);

    const reportsReference =
      collection(
        db,
        "inspection_nonconformities",
        context.scopeKey,
        "lots",
        selectedLotId,
        "reports",
      );

    const reportsQuery =
      query(
        reportsReference,
        orderBy(
          "sequence",
          "asc",
        ),
      );

    const unsubscribe =
      onSnapshot(
        reportsQuery,
        (snapshot) => {
          const nextReports =
            snapshot.docs.map(
              (reportDocument) =>
                mapReport(
                  reportDocument.id,
                  reportDocument.data(),
                ),
            );

          setReports(
            sortReportsBySequence(
              nextReports,
            ),
          );

          setLoadingReports(false);
          setError(null);
        },
        (snapshotError) => {
          console.error(
            "Error cargando reportes:",
            snapshotError,
          );

          setReports([]);
          setLoadingReports(false);

          setError(
            "No fue posible cargar las muestras rechazadas.",
          );
        },
      );

    return unsubscribe;
  }, [
    context,
    enabled,
    selectedLotId,
  ]);

  /*
   * Carga los usuarios que tienen
   * proyectos asignados en pmProjects.
   *
   * Para MTS aparecen todos los PM.
   * Para proyecto y proceso solamente
   * aparecen los PM correspondientes.
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
            collection(
              db,
              "users",
            ),
          );

        const currentProjectName =
          context.projectName
            ? normalizeProjectName(
                context.projectName,
              )
            : "";

        const nextPms =
          usersSnapshot.docs
            .map(
              (userDocument) => {
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
                              project ||
                                "",
                            ).trim(),
                        )
                        .filter(Boolean)
                    : [];

                const email =
                  String(
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
                    data.displayName ||
                      "",
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
                } satisfies
                  ResponsibleNonConformityPm;
              },
            )
            .filter(
              (pm) =>
                pm.email &&
                pm.pmProjects.length >
                  0,
            )
            .filter((pm) => {
              if (
                context.sourceType ===
                "entrada_mts"
              ) {
                return true;
              }

              return (
                pm.pmProjects.some(
                  (project) =>
                    normalizeProjectName(
                      project,
                    ) ===
                    currentProjectName,
                )
              );
            })
            .sort(
              (
                first,
                second,
              ) =>
                first.name.localeCompare(
                  second.name,
                  "es",
                ),
            );

        if (!cancelled) {
          setResponsiblePms(
            nextPms,
          );
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

  const selectedLot =
    useMemo(
      () =>
        lots.find(
          (lot) =>
            lot.id ===
            selectedLotId,
        ) || null,
      [
        lots,
        selectedLotId,
      ],
    );

  /*
   * Crea la carpeta lógica del lote.
   */
  const createLot =
    useCallback(
      async (
        input:
          CreateNonConformityLotInput,
      ) => {
        if (
          !context ||
          !user
        ) {
          throw new Error(
            "No hay una sesión activa o falta información del componente.",
          );
        }

        const lotName =
          input.lotName.trim();

        const normalizedLotName =
          normalizeLotName(
            lotName,
          );

        if (!lotName) {
          throw new Error(
            "Agrega el nombre del lote.",
          );
        }

        if (
          !isValidSampleQuantity(
            input.sampleQuantity,
          )
        ) {
          throw new Error(
            "La cantidad de muestras debe ser un número entero mayor a cero.",
          );
        }

        if (
          !isValidSampleQuantity(input.lotQuantity) ||
          input.sampleQuantity > input.lotQuantity
        ) {
          throw new Error(
            "La cantidad total del lote debe ser igual o mayor a la cantidad inspeccionada.",
          );
        }

        if (!input.inspectionType || !input.inspectionLevel || !input.aql.trim()) {
          throw new Error("Completa el tipo, nivel de inspección y AQL.");
        }

        if (
          !input.responsiblePm ||
          !input.responsiblePm.email
        ) {
          throw new Error(
            "Selecciona al PM responsable.",
          );
        }

        const duplicatedLot =
          lots.some(
            (lot) =>
              lot.normalizedLotName ===
              normalizedLotName,
          );

        if (duplicatedLot) {
          throw new Error(
            "Ya existe un lote con ese nombre para este componente.",
          );
        }

        try {
          setCreatingLot(true);
          setError(null);

          const scopeReference =
            doc(
              db,
              "inspection_nonconformities",
              context.scopeKey,
            );

          const lotReference =
            doc(
              collection(
                scopeReference,
                "lots",
              ),
            );

          const batch =
            writeBatch(db);

          batch.set(
            scopeReference,
            {
              sourceType:
                context.sourceType,

              scopeKey:
                context.scopeKey,

              wiCode:
                context.wiCode,

              wiTitle:
                context.wiTitle,

              ...(context.projectId
                ? {
                    projectId:
                      context.projectId,
                  }
                : {}),

              ...(context.projectName
                ? {
                    projectName:
                      context.projectName,
                  }
                : {}),

              ...(context
                .processComponentId
                ? {
                    processComponentId:
                      context
                        .processComponentId,
                  }
                : {}),

              ...(context
                .processComponentTitle
                ? {
                    processComponentTitle:
                      context
                        .processComponentTitle,
                  }
                : {}),

              active: true,

              updatedAt:
                serverTimestamp(),
            },
            {
              merge: true,
            },
          );

          batch.set(
            lotReference,
            {
              lotName,
              normalizedLotName,

              sampleQuantity:
                input.sampleQuantity,

              lotQuantity:
                input.lotQuantity,

              inspectionType:
                input.inspectionType,

              inspectionLevel:
                input.inspectionLevel,

              aql: input.aql.trim(),

              status: "draft",

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

              reportCount: 0,
              nextReportSequence: 1,

              createdAt:
                serverTimestamp(),

              updatedAt:
                serverTimestamp(),
            },
          );

          await batch.commit();

          return {
            lotId:
              lotReference.id,
          };
        } catch (createError) {
          console.error(
            "Error creando lote:",
            createError,
          );

          if (
            createError instanceof
              Error &&
            createError.message
          ) {
            throw createError;
          }

          throw new Error(
            "No fue posible crear el lote.",
          );
        } finally {
          setCreatingLot(false);
        }
      },
      [
        context,
        displayName,
        lots,
        user,
      ],
    );

  /*
   * Registra una muestra rechazada
   * dentro del lote seleccionado.
   */
  const addReport =
    useCallback(
      async (
        input:
          AddNonConformityReportInput,
      ) => {
        if (
          !context ||
          !selectedLotId ||
          !selectedLot ||
          !user
        ) {
          throw new Error(
            "No hay una sesión activa o no se encontró el lote.",
          );
        }

        if (
          selectedLot.status ===
          "finalized"
        ) {
          throw new Error(
            "Este lote ya fue finalizado y no admite nuevos reportes.",
          );
        }

        if (
          !isValidSampleNumber(
            input.sampleNumber,
            selectedLot
              .sampleQuantity,
          )
        ) {
          throw new Error(
            "El número de muestra debe estar entre 1 y " +
              `${selectedLot.sampleQuantity}.`,
          );
        }

        const description =
          input.description.trim();

        if (!description) {
          throw new Error(
            "Agrega la descripción del rechazo por SPEC.",
          );
        }

        const duplicatedSample =
          reports.some(
            (report) =>
              report.sampleNumber ===
              input.sampleNumber,
          );

        if (duplicatedSample) {
          throw new Error(
            `La muestra ${input.sampleNumber} ` +
              "ya tiene un rechazo por SPEC registrado.",
          );
        }

        const lotReference =
          doc(
            db,
            "inspection_nonconformities",
            context.scopeKey,
            "lots",
            selectedLotId,
          );

        /*
         * El ID estable impide que dos usuarios
         * registren la misma muestra al mismo
         * tiempo.
         */
        const reportId =
          `sample_${String(
            input.sampleNumber,
          ).padStart(6, "0")}`;

        const reportReference =
          doc(
            lotReference,
            "reports",
            reportId,
          );

        const uploadedReferences:
          ReturnType<typeof ref>[] =
            [];

        let reportCommitted =
          false;

        try {
          setSavingReport(true);
          setError(null);

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
                    "inspection-nonconformities/" +
                    `${context.scopeKey}/` +
                    `${selectedLotId}/` +
                    `${reportId}/` +
                    `${Date.now()}-` +
                    `${index}-` +
                    `${fileName}`;

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

                      customMetadata: {
                        ownerUid:
                          user.uid,

                        scopeKey:
                          context.scopeKey,

                        lotId:
                          selectedLotId,

                        reportId,

                        sampleNumber:
                          String(
                            input
                              .sampleNumber,
                          ),
                      },
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

          await runTransaction(
            db,
            async (
              transaction,
            ) => {
              const [
                lotSnapshot,
                reportSnapshot,
              ] =
                await Promise.all([
                  transaction.get(
                    lotReference,
                  ),

                  transaction.get(
                    reportReference,
                  ),
                ]);

              if (
                !lotSnapshot.exists()
              ) {
                throw new Error(
                  "El lote ya no existe.",
                );
              }

              const lotData =
                lotSnapshot.data();

              if (
                lotData.status ===
                "finalized"
              ) {
                throw new Error(
                  "Este lote ya fue finalizado.",
                );
              }

              if (
                reportSnapshot.exists()
              ) {
                throw new Error(
                  `La muestra ${input.sampleNumber} ` +
                    "ya fue registrada.",
                );
              }

              const sequence =
                Number(
                  lotData
                    .nextReportSequence ||
                    1,
                );

              const reportCount =
                Number(
                  lotData.reportCount ||
                    0,
                );

              transaction.set(
                reportReference,
                {
                  sampleNumber:
                    input.sampleNumber,

                  description,

                  photos:
                    uploadedPhotos,

                  sequence,

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

                  updatedAt:
                    serverTimestamp(),
                },
              );

              transaction.update(
                lotReference,
                {
                  reportCount:
                    reportCount + 1,

                  nextReportSequence:
                    sequence + 1,

                  updatedAt:
                    serverTimestamp(),
                },
              );
            },
          );

          reportCommitted = true;

          return {
            reportId,
          };
        } catch (saveError) {
          /*
           * Si Firestore falla después de
           * cargar las fotografías, intentamos
           * eliminarlas de Storage.
           */
          if (!reportCommitted) {
            await Promise.allSettled(
              uploadedReferences.map(
                (
                  photoReference,
                ) =>
                  deleteObject(
                    photoReference,
                  ),
              ),
            );
          }

          console.error(
            "Error guardando rechazo por SPEC:",
            saveError,
          );

          if (
            saveError instanceof
              Error &&
            saveError.message
          ) {
            throw saveError;
          }

          throw new Error(
            "No fue posible guardar la muestra rechazada.",
          );
        } finally {
          setSavingReport(false);
        }
      },
      [
        context,
        displayName,
        reports,
        selectedLot,
        selectedLotId,
        user,
      ],
    );
const finalizeLot =
  useCallback(
    async () => {
      if (
        !context ||
        !selectedLotId ||
        !selectedLot ||
        !user
      ) {
        throw new Error(
          "No hay una sesión activa o no se encontró el lote.",
        );
      }

      if (
        selectedLot.createdByUid !==
        user.uid
      ) {
        throw new Error(
          "Solo el inspector que creó el lote puede finalizarlo.",
        );
      }

      if (
        selectedLot.status ===
        "finalized"
      ) {
        throw new Error(
          "Este lote ya fue finalizado.",
        );
      }

      if (
        reports.length === 0
      ) {
        throw new Error(
          "Registra al menos una muestra rechazada antes de finalizar el lote.",
        );
      }

      try {
        setFinalizing(true);
        setError(null);

        const token =
          await user.getIdToken();

        const response =
          await fetch(
            "/api/inspections/" +
              "nonconformities/" +
              "finalize",
            {
              method: "POST",

              headers: {
                "Content-Type":
                  "application/json",

                Authorization:
                  `Bearer ${token}`,
              },

              body:
                JSON.stringify({
                  scopeKey:
                    context.scopeKey,

                  lotId:
                    selectedLotId,
                }),
            },
          );

        const result =
          await response
            .json()
            .catch(() => null);

        if (
          !response.ok ||
          !result?.ok
        ) {
          throw new Error(
            result?.error ||
              "No fue posible finalizar el lote.",
          );
        }

        /*
         * El lote ya quedó bloqueado.
         * Ahora se solicita la notificación.
         *
         * Si la notificación falla, el lote
         * permanece finalizado.
         */
        let notificationSent =
          false;

        let notificationWarning =
          "";

        try {
          const notificationResponse =
            await fetch(
              "/api/notifications/" +
                "inspections/" +
                "nonconformity-finalized",
              {
                method: "POST",

                headers: {
                  "Content-Type":
                    "application/json",

                  Authorization:
                    `Bearer ${token}`,
                },

                body:
                  JSON.stringify({
                    scopeKey:
                      context.scopeKey,

                    lotId:
                      selectedLotId,
                  }),
              },
            );

          const notificationResult =
            await notificationResponse
              .json()
              .catch(() => null);

          if (
            !notificationResponse.ok ||
            !notificationResult?.ok
          ) {
            notificationWarning =
              notificationResult
                ?.error ||
              "El lote se finalizó, pero no se pudo enviar la notificación.";

            console.error(
              notificationWarning,
            );
          } else {
            notificationSent =
              true;
          }
        } catch (
          notificationError
        ) {
          notificationWarning =
            "El lote se finalizó, pero no se pudo enviar la notificación.";

          console.error(
            notificationWarning,
            notificationError,
          );
        }

        return {
          lotId:
            selectedLotId,

          rejectedSampleCount:
            Number(
              result
                .rejectedSampleCount ||
                0,
            ),

          sampleQuantity:
            Number(
              result.sampleQuantity ||
                selectedLot
                  .sampleQuantity,
            ),

          notificationSent,
          notificationWarning,
        };
      } catch (finalizeError) {
        console.error(
          "Error finalizando lote:",
          finalizeError,
        );

        if (
          finalizeError instanceof
            Error &&
          finalizeError.message
        ) {
          throw finalizeError;
        }

        throw new Error(
          "No fue posible finalizar el lote.",
        );
      } finally {
        setFinalizing(false);
      }
    },
    [
      context,
      reports.length,
      selectedLot,
      selectedLotId,
      user,
    ],
  );
  const draftLots =
    useMemo(
      () =>
        lots.filter(
          (lot) =>
            lot.status ===
            "draft",
        ),
      [lots],
    );

  const finalizedLots =
    useMemo(
      () =>
        lots.filter(
          (lot) =>
            lot.status ===
            "finalized",
        ),
      [lots],
    );

  const rejectedSampleCount =
    useMemo(
      () =>
        new Set(
          reports.map(
            (report) =>
              report.sampleNumber,
          ),
        ).size,
      [reports],
    );
const canEditSelectedLot =
  Boolean(
    user?.uid &&
    selectedLot &&
    selectedLot.createdByUid ===
      user.uid &&
    selectedLot.status ===
      "draft",
  );
  return {
  lots,
  draftLots,
  finalizedLots,

  selectedLot,
  reports,

  responsiblePms,

  rejectedSampleCount,
  canEditSelectedLot,

  loading,
  loadingReports,
  loadingPms,

  creatingLot,
  savingReport,
  finalizing,

  error,

  createLot,
  addReport,
  finalizeLot,
};
}
