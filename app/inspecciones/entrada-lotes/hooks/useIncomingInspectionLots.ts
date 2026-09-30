"use client";

import {
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  writeBatch,
} from "firebase/firestore";
import {
  useCallback,
  useEffect,
  useState,
} from "react";

import { useAuth } from
  "@/src/Context/AuthContext";
import { db } from
  "@/src/firebase/firebaseConfig";
import type {
  CreateIncomingInspectionLotInput,
  IncomingInspectionContext,
  IncomingInspectionLot,
} from "../types";
import {
  isNonNegativeInteger,
  isPositiveInteger,
  mapIncomingLot,
  normalizeIncomingLotName,
} from "../utils";

type Params = {
  context:
    IncomingInspectionContext | null;
  enabled?: boolean;
};

export function useIncomingInspectionLots({
  context,
  enabled = true,
}: Params) {
  const { user, displayName } =
    useAuth();
  const [lots, setLots] =
    useState<IncomingInspectionLot[]>([]);
  const [loading, setLoading] =
    useState(false);
  const [creating, setCreating] =
    useState(false);
  const [error, setError] =
    useState<string | null>(null);

  useEffect(() => {
    if (
      !enabled ||
      !context?.scopeKey
    ) {
      setLots([]);
      setLoading(false);
      setError(null);
      return;
    }

    setLoading(true);

    const lotsReference = collection(
      db,
      "inspection_incoming_lots",
      context.scopeKey,
      "lots",
    );

    return onSnapshot(
      query(
        lotsReference,
        orderBy("createdAt", "desc"),
      ),
      (snapshot) => {
        setLots(
          snapshot.docs.map((entry) =>
            mapIncomingLot(
              entry.id,
              entry.data(),
            ),
          ),
        );
        setLoading(false);
        setError(null);
      },
      (cause) => {
        console.error(
          "Error cargando lotes de entrada:",
          cause,
        );
        setError(
          "No fue posible cargar los lotes de inspección.",
        );
        setLoading(false);
      },
    );
  }, [
    context?.scopeKey,
    enabled,
  ]);

  const createLot = useCallback(
    async (
      input:
        CreateIncomingInspectionLotInput,
    ) => {
      if (!user || !context) {
        throw new Error(
          "No hay una sesión activa o falta información del componente.",
        );
      }

      const lotName =
        input.lotName.trim();
      const normalizedLotName =
        normalizeIncomingLotName(
          lotName,
        );
      const methodPlans = input.methodPlans;
      const primaryPlan = methodPlans[0];

      if (!lotName) {
        throw new Error(
          "Agrega el nombre del lote.",
        );
      }

      if (
        !isPositiveInteger(
          input.totalLotQuantity,
        )
      ) {
        throw new Error(
          "La cantidad total del lote debe ser mayor a cero.",
        );
      }

      if (!primaryPlan || methodPlans.some((plan) => !isPositiveInteger(plan.inspectedQuantity) || plan.inspectedQuantity > input.totalLotQuantity || !plan.aql.trim() || !isNonNegativeInteger(plan.allowedRejectedQuantity) || plan.allowedRejectedQuantity > plan.inspectedQuantity)) throw new Error("Completa correctamente el plan de cada método de inspección.");

      if (!input.responsiblePm.email) {
        throw new Error(
          "Selecciona al PM responsable.",
        );
      }

      if (
        lots.some(
          (lot) =>
            lot.normalizedLotName ===
            normalizedLotName,
        )
      ) {
        throw new Error(
          "Ya existe un lote con ese nombre para este componente.",
        );
      }

      const scopeReference = doc(
        db,
        "inspection_incoming_lots",
        context.scopeKey,
      );
      const lotReference = doc(
        collection(
          scopeReference,
          "lots",
        ),
      );

      try {
        setCreating(true);
        setError(null);

        const batch = writeBatch(db);

        batch.set(
          scopeReference,
          {
            sourceType:
              context.sourceType,
            scopeKey:
              context.scopeKey,
            wiCode: context.wiCode,
            wiTitle: context.wiTitle,
            componentId:
              context.componentId,
            componentTitle:
              context.componentTitle,
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
            active: true,
            updatedAt:
              serverTimestamp(),
          },
          { merge: true },
        );

        batch.set(lotReference, {
          lotName,
          normalizedLotName,
          totalLotQuantity:
            input.totalLotQuantity,
          inspectedQuantity:
            primaryPlan.inspectedQuantity,
          inspectionType:
            primaryPlan.inspectionType,
          inspectionLevel:
            primaryPlan.inspectionLevel,
          aql: primaryPlan.aql.trim(),
          allowedRejectedQuantity:
            primaryPlan.allowedRejectedQuantity,
          methodPlans: methodPlans.map((plan) => ({ ...plan, aql: plan.aql.trim() })),
          status: "in_progress",
          inspectionResult: "pending",
          specCountingMode: null,
          reportedRejectedQuantity: 0,
          failureNotificationSent: false,
          responsiblePmUid:
            input.responsiblePm.uid,
          responsiblePmEmail:
            input.responsiblePm.email,
          responsiblePmName:
            input.responsiblePm.name,
          createdByUid: user.uid,
          createdByEmail:
            user.email || "",
          createdByName:
            displayName ||
            user.displayName ||
            user.email ||
            "Usuario",
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });

        await batch.commit();

        return { lotId: lotReference.id };
      } catch (cause) {
        console.error(
          "Error creando lote de entrada:",
          cause,
        );
        throw cause instanceof Error
          ? cause
          : new Error(
              "No fue posible crear el lote.",
            );
      } finally {
        setCreating(false);
      }
    },
    [
      context,
      displayName,
      lots,
      user,
    ],
  );

  return {
    lots,
    loading,
    creating,
    error,
    createLot,
  };
}
