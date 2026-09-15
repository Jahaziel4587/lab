"use client";

import {
  addDoc,
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
} from "firebase/firestore";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/src/Context/AuthContext";
import { db } from "@/src/firebase/firebaseConfig";
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

export function useAnomalyThread({
  scopeKey,
  anomalyId,
  enabled = true,
}: Params) {
  const { user, displayName } = useAuth();
  const [anomaly, setAnomaly] = useState<InspectionAnomaly | null>(null);
  const [occurrences, setOccurrences] = useState<AnomalyOccurrence[]>([]);
  const [messages, setMessages] = useState<AnomalyMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [savingDecision, setSavingDecision] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled || !scopeKey || !anomalyId) {
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
          setError("La anormalidad ya no existe.");
        } else {
          const data = snapshot.data();
          setAnomaly({
            id: snapshot.id,
            title: String(data.title || ""),
            normalizedTitle: String(data.normalizedTitle || ""),
            status: data.status || "pending_title",
            decision: data.decision || null,
            decisionComment: data.decisionComment || undefined,
            decidedByUid: data.decidedByUid || undefined,
            decidedByEmail: data.decidedByEmail || undefined,
            decidedByName: data.decidedByName || undefined,
            decidedAt: data.decidedAt,
            responsiblePmUid: data.responsiblePmUid || undefined,
            responsiblePmEmail: data.responsiblePmEmail || undefined,
            responsiblePmName: data.responsiblePmName || undefined,
            createdByUid: String(data.createdByUid || ""),
            createdByEmail: String(data.createdByEmail || ""),
            createdAt: data.createdAt,
            updatedAt: data.updatedAt,
          });
          setError(null);
        }
        setLoading(false);
      },
      (cause) => {
        console.error("Error cargando anormalidad:", cause);
        setError("No fue posible cargar la anormalidad.");
        setLoading(false);
      },
    );
  }, [enabled, scopeKey, anomalyId]);

  useEffect(() => {
    if (!enabled || !scopeKey || !anomalyId) {
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
      query(reference, orderBy("createdAt", "asc")),
      (snapshot) => setOccurrences(snapshot.docs.map((entry) => ({
        id: entry.id,
        ...(entry.data() as Omit<AnomalyOccurrence, "id">),
      }))),
      (cause) => {
        console.error("Error cargando reportes:", cause);
        setError("No fue posible cargar los reportes.");
      },
    );
  }, [enabled, scopeKey, anomalyId]);

  useEffect(() => {
    if (!enabled || !scopeKey || !anomalyId) {
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
      query(reference, orderBy("createdAt", "asc")),
      (snapshot) => setMessages(snapshot.docs.map((entry) => ({
        id: entry.id,
        ...(entry.data() as Omit<AnomalyMessage, "id">),
      }))),
      (cause) => {
        console.error("Error cargando conversación:", cause);
        setError("No fue posible cargar la conversación.");
      },
    );
  }, [enabled, scopeKey, anomalyId]);

  const canDecide = useMemo(() => {
    const current = String(user?.email || "").trim().toLowerCase();
    const responsible = String(anomaly?.responsiblePmEmail || "").trim().toLowerCase();
    return Boolean(current && responsible && current === responsible);
  }, [user?.email, anomaly?.responsiblePmEmail]);

  const sendMessage = useCallback(async (textValue: string) => {
    if (!user || !scopeKey || !anomalyId) throw new Error("No hay una sesión activa.");
    const text = textValue.trim();
    if (!text) throw new Error("Escribe un mensaje.");
    try {
      setSending(true);
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
          text,
          createdByUid: user.uid,
          createdByEmail: user.email || "",
          createdByName: displayName || user.displayName || user.email || "Usuario",
          createdAt: serverTimestamp(),
        },
      );
    } finally {
      setSending(false);
    }
  }, [user, displayName, scopeKey, anomalyId]);

  const saveDecision = useCallback(async (input: {
    title: string;
    decision: Exclude<AnomalyDecision, null>;
    comment: string;
  }) => {
    if (!user || !scopeKey || !anomalyId) throw new Error("No hay una sesión activa.");
    if (!canDecide) throw new Error("Solo el PM responsable puede tomar esta decisión.");
    try {
      setSavingDecision(true);
      const token = await user.getIdToken();
      const response = await fetch("/api/inspections/anomalies/decision", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ scopeKey, anomalyId, ...input }),
      });
      const result = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(result?.error || "No fue posible guardar la decisión.");
      }
    } finally {
      setSavingDecision(false);
    }
  }, [user, scopeKey, anomalyId, canDecide]);

  return {
    anomaly,
    occurrences,
    messages,
    loading,
    sending,
    savingDecision,
    error,
    canDecide,
    sendMessage,
    saveDecision,
  };
}
