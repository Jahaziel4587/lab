"use client";

import {
  addDoc,
  arrayUnion,
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  updateDoc,
  writeBatch,
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
  IncomingLotAnomalyMessage,
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
    finalRejectedQuantity:
      typeof data.finalRejectedQuantity === "number"
        ? data.finalRejectedQuantity
        : undefined,
    photos: Array.isArray(data.photos)
      ? data.photos as IncomingLotReportPhoto[]
      : [],
    status: data.status === "resolved"
      ? "resolved"
      : data.status === "pending_decision"
        ? "pending_decision"
        : "pending_title",
    decision: data.decision === "pass" || data.decision === "fail"
      ? data.decision
      : null,
    decidedByUid: String(data.decidedByUid || ""),
    decidedByEmail: String(data.decidedByEmail || ""),
    decidedByName: String(data.decidedByName || ""),
    decidedAt: data.decidedAt,
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
  const { user, displayName, isAdmin } = useAuth();
  const [reports, setReports] = useState<IncomingLotReport[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [messagesByReport, setMessagesByReport] = useState<Record<string, IncomingLotAnomalyMessage[]>>({});

  const canDecideAnomalies = Boolean(
    user && lot && (
      isAdmin ||
      user.uid === lot.responsiblePmUid ||
      Boolean(user.email && user.email.toLowerCase() === lot.responsiblePmEmail.toLowerCase())
    )
  );

  const notify = useCallback(async (
    action: "anomaly_created" | "message" | "decision" | "threshold_exceeded" | "lot_finalized",
    details: { reportId?: string; messageId?: string } = {},
  ) => {
    if (!user || !context || !lot) return;
    const response = await fetch("/api/notifications/inspections/incoming-lot", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${await user.getIdToken()}`,
      },
      body: JSON.stringify({
        action,
        scopeKey: context.scopeKey,
        lotId: lot.id,
        ...details,
      }),
    });
    if (!response.ok) {
      const result = await response.json().catch(() => null);
      throw new Error(result?.error || "La información se guardó, pero no fue posible enviar la notificación.");
    }
  }, [context, lot, user]);

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

  useEffect(() => {
    if (!context || !lot) {
      setMessagesByReport({});
      return;
    }
    const anomalyIds = reports
      .filter((report) => report.kind === "anomaly")
      .map((report) => report.id);
    const subscriptions = anomalyIds.map((reportId) => {
      const messagesReference = collection(
        db,
        "inspection_incoming_lots",
        context.scopeKey,
        "lots",
        lot.id,
        "reports",
        reportId,
        "messages",
      );
      return onSnapshot(
        query(messagesReference, orderBy("createdAt", "asc")),
        (snapshot) => {
          const messages = snapshot.docs.map((entry) => {
            const data = entry.data();
            return {
              id: entry.id,
              text: String(data.text || ""),
              type: data.type === "decision" ? "decision" as const : "message" as const,
              createdByUid: String(data.createdByUid || ""),
              createdByEmail: String(data.createdByEmail || ""),
              createdByName: String(data.createdByName || "Usuario"),
              createdAt: data.createdAt,
            };
          });
          setMessagesByReport((current) => ({ ...current, [reportId]: messages }));
        },
        () => setError("No fue posible cargar una conversación de anormalidad."),
      );
    });
    return () => subscriptions.forEach((unsubscribe) => unsubscribe());
  }, [context, lot, reports]);

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
    if (input.kind === "spec_rejection" && !title) {
      throw new Error("Agrega el título del rechazo por SPEC.");
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
            input.kind === "anomaly"
              ? "inspection-anomalies"
              : "inspection-nonconformities",
            safePath(context.scopeKey),
            lot.id,
            reportReference.id,
            `${Date.now()}-${index}-${safePath(photo.name)}`,
          ].join("/");
          const storageReference = ref(storage, storagePath);
          await uploadBytes(storageReference, photo, {
            contentType: photo.type || "image/jpeg",
            customMetadata: {
              ownerUid: user.uid,
              scopeKey: context.scopeKey,
              lotId: lot.id,
              reportId: reportReference.id,
              anomalyId: lot.id,
              occurrenceId: reportReference.id,
              sampleNumber: String(input.sampleNumber || 0),
              findingKind: input.kind,
            },
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
          ...(input.kind === "anomaly"
            ? { status: "pending_title", decision: null }
            : {}),
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

      if (input.kind === "anomaly") {
        await notify("anomaly_created", { reportId: reportReference.id }).catch((cause) => {
          console.error("La anormalidad se guardó, pero no pudo notificarse:", cause);
        });
      }

      return { reportId: reportReference.id };
    } finally {
      setSaving(false);
    }
  }, [context, displayName, lot, notify, user]);

  const addAnomalyMessage = useCallback(async (
    reportId: string,
    text: string,
  ) => {
    if (!context || !lot || !user || !text.trim()) {
      throw new Error("Escribe un mensaje.");
    }
    const messageReference = await addDoc(collection(
      db,
      "inspection_incoming_lots",
      context.scopeKey,
      "lots",
      lot.id,
      "reports",
      reportId,
      "messages",
    ), {
      text: text.trim(),
      type: "message",
      createdByUid: user.uid,
      createdByEmail: user.email || "",
      createdByName: displayName || user.displayName || user.email || "Usuario",
      createdAt: serverTimestamp(),
    });
    await notify("message", { reportId, messageId: messageReference.id }).catch((cause) => {
      console.error("El mensaje se guardó, pero no pudo notificarse:", cause);
    });
  }, [context, displayName, lot, notify, user]);

  const resolveAnomaly = useCallback(async (
    reportId: string,
    title: string,
    decision: "pass" | "fail",
    comment: string,
  ) => {
    if (!context || !lot || !user) {
      throw new Error("Falta la sesión o la información del lote.");
    }
    if (!canDecideAnomalies) {
      throw new Error("Solo el PM responsable o un administrador puede tomar esta decisión.");
    }
    if (!title.trim()) {
      throw new Error("Asigna un título a la anormalidad.");
    }
    const reportReference = doc(
      db,
      "inspection_incoming_lots",
      context.scopeKey,
      "lots",
      lot.id,
      "reports",
      reportId,
    );
    const messageReference = doc(collection(reportReference, "messages"));
    const actorName = displayName || user.displayName || user.email || "Usuario";
    await runTransaction(db, async (transaction) => {
      transaction.update(reportReference, {
        title: title.trim(),
        status: "resolved",
        decision,
        decidedByUid: user.uid,
        decidedByEmail: user.email || "",
        decidedByName: actorName,
        decidedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      transaction.set(messageReference, {
        text: comment.trim() || (decision === "pass" ? "Anormalidad aceptada." : "Anormalidad rechazada."),
        type: "decision",
        decision,
        createdByUid: user.uid,
        createdByEmail: user.email || "",
        createdByName: actorName,
        createdAt: serverTimestamp(),
      });
    });
    await notify("decision", { reportId }).catch((cause) => {
      console.error("La decisión se guardó, pero no pudo notificarse:", cause);
    });
  }, [canDecideAnomalies, context, displayName, lot, notify, user]);

  const addReportPhotos = useCallback(async (
    report: IncomingLotReport,
    files: File[],
  ) => {
    if (!context || !lot || !user || files.length === 0) return;
    if (lot.status !== "in_progress") {
      throw new Error("Este lote ya fue finalizado.");
    }
    setSaving(true);
    try {
      const uploaded = await Promise.all(files.map(async (photo, index) => {
        const storagePath = [
          report.kind === "anomaly" ? "inspection-anomalies" : "inspection-nonconformities",
          safePath(context.scopeKey),
          lot.id,
          report.id,
          `${Date.now()}-extra-${index}-${safePath(photo.name)}`,
        ].join("/");
        const storageReference = ref(storage, storagePath);
        await uploadBytes(storageReference, photo, {
          contentType: photo.type || "image/jpeg",
          customMetadata: {
            ownerUid: user.uid,
            scopeKey: context.scopeKey,
            lotId: lot.id,
            reportId: report.id,
            anomalyId: lot.id,
            occurrenceId: report.id,
            findingKind: report.kind,
          },
        });
        return {
          name: photo.name,
          storagePath,
          url: await getDownloadURL(storageReference),
        };
      }));
      await updateDoc(
        doc(db, "inspection_incoming_lots", context.scopeKey, "lots", lot.id, "reports", report.id),
        { photos: arrayUnion(...uploaded), updatedAt: serverTimestamp() },
      );
    } finally {
      setSaving(false);
    }
  }, [context, lot, user]);

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
        rejectionClarifications: arrayUnion({
          reportedQuantity: lot.reportedRejectedQuantity,
          confirmedUniqueQuantity: uniqueQuantity,
          allowedQuantity: lot.allowedRejectedQuantity,
          repeatedSamples: uniqueQuantity < lot.reportedRejectedQuantity,
          createdByName: displayName || user?.displayName || user?.email || "Usuario",
          createdAt: new Date(),
        }),
        inspectionResult:
          uniqueQuantity > lot.allowedRejectedQuantity
            ? "will_fail"
            : "within_limit",
        updatedAt: serverTimestamp(),
      },
    );
    if (uniqueQuantity > lot.allowedRejectedQuantity) {
      await notify("threshold_exceeded");
    }
  }, [context, displayName, lot, notify, user]);

  const finalizeLot = useCallback(async (
    quantities: Record<string, number>,
    finalRejectedPieces: number,
  ) => {
    if (!context || !lot || !user) {
      throw new Error("Falta la sesión o la información del lote.");
    }
    if (
      lot.reportedRejectedQuantity > lot.allowedRejectedQuantity &&
      lot.reportedRejectedQuantity > Number(lot.lastReviewedReportedQuantity || 0)
    ) {
      throw new Error("Confirma primero si los rechazos por SPEC corresponden a piezas diferentes.");
    }
    const anomalies = reports.filter((report) => report.kind === "anomaly");
    const pending = anomalies.filter((report) => report.decision == null);
    if (pending.length > 0) {
      throw new Error(`Faltan ${pending.length} anormalidades por resolver.`);
    }
    const failedTitles = Array.from(new Set(
      anomalies
        .filter((report) => report.decision === "fail")
        .map((report) => report.title.trim())
        .filter(Boolean),
    ));
    const finalAnomalyQuantities = failedTitles.map((title) => {
      const quantity = Number(quantities[title]);
      if (!Number.isInteger(quantity) || quantity < 1 || quantity > lot.totalLotQuantity) {
        throw new Error(`Agrega una cantidad válida para “${title}”.`);
      }
      return { title, quantity };
    });
    if (!Number.isInteger(finalRejectedPieces) || finalRejectedPieces < 0 || finalRejectedPieces > lot.totalLotQuantity) {
      throw new Error("Agrega una cantidad válida de piezas que no pasaron la inspección.");
    }
    const lotReference = doc(db, "inspection_incoming_lots", context.scopeKey, "lots", lot.id);
    const batch = writeBatch(db);
    batch.update(lotReference, {
        status: "finalized",
        inspectionResult: lot.inspectionResult === "pending" ? "within_limit" : lot.inspectionResult,
        finalAnomalyQuantities,
        finalRejectedPieces,
        finalizedByUid: user.uid,
        finalizedByEmail: user.email || "",
        finalizedByName: displayName || user.displayName || user.email || "Usuario",
        finalizedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
    });
    anomalies
      .filter((report) => report.decision === "fail")
      .forEach((report) => {
        const finalQuantity = finalAnomalyQuantities.find((item) => item.title === report.title.trim())?.quantity;
        if (typeof finalQuantity === "number") {
          batch.update(doc(lotReference, "reports", report.id), {
            finalRejectedQuantity: finalQuantity,
            updatedAt: serverTimestamp(),
          });
        }
      });
    await batch.commit();
    await notify("lot_finalized");
  }, [context, displayName, lot, notify, reports, user]);

  return {
    reports,
    loading,
    saving,
    error,
    messagesByReport,
    canDecideAnomalies,
    createReport,
    addQuantity,
    addReportPhotos,
    addAnomalyMessage,
    resolveAnomaly,
    confirmUniqueRejectedQuantity,
    finalizeLot,
  };
}
