"use client";

import {
  addDoc,
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  writeBatch,
} from "firebase/firestore";
import {
  deleteObject,
  getDownloadURL,
  ref as storageRef,
  uploadBytes,
} from "firebase/storage";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import { useAuth } from
  "@/src/Context/AuthContext";
import {
  db,
  storage,
} from "@/src/firebase/firebaseConfig";
import type {
  NewAnomalyReportInput,
} from "./useAnomalies";
import type {
  AnomalyDecision,
  AnomalyMessage,
  AnomalyOccurrence,
  InspectionAnomaly,
} from "../types";

type Params = {
  scopeKey?: string | null;
  anomalyId?: string | null;
  enabled?: boolean;
};

function safeFileName(value: string) {
  return value
    .trim()
    .replace(
      /[^a-zA-Z0-9._-]/g,
      "_",
    );
}

export function useAnomalyThread({
  scopeKey,
  anomalyId,
  enabled = true,
}: Params) {
  const {
    user,
    displayName,
  } = useAuth();

  const [anomaly, setAnomaly] =
    useState<InspectionAnomaly | null>(
      null,
    );

  const [occurrences, setOccurrences] =
    useState<AnomalyOccurrence[]>([]);

  const [messages, setMessages] =
    useState<AnomalyMessage[]>([]);

  const [loading, setLoading] =
    useState(false);

  const [sending, setSending] =
    useState(false);

  const [
    savingOccurrence,
    setSavingOccurrence,
  ] = useState(false);

  const [
    routingOccurrence,
    setRoutingOccurrence,
  ] = useState(false);

  const [
    savingDecision,
    setSavingDecision,
  ] = useState(false);

  const [error, setError] =
    useState<string | null>(null);

  useEffect(() => {
    if (
      !enabled ||
      !scopeKey ||
      !anomalyId
    ) {
      setAnomaly(null);
      setLoading(false);
      setError(null);
      return;
    }

    setLoading(true);

    const anomalyReference = doc(
      db,
      "inspection_anomalies",
      scopeKey,
      "anomalies",
      anomalyId,
    );

    return onSnapshot(
      anomalyReference,
      (snapshot) => {
        if (!snapshot.exists()) {
          setAnomaly(null);
          setError(
            "La anormalidad ya no existe.",
          );
        } else {
          const data =
            snapshot.data();

          setAnomaly({
            id: snapshot.id,
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
              data.decisionComment ||
              undefined,
            decidedByUid:
              data.decidedByUid ||
              undefined,
            decidedByEmail:
              data.decidedByEmail ||
              undefined,
            decidedByName:
              data.decidedByName ||
              undefined,
            decidedAt:
              data.decidedAt,
            responsiblePmUid:
              data.responsiblePmUid ||
              undefined,
            responsiblePmEmail:
              data.responsiblePmEmail ||
              undefined,
            responsiblePmName:
              data.responsiblePmName ||
              undefined,
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
          });

          setError(null);
        }

        setLoading(false);
      },
      (cause) => {
        console.error(
          "Error cargando anormalidad:",
          cause,
        );

        setError(
          "No fue posible cargar la anormalidad.",
        );

        setLoading(false);
      },
    );
  }, [
    enabled,
    scopeKey,
    anomalyId,
  ]);

  useEffect(() => {
    if (
      !enabled ||
      !scopeKey ||
      !anomalyId
    ) {
      setOccurrences([]);
      return;
    }

    const reference = collection(
      db,
      "inspection_anomalies",
      scopeKey,
      "anomalies",
      anomalyId,
      "occurrences",
    );

    return onSnapshot(
      query(
        reference,
        orderBy("createdAt", "asc"),
      ),
      (snapshot) =>
        setOccurrences(
          snapshot.docs.map(
            (entry) => ({
              id: entry.id,
              ...(
                entry.data() as
                  Omit<
                    AnomalyOccurrence,
                    "id"
                  >
              ),
            }),
          ),
        ),
      (cause) => {
        console.error(
          "Error cargando reportes:",
          cause,
        );

        setError(
          "No fue posible cargar los reportes.",
        );
      },
    );
  }, [
    enabled,
    scopeKey,
    anomalyId,
  ]);

  useEffect(() => {
    if (
      !enabled ||
      !scopeKey ||
      !anomalyId
    ) {
      setMessages([]);
      return;
    }

    const reference = collection(
      db,
      "inspection_anomalies",
      scopeKey,
      "anomalies",
      anomalyId,
      "messages",
    );

    return onSnapshot(
      query(
        reference,
        orderBy("createdAt", "asc"),
      ),
      (snapshot) =>
        setMessages(
          snapshot.docs.map(
            (entry) => ({
              id: entry.id,
              ...(
                entry.data() as
                  Omit<
                    AnomalyMessage,
                    "id"
                  >
              ),
            }),
          ),
        ),
      (cause) => {
        console.error(
          "Error cargando conversación:",
          cause,
        );

        setError(
          "No fue posible cargar la conversación.",
        );
      },
    );
  }, [
    enabled,
    scopeKey,
    anomalyId,
  ]);

  const canDecide =
    useMemo(() => {
      const current = String(
        user?.email || "",
      )
        .trim()
        .toLowerCase();

      const responsible = String(
        anomaly?.responsiblePmEmail ||
          "",
      )
        .trim()
        .toLowerCase();

      return Boolean(
        current &&
        responsible &&
        current === responsible,
      );
    }, [
      user?.email,
      anomaly?.responsiblePmEmail,
    ]);

  const notifyActivity =
    useCallback(
      async (
        activityType:
          | "message"
          | "occurrence",
        activityId: string,
      ) => {
        if (
          !user ||
          !scopeKey ||
          !anomalyId
        ) {
          return;
        }

        try {
          const token =
            await user.getIdToken();

          const response =
            await fetch(
              "/api/notifications/inspections/anomaly-activity",
              {
                method: "POST",
                headers: {
                  "Content-Type":
                    "application/json",
                  Authorization:
                    `Bearer ${token}`,
                },
                body: JSON.stringify({
                  scopeKey,
                  anomalyId,
                  activityType,
                  activityId,
                }),
              },
            );

          if (!response.ok) {
            const result =
              await response
                .json()
                .catch(() => null);

            console.error(
              "La actividad se guardó, pero no se pudo notificar:",
              result?.error,
            );
          }
        } catch (cause) {
          console.error(
            "La actividad se guardó, pero no se pudo notificar:",
            cause,
          );
        }
      },
      [
        user,
        scopeKey,
        anomalyId,
      ],
    );

  const sendMessage =
    useCallback(
      async (
        textValue: string,
      ) => {
        if (
          !user ||
          !scopeKey ||
          !anomalyId
        ) {
          throw new Error(
            "No hay una sesión activa.",
          );
        }

        const text =
          textValue.trim();

        if (!text) {
          throw new Error(
            "Escribe un mensaje.",
          );
        }

        try {
          setSending(true);

          const messageReference =
            await addDoc(
              collection(
                db,
                "inspection_anomalies",
                scopeKey,
                "anomalies",
                anomalyId,
                "messages",
              ),
              {
                type: "message",
                text,
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

          await notifyActivity(
            "message",
            messageReference.id,
          );
        } finally {
          setSending(false);
        }
      },
      [
        user,
        displayName,
        scopeKey,
        anomalyId,
        notifyActivity,
      ],
    );

  const reportOccurrence =
    useCallback(
      async (
        input:
          NewAnomalyReportInput,
      ) => {
        if (
          !user ||
          !scopeKey ||
          !anomalyId
        ) {
          throw new Error(
            "No hay una sesión activa.",
          );
        }

        const description =
          input.description.trim();

        const lot =
          input.lot.trim();

        if (!description) {
          throw new Error(
            "Agrega una descripción.",
          );
        }

        if (!lot) {
          throw new Error(
            "Agrega el lote.",
          );
        }

        if (
          !Number.isInteger(
            input.affectedQuantity,
          ) ||
          input.affectedQuantity < 1 ||
          !Number.isInteger(
            input.sampleQuantity,
          ) ||
          input.sampleQuantity < 1 ||
          input.affectedQuantity >
            input.sampleQuantity
        ) {
          throw new Error(
            "Revisa las cantidades de la muestra.",
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
            "Selecciona al encargado.",
          );
        }

        const anomalyReference = doc(
          db,
          "inspection_anomalies",
          scopeKey,
          "anomalies",
          anomalyId,
        );

        const occurrenceReference =
          doc(
            collection(
              anomalyReference,
              "occurrences",
            ),
          );

        const uploaded:
          ReturnType<
            typeof storageRef
          >[] = [];

        let committed = false;

        try {
          setSavingOccurrence(true);

          const photos =
            await Promise.all(
              input.photos.map(
                async (
                  photo,
                  index,
                ) => {
                  const path =
                    "inspection-anomalies/" +
                    `${scopeKey}/` +
                    `${anomalyId}/` +
                    `${occurrenceReference.id}/` +
                    `${Date.now()}-${index}-` +
                    safeFileName(
                      photo.name,
                    );

                  const reference =
                    storageRef(
                      storage,
                      path,
                    );

                  uploaded.push(
                    reference,
                  );

                  await uploadBytes(
                    reference,
                    photo,
                    {
                      contentType:
                        photo.type ||
                        "image/jpeg",
                      customMetadata: {
                        ownerUid:
                          user.uid,
                        scopeKey,
                        anomalyId,
                        occurrenceId:
                          occurrenceReference.id,
                      },
                    },
                  );

                  return {
                    name:
                      photo.name,
                    url:
                      await getDownloadURL(
                        reference,
                      ),
                    storagePath:
                      path,
                  };
                },
              ),
            );

          const batch =
            writeBatch(db);

          batch.set(
            occurrenceReference,
            {
              anomalyId,
              followUp: true,
              description,
              lot,
              affectedQuantity:
                input.affectedQuantity,
              sampleQuantity:
                input.sampleQuantity,
              photos,
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

          batch.update(
            anomalyReference,
            {
              responsiblePmUid:
                input.responsiblePm.uid,
              responsiblePmEmail:
                input.responsiblePm.email,
              responsiblePmName:
                input.responsiblePm.name,
              updatedAt:
                serverTimestamp(),
            },
          );

          await batch.commit();
          committed = true;

          await notifyActivity(
            "occurrence",
            occurrenceReference.id,
          );

          return {
            occurrenceId:
              occurrenceReference.id,
          };
        } catch (cause) {
          if (!committed) {
            await Promise.allSettled(
              uploaded.map(
                (reference) =>
                  deleteObject(
                    reference,
                  ),
              ),
            );
          }

          throw cause instanceof Error
            ? cause
            : new Error(
                "No fue posible guardar el reporte.",
              );
        } finally {
          setSavingOccurrence(false);
        }
      },
      [
        user,
        displayName,
        scopeKey,
        anomalyId,
        notifyActivity,
      ],
    );

  const saveDecision =
    useCallback(
      async (
        input: {
          title: string;
          decision:
            Exclude<
              AnomalyDecision,
              null
            >;
          comment: string;
        },
      ) => {
        if (
          !user ||
          !scopeKey ||
          !anomalyId
        ) {
          throw new Error(
            "No hay una sesión activa.",
          );
        }

        if (!canDecide) {
          throw new Error(
            "Solo el PM responsable puede tomar esta decisión.",
          );
        }

        try {
          setSavingDecision(true);

          const token =
            await user.getIdToken();

          const response =
            await fetch(
              "/api/inspections/anomalies/decision",
              {
                method: "POST",
                headers: {
                  "Content-Type":
                    "application/json",
                  Authorization:
                    `Bearer ${token}`,
                },
                body: JSON.stringify({
                  scopeKey,
                  anomalyId,
                  ...input,
                }),
              },
            );

          const result =
            await response
              .json()
              .catch(() => null);

          if (!response.ok) {
            throw new Error(
              result?.error ||
              "No fue posible guardar la decisión.",
            );
          }
        } finally {
          setSavingDecision(false);
        }
      },
      [
        user,
        scopeKey,
        anomalyId,
        canDecide,
      ],
    );

  const routeOccurrence =
    useCallback(
      async (
        input: {
          occurrenceId: string;
          mode:
            | "new"
            | "existing";
          existingAnomalyId?: string;
          title?: string;
          decision?:
            | "pass"
            | "fail";
          comment?: string;
        },
      ) => {
        if (
          !user ||
          !scopeKey ||
          !anomalyId
        ) {
          throw new Error(
            "No hay una sesión activa.",
          );
        }

        try {
          setRoutingOccurrence(true);

          const token =
            await user.getIdToken();

          const response =
            await fetch(
              "/api/inspections/anomalies/route-occurrence",
              {
                method: "POST",
                headers: {
                  "Content-Type":
                    "application/json",
                  Authorization:
                    `Bearer ${token}`,
                },
                body: JSON.stringify({
                  scopeKey,
                  sourceAnomalyId:
                    anomalyId,
                  ...input,
                }),
              },
            );

          const result =
            await response
              .json()
              .catch(() => null);

          if (!response.ok) {
            throw new Error(
              result?.error ||
              "No fue posible reclasificar el reporte.",
            );
          }

          return String(
            result.targetAnomalyId,
          );
        } finally {
          setRoutingOccurrence(false);
        }
      },
      [
        user,
        scopeKey,
        anomalyId,
      ],
    );

  return {
    anomaly,
    occurrences,
    messages,
    loading,
    sending,
    savingOccurrence,
    routingOccurrence,
    savingDecision,
    error,
    canDecide,
    sendMessage,
    reportOccurrence,
    saveDecision,
    routeOccurrence,
  };
}
