import { useEffect, useMemo, useRef, useState } from "react";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  runTransaction,
  setDoc,
  updateDoc,
} from "firebase/firestore";
import { db } from "@/src/firebase/firebaseConfig";
import {
  QuoteDraft,
  QuoteLine,
  QuoteMeta,
  ServiceDoc,
  PdfTemplateConf,
  OrgBranding,
} from "../types";
import { prettyKey, formatNumber } from "../utils";

export function useCotizacionViva(id?: string) {
  const [quoteMeta, setQuoteMeta] = useState<QuoteMeta | null>(null);
  const [quoteLines, setQuoteLines] = useState<
    Array<{ id: string; data: QuoteLine }>
  >([]);
  const [loadingQuote, setLoadingQuote] = useState(true);

  const [serviceLabelsMap, setServiceLabelsMap] = useState<
    Record<string, Record<string, string>>
  >({});

  const [draft, setDraft] = useState<QuoteDraft>({
    gananciaPct: 0,
    envio: 0,
  });

  const [branding, setBranding] = useState<OrgBranding>({});
  const [pdfTpl, setPdfTpl] = useState<PdfTemplateConf | null>(null);
  const [versions, setVersions] = useState<
    Array<{ id: string; url: string; total: number; createdAt?: any }>
  >([]);

  const [isGen, setIsGen] = useState(false);

  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cargarCotizacionViva = async () => {
    if (!id) return;

    setLoadingQuote(true);

    try {
      const metaRef = doc(db, "pedidos", id, "quote_live", "live");
      const metaSnap = await getDoc(metaRef);

      setQuoteMeta(metaSnap.exists() ? (metaSnap.data() as QuoteMeta) : null);

      const linesRef = collection(
        db,
        "pedidos",
        id,
        "quote_live",
        "live",
        "lines"
      );

      const qLines = query(linesRef, orderBy("createdAt", "asc"));
      const linesSnap = await getDocs(qLines);

      const rows: Array<{ id: string; data: QuoteLine }> = [];

      linesSnap.forEach((d) =>
        rows.push({ id: d.id, data: d.data() as QuoteLine })
      );

      setQuoteLines(rows);
    } catch (err) {
      console.error("No se pudo cargar cotización:", err);
      setQuoteMeta(null);
      setQuoteLines([]);
    } finally {
      setLoadingQuote(false);
    }
  };

  useEffect(() => {
    cargarCotizacionViva();
  }, [id]);

  useEffect(() => {
    const loadServices = async () => {
      try {
        const snap = await getDocs(collection(db, "services"));
        const map: Record<string, Record<string, string>> = {};

        snap.forEach((d) => {
          const data = d.data() as ServiceDoc;
          const inner: Record<string, string> = {};

          (data.fields || []).forEach((f) => {
            if (f?.key) inner[f.key] = f.label || f.key;
          });

          map[d.id] = inner;
        });

        setServiceLabelsMap(map);
      } catch (err) {
        console.error("No se pudieron cargar servicios:", err);
      }
    };

    loadServices();
  }, []);

  useEffect(() => {
    const loadDraft = async () => {
      if (!id) return;

      const ref = doc(db, "pedidos", id, "quote_draft", "current");
      const snap = await getDoc(ref);

      if (!snap.exists()) {
        const base: QuoteDraft = {
          gananciaPct: 0,
          envio: 0,
          notas: "",
        };

        await setDoc(ref, base);
        setDraft(base);
      } else {
        const data = snap.data() as QuoteDraft;

        setDraft({
          gananciaPct:
            typeof data.gananciaPct === "number" ? data.gananciaPct : 0,
          cliente: data.cliente || "",
          atencionA: data.atencionA || "",
          envio: typeof data.envio === "number" ? data.envio : 0,
          notas: data.notas || "",
        });
      }
    };

    loadDraft();
  }, [id]);

  const scheduleSave = (next: QuoteDraft) => {
    setDraft(next);

    if (saveTimer.current) clearTimeout(saveTimer.current);

    saveTimer.current = setTimeout(async () => {
      if (!id) return;

      const ref = doc(db, "pedidos", id, "quote_draft", "current");

      const payload = {
        gananciaPct: Number(next.gananciaPct) || 0,
        cliente: next.cliente || "",
        atencionA: next.atencionA || "",
        envio: Number(next.envio) || 0,
        notas: next.notas || "",
      };

      try {
        await updateDoc(ref, payload);
      } catch {
        await setDoc(ref, payload);
      }
    }, 500);
  };

  useEffect(() => {
    const loadBranding = async () => {
      try {
        const snap = await getDoc(doc(db, "org_settings", "branding"));
        if (snap.exists()) setBranding(snap.data() as OrgBranding);
      } catch {}
    };

    loadBranding();
  }, []);

  useEffect(() => {
    const loadTpl = async () => {
      try {
        const snap = await getDoc(doc(db, "org_settings", "pdf_template"));
        if (snap.exists()) setPdfTpl(snap.data() as PdfTemplateConf);
      } catch {}
    };

    loadTpl();
  }, []);

  const loadVersions = async () => {
    if (!id) return;

    try {
      const snap = await getDocs(
        query(
          collection(db, "pedidos", id, "quote_versions"),
          orderBy("createdAt", "desc")
        )
      );

      const arr: Array<{
        id: string;
        url: string;
        total: number;
        createdAt?: any;
      }> = [];

      snap.forEach((d) => {
        const data = d.data() as any;
        arr.push({
          id: d.id,
          url: data.url,
          total: data.total,
          createdAt: data.createdAt,
        });
      });

      setVersions(arr);
    } catch (err) {
      console.error("No se pudieron cargar versiones:", err);
    }
  };

  useEffect(() => {
    loadVersions();
  }, [id]);

  const subtotalBaseMXN = useMemo(
    () => quoteLines.reduce((acc, r) => acc + (r.data.subtotalMXN || 0), 0),
    [quoteLines]
  );

  const gananciaMonto = useMemo(
    () => subtotalBaseMXN * ((Number(draft.gananciaPct) || 0) / 100),
    [subtotalBaseMXN, draft.gananciaPct]
  );

  const subtotalConGananciaMXN = useMemo(
    () => subtotalBaseMXN + gananciaMonto,
    [subtotalBaseMXN, gananciaMonto]
  );

  const ivaMonto = useMemo(
    () => subtotalConGananciaMXN * 0.16,
    [subtotalConGananciaMXN]
  );

  const totalFinal = useMemo(
    () => subtotalConGananciaMXN + ivaMonto + (Number(draft.envio) || 0),
    [subtotalConGananciaMXN, ivaMonto, draft.envio]
  );

  const nextFolio = async (): Promise<string> => {
    const counterRef = doc(db, "counters", "quotes");

    const folio = await runTransaction(db, async (tx) => {
      const snap = await tx.get(counterRef);
      const last = snap.exists() ? (snap.data() as any).lastFolio || 0 : 0;
      const next = last + 1;

      tx.set(counterRef, { lastFolio: next }, { merge: true });

      return next as number;
    });

    return `Q-${String(folio).padStart(6, "0")}`;
  };

  const buildDetailsForLine = (d: QuoteLine) => {
    const labels = serviceLabelsMap[d.serviceId || ""] || {};

    const selectItems = Object.entries(d.selects || {})
      .filter(([_, v]) => !!v)
      .map(([k, v]) => `${labels[k] || prettyKey(k)}: ${v}`);

    const answerItems = Object.entries(d.answers || {})
      .filter(
        ([k, v]) =>
          typeof v === "number" &&
          Number.isFinite(v) &&
          v !== 0 &&
          !k.startsWith("is_")
      )
      .map(([k, v]) => `${labels[k] || prettyKey(k)}: ${formatNumber(v)}`);

    return [...selectItems, ...answerItems];
  };

  return {
    quoteMeta,
    quoteLines,
    loadingQuote,
    draft,
    scheduleSave,
    branding,
    pdfTpl,
    versions,
    setVersions,
    isGen,
    setIsGen,
    cargarCotizacionViva,
    loadVersions,
    subtotalBaseMXN,
    gananciaMonto,
    subtotalConGananciaMXN,
    ivaMonto,
    totalFinal,
    nextFolio,
    buildDetailsForLine,
  };
}