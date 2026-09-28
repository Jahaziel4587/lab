"use client";

import {
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";
import {
  getDownloadURL,
  ref,
  uploadBytes,
} from "firebase/storage";
import { useCallback, useEffect, useState } from "react";

import { useAuth } from "@/src/Context/AuthContext";
import { db, storage } from "@/src/firebase/firebaseConfig";
import type {
  CreateIncomingLotReportInput,
  IncomingInspectionContext,
  IncomingInspectionLot,
  IncomingLotReport,
  IncomingLotReportPhoto,
} from "../types";

type Params = {
  context: IncomingInspectionContext | null;
  lot: IncomingInspectionLot | null;
};

function safePath(value: string) {
  return value.replace(/[^a-zA-Z0-9._-]/g, "_");
}

function mapReport(
  id: string,
  data: Record<string, unknown>,
): IncomingLotReport {
  return {
    id,
    kind:
      data.kind === "spec_rejection"
        ? "spec_rejection"
        : "anomaly",
    mode:
      data.mode === "sample_number"
        ? "sample_number"
        : "quantity",
    title: String(data.title || ""),
    description: String(data.description || ""),
    quantity:
      typeof data.quantity === "number"
        ? data.quantity
        : undefined,
    sampleNumber:
      typeof data.sampleNumber === "number"
        ? data.sampleNumber
        : undefined,
    photos: Array.isArray(data.photos)
      ? data.photos as IncomingLotReportPhoto[]
      : [],
    createdByUid: String(data.createdByUid || ""),
    createdByEmail: String(data.createdByEmail || ""),
    createdByName: String(data.createdByName || ""),
    createdAt: data.createdAt,
    updatedAt: data.updatedAt,
  };
}

export function useIncomingLotReports({
  context,
  lot,
}: Params) {
  const { user, displayName } = useAuth();
  const [reports, setReports] = useState<IncomingLotReport[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!context || !lot) {
      setReports([]);
      return;
    }

    setLoading(true);
    const reportsReference = collection(
      db,
      "inspection_incoming_lots",
      context.scopeKey,
      "lots",
      lot.id,
      "reports",
    );

    return onSnapshot(
      query(reportsReference, orderBy("createdAt", "desc")),
      (snapshot) => {
        setReports(snapshot.docs.map((entry) =>
          mapReport(entry.id, entry.data()),
        ));
        setLoading(false);
        setError(null);
      },
      (cause) => {
        console.error("Error cargando reportes del lote:", cause);
        setError("No fue posible cargar los reportes del lote.");
        setLoading(false);
      },
    );
  }, [context, lot]);

  const createReport = useCallback(async (
    input: CreateIncomingLotReportInput,
  ) => {
    if (!user || !context || !lot) {
      throw new Error("Falta la sesión o la información del lote.");
    }
    if (lot.status !== "in_progress") {
      throw new Error("Este lote ya fue finalizado.");
    }

    const title = input.title.trim();
    const description = input.description.trim();
    if (!title || !description) {
      throw new Error("Agrega el título y la descripción.");
    }

    const amount = input.mode === "quantity"
      ? Number(input.quantity)
      : 1;
    if (!Number.isInteger(amount) || amount < 1) {
      throw new Error("La cantidad debe ser un número entero mayor a cero.");
    }
    if (
      input.mode === "sample_number" &&
      (!Number.isInteger(input.sampleNumber) || Number(input.sampleNumber) < 1)
    ) {
      throw new Error("El número de muestra debe ser mayor a cero.");
    }
    if (input.kind === "anomaly" && input.photos.length === 0) {
      throw new Error("Agrega al menos una fotografía de la anormalidad.");
    }

    setSaving(true);
    setError(null);
    try {
      const lotReference = doc(
        db,
        "inspection_incoming_lots",
        context.scopeKey,
        "lots",
        lot.id,
      );
      const reportReference = doc(collection(lotReference, "reports"));

      const photos = await Promise.all(
        input.photos.map(async (photo, index) => {
          const storagePath = [
            "inspection-incoming-lots",
            safePath(context.scopeKey),
            lot.id,
            reportReference.id,
            `${Date.now()}-${index}-${safePath(photo.name)}`,
          ].join("/");
          const storageReference = ref(storage, storagePath);
          await uploadBytes(storageReference, photo, {
            contentType: photo.type || "image/jpeg",
          });
          return {
            name: photo.name,
            storagePath,
            url: await getDownloadURL(storageReference),
          };
        }),
      );

      await runTransaction(db, async (transaction) => {
        const lotSnapshot = await transaction.get(lotReference);
        if (!lotSnapshot.exists()) {
          throw new Error("El lote ya no existe.");
        }
        const current = lotSnapshot.data();
        if (current.status !== "in_progress") {
          throw new Error("Este lote ya fue finalizado.");
        }

        if (
          input.kind === "spec_rejection" &&
          current.specCountingMode &&
          current.specCountingMode !== input.mode
        ) {
          throw new Error(
            "Los rechazos por SPEC de este lote deben conservar la modalidad del primer reporte.",
          );
        }

        transaction.set(reportReference, {
          kind: input.kind,
          mode: input.mode,
          title,
          description,
          ...(input.mode === "quantity"
            ? { quantity: amount }
            : { sampleNumber: Number(input.sampleNumber) }),
          photos,
          createdByUid: user.uid,
          createdByEmail: user.email || "",
          createdByName:
            displayName || user.displayName || user.email || "Usuario",
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });

        if (input.kind === "spec_rejection") {
          transaction.update(lotReference, {
            specCountingMode: input.mode,
            reportedRejectedQuantity:
              Number(current.reportedRejectedQuantity || 0) + amount,
            updatedAt: serverTimestamp(),
          });
        } else {
          transaction.update(lotReference, {
            updatedAt: serverTimestamp(),
          });
        }
      });

      return { reportId: reportReference.id };
    } finally {
      setSaving(false);
    }
  }, [context, displayName, lot, user]);

  const addQuantity = useCallback(async (
    report: IncomingLotReport,
    quantityToAdd: number,
  ) => {
    if (!context || !lot || !user) {
      throw new Error("Falta la sesión o la información del lote.");
    }
    if (report.mode !== "quantity") {
      throw new Error("Este reporte no utiliza cantidades.");
    }
    if (!Number.isInteger(quantityToAdd) || quantityToAdd < 1) {
      throw new Error("La cantidad a agregar debe ser mayor a cero.");
    }

    const lotReference = doc(db, "inspection_incoming_lots", context.scopeKey, "lots", lot.id);
    const reportReference = doc(lotReference, "reports", report.id);
    const additionReference = doc(collection(reportReference, "quantity_additions"));
    setSaving(true);
    try {
      await runTransaction(db, async (transaction) => {
        const [lotSnapshot, reportSnapshot] = await Promise.all([
          transaction.get(lotReference),
          transaction.get(reportReference),
        ]);
        if (!lotSnapshot.exists() || !reportSnapshot.exists()) {
          throw new Error("No se encontró el reporte.");
        }
        if (lotSnapshot.data().status !== "in_progress") {
          throw new Error("Este lote ya fue finalizado.");
        }
        const currentQuantity = Number(reportSnapshot.data().quantity || 0);
        transaction.update(reportReference, {
          quantity: currentQuantity + quantityToAdd,
          updatedAt: serverTimestamp(),
          updatedByUid: user.uid,
        });
        transaction.set(additionReference, {
          quantityAdded: quantityToAdd,
          previousQuantity: currentQuantity,
          resultingQuantity: currentQuantity + quantityToAdd,
          createdByUid: user.uid,
          createdByEmail: user.email || "",
          createdAt: serverTimestamp(),
        });
        if (report.kind === "spec_rejection") {
          transaction.update(lotReference, {
            reportedRejectedQuantity:
              Number(lotSnapshot.data().reportedRejectedQuantity || 0) + quantityToAdd,
            updatedAt: serverTimestamp(),
          });
        }
      });
    } finally {
      setSaving(false);
    }
  }, [context, lot, user]);

  const confirmUniqueRejectedQuantity = useCallback(async (
    uniqueQuantity: number,
  ) => {
    if (!context || !lot) return;
    if (!Number.isInteger(uniqueQuantity) || uniqueQuantity < 0) {
      throw new Error("Agrega una cantidad válida.");
    }
    await updateDoc(
      doc(db, "inspection_incoming_lots", context.scopeKey, "lots", lot.id),
      {
        confirmedUniqueRejectedQuantity: uniqueQuantity,
        lastReviewedReportedQuantity: lot.reportedRejectedQuantity,
        inspectionResult:
          uniqueQuantity > lot.allowedRejectedQuantity
            ? "will_fail"
            : "within_limit",
        updatedAt: serverTimestamp(),
      },
    );
  }, [context, lot]);

  return {
    reports,
    loading,
    saving,
    error,
    createReport,
    addQuantity,
    confirmUniqueRejectedQuantity,
  };
}
