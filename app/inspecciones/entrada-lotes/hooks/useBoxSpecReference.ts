"use client";
import { useEffect, useState } from "react";
import { useAuth } from "@/src/Context/AuthContext";
import type { IncomingInspectionContext } from "../types";
import type { BoxSpecReference } from "@/lib/box/specMatching";

export function useBoxSpecReference(context?: IncomingInspectionContext) {
  const { user } = useAuth();
  const [spec, setSpec] = useState<BoxSpecReference | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [attempt, setAttempt] = useState(0);
  const source = context?.sourceType === "entrada_mts" ? "mts" : context?.sourceType === "entrada_proyecto" ? "project" : null;
  const wiCode = context?.wiCode;
  const projectId = context?.projectId;
  useEffect(() => {
    setSpec(null); setMessage("");
    if (!source || !wiCode || !user) { setLoading(false); return; }
    const controller = new AbortController();
    setLoading(true);
    (async () => {
      try {
        const token = await user.getIdToken();
        if (controller.signal.aborted) return;
        const params = new URLSearchParams({ source, wiCode });
        if (projectId) params.set("projectId", projectId);
        const response = await fetch(`/api/box/spec-reference?${params}`, { headers: { Authorization: `Bearer ${token}` }, signal: controller.signal });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || "No se pudo consultar la SPEC.");
        if (controller.signal.aborted) return;
        setSpec(result.spec || null);
        setMessage(result.spec ? `Referencia obtenida de Box: ${result.spec.originalFileName}` : result.reason || "No se encontró la SPEC. Captura la referencia manualmente.");
      } catch (error) {
        if (!controller.signal.aborted) setMessage(error instanceof Error ? error.message : "No se pudo consultar Box. Captura la referencia manualmente.");
      } finally { if (!controller.signal.aborted) setLoading(false); }
    })();
    return () => controller.abort();
  }, [source, wiCode, projectId, user, attempt]);
  return { spec, loading, message, retry: () => setAttempt(value => value + 1) };
}
