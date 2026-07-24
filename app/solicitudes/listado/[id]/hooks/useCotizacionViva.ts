import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  collection,
  doc,
  DocumentReference,
  CollectionReference,
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

import {
  prettyKey,
  formatNumber,
} from "../utils";

type QuoteVersion = {
  id: string;
  url: string;
  total: number;
  createdAt?: any;

  pedidoId?: string;
  ejecucionId?: string | null;
  numeroEjecucion?: number;
  tipoEjecucion?: "original" | "repeticion";
  etiquetaEjecucion?: string;
  tituloPedido?: string;
};

type QuoteRefs = {
  liveRef: DocumentReference;
  linesRef: CollectionReference;
  draftRef: DocumentReference;
  versionsRef: CollectionReference;
};

export function useCotizacionViva(
  pedidoId?: string,
  ejecucionId?: string | null
) {
  const [quoteMeta, setQuoteMeta] =
    useState<QuoteMeta | null>(null);

  const [quoteLines, setQuoteLines] = useState<
    Array<{
      id: string;
      data: QuoteLine;
    }>
  >([]);

  const [loadingQuote, setLoadingQuote] =
    useState(true);

  const [serviceLabelsMap, setServiceLabelsMap] =
    useState<
      Record<
        string,
        Record<string, string>
      >
    >({});

  const [draft, setDraft] =
    useState<QuoteDraft>({
      gananciaPct: 0,
      envio: 0,
      notas: "",
    });

  const [branding, setBranding] =
    useState<OrgBranding>({});

  const [pdfTpl, setPdfTpl] =
    useState<PdfTemplateConf | null>(null);

  const [versions, setVersions] =
    useState<QuoteVersion[]>([]);

  const [isGen, setIsGen] =
    useState(false);

  const saveTimer =
    useRef<ReturnType<
      typeof setTimeout
    > | null>(null);

  /**
   * Genera todas las referencias según el contexto.
   *
   * Original:
   * pedidos/{pedidoId}/quote_live/live
   *
   * Ejecución:
   * pedidos/{pedidoId}/ejecuciones/{ejecucionId}/quote_live/live
   */
  const getQuoteRefs =
    useCallback((): QuoteRefs | null => {
      if (!pedidoId) return null;

      if (ejecucionId) {
        return {
          liveRef: doc(
            db,
            "pedidos",
            pedidoId,
            "ejecuciones",
            ejecucionId,
            "quote_live",
            "live"
          ),

          linesRef: collection(
            db,
            "pedidos",
            pedidoId,
            "ejecuciones",
            ejecucionId,
            "quote_live",
            "live",
            "lines"
          ),

          draftRef: doc(
            db,
            "pedidos",
            pedidoId,
            "ejecuciones",
            ejecucionId,
            "quote_draft",
            "current"
          ),

          versionsRef: collection(
            db,
            "pedidos",
            pedidoId,
            "ejecuciones",
            ejecucionId,
            "quote_versions"
          ),
        };
      }

      return {
        liveRef: doc(
          db,
          "pedidos",
          pedidoId,
          "quote_live",
          "live"
        ),

        linesRef: collection(
          db,
          "pedidos",
          pedidoId,
          "quote_live",
          "live",
          "lines"
        ),

        draftRef: doc(
          db,
          "pedidos",
          pedidoId,
          "quote_draft",
          "current"
        ),

        versionsRef: collection(
          db,
          "pedidos",
          pedidoId,
          "quote_versions"
        ),
      };
    }, [
      pedidoId,
      ejecucionId,
    ]);

  /**
   * Carga la cotización viva correspondiente a la
   * original o a la ejecución seleccionada.
   */
  const cargarCotizacionViva =
    useCallback(async () => {
      const refs = getQuoteRefs();

      if (!refs) {
        setQuoteMeta(null);
        setQuoteLines([]);
        setLoadingQuote(false);
        return;
      }

      setLoadingQuote(true);

      /*
       * Limpiamos inmediatamente el contexto anterior.
       * Esto evita mostrar por un instante la cotización
       * de otra ejecución.
       */
      setQuoteMeta(null);
      setQuoteLines([]);

      try {
        const metaPromise =
          getDoc(refs.liveRef);

        const linesPromise =
          getDocs(
            query(
              refs.linesRef,
              orderBy(
                "createdAt",
                "asc"
              )
            )
          );

        const [
          metaSnap,
          linesSnap,
        ] = await Promise.all([
          metaPromise,
          linesPromise,
        ]);

        setQuoteMeta(
          metaSnap.exists()
            ? (metaSnap.data() as QuoteMeta)
            : null
        );

        const rows: Array<{
          id: string;
          data: QuoteLine;
        }> = [];

        linesSnap.forEach(
          (lineDoc) => {
            rows.push({
              id: lineDoc.id,
              data:
                lineDoc.data() as QuoteLine,
            });
          }
        );

        setQuoteLines(rows);
      } catch (error) {
        console.error(
          "No se pudo cargar la cotización:",
          {
            pedidoId,
            ejecucionId:
              ejecucionId || null,
            error,
          }
        );

        setQuoteMeta(null);
        setQuoteLines([]);
      } finally {
        setLoadingQuote(false);
      }
    }, [
      getQuoteRefs,
      pedidoId,
      ejecucionId,
    ]);

  useEffect(() => {
    void cargarCotizacionViva();
  }, [cargarCotizacionViva]);

  /**
   * Carga el catálogo de servicios para convertir
   * claves internas en etiquetas legibles.
   */
  useEffect(() => {
    const loadServices = async () => {
      try {
        const snap = await getDocs(
          collection(db, "services")
        );

        const map: Record<
          string,
          Record<string, string>
        > = {};

        snap.forEach((serviceDoc) => {
          const data =
            serviceDoc.data() as ServiceDoc;

          const inner: Record<
            string,
            string
          > = {};

          (data.fields || []).forEach(
            (field) => {
              if (field?.key) {
                inner[field.key] =
                  field.label ||
                  field.key;
              }
            }
          );

          map[serviceDoc.id] = inner;
        });

        setServiceLabelsMap(map);
      } catch (error) {
        console.error(
          "No se pudieron cargar servicios:",
          error
        );
      }
    };

    void loadServices();
  }, []);

  /**
   * Carga el borrador correspondiente al contexto.
   */
  const loadDraft =
    useCallback(async () => {
      const refs = getQuoteRefs();

      if (!refs) return;

      /*
       * Restablecemos valores mientras cambia el contexto.
       */
      setDraft({
        gananciaPct: 0,
        envio: 0,
        notas: "",
      });

      try {
        const snap = await getDoc(
          refs.draftRef
        );

        if (!snap.exists()) {
          const base: QuoteDraft = {
            gananciaPct: 0,
            envio: 0,
            notas: "",
            cliente: "",
            atencionA: "",
          };

          await setDoc(
            refs.draftRef,
            base
          );

          setDraft(base);
          return;
        }

        const data =
          snap.data() as QuoteDraft;

        setDraft({
          gananciaPct:
            typeof data.gananciaPct ===
            "number"
              ? data.gananciaPct
              : 0,

          cliente:
            data.cliente || "",

          atencionA:
            data.atencionA || "",

          envio:
            typeof data.envio ===
            "number"
              ? data.envio
              : 0,

          notas:
            data.notas || "",
        });
      } catch (error) {
        console.error(
          "No se pudo cargar el borrador de cotización:",
          {
            pedidoId,
            ejecucionId:
              ejecucionId || null,
            error,
          }
        );

        setDraft({
          gananciaPct: 0,
          envio: 0,
          notas: "",
          cliente: "",
          atencionA: "",
        });
      }
    }, [
      getQuoteRefs,
      pedidoId,
      ejecucionId,
    ]);

  useEffect(() => {
    void loadDraft();
  }, [loadDraft]);

  /**
   * Guarda el borrador con debounce.
   */
  const scheduleSave =
    useCallback(
      (next: QuoteDraft) => {
        setDraft(next);

        if (saveTimer.current) {
          clearTimeout(
            saveTimer.current
          );
        }

        saveTimer.current =
          setTimeout(async () => {
            const refs =
              getQuoteRefs();

            if (!refs) return;

            const payload = {
              gananciaPct:
                Number(
                  next.gananciaPct
                ) || 0,

              cliente:
                next.cliente || "",

              atencionA:
                next.atencionA || "",

              envio:
                Number(next.envio) ||
                0,

              notas:
                next.notas || "",
            };

            try {
              await setDoc(
                refs.draftRef,
                payload,
                {
                  merge: true,
                }
              );
            } catch (error) {
              console.error(
                "No se pudo guardar el borrador:",
                {
                  pedidoId,
                  ejecucionId:
                    ejecucionId ||
                    null,
                  error,
                }
              );
            }
          }, 500);
      },
      [
        getQuoteRefs,
        pedidoId,
        ejecucionId,
      ]
    );

  /**
   * Cancela un guardado pendiente al desmontar
   * o cambiar de ejecución.
   */
  useEffect(() => {
    return () => {
      if (saveTimer.current) {
        clearTimeout(
          saveTimer.current
        );
      }
    };
  }, [
    pedidoId,
    ejecucionId,
  ]);

  useEffect(() => {
    const loadBranding =
      async () => {
        try {
          const snap = await getDoc(
            doc(
              db,
              "org_settings",
              "branding"
            )
          );

          if (snap.exists()) {
            setBranding(
              snap.data() as OrgBranding
            );
          }
        } catch (error) {
          console.error(
            "No se pudo cargar branding:",
            error
          );
        }
      };

    void loadBranding();
  }, []);

  useEffect(() => {
    const loadTpl = async () => {
      try {
        const snap = await getDoc(
          doc(
            db,
            "org_settings",
            "pdf_template"
          )
        );

        if (snap.exists()) {
          setPdfTpl(
            snap.data() as PdfTemplateConf
          );
        }
      } catch (error) {
        console.error(
          "No se pudo cargar la plantilla PDF:",
          error
        );
      }
    };

    void loadTpl();
  }, []);

  /**
   * Carga las versiones PDF del contexto seleccionado.
   */
  const loadVersions =
    useCallback(async () => {
      const refs = getQuoteRefs();

      if (!refs) {
        setVersions([]);
        return;
      }

      setVersions([]);

      try {
        const snap = await getDocs(
          query(
            refs.versionsRef,
            orderBy(
              "createdAt",
              "desc"
            )
          )
        );

        const arr: QuoteVersion[] =
          [];

        snap.forEach(
          (versionDoc) => {
            const data =
              versionDoc.data() as any;

            arr.push({
              id: versionDoc.id,
              url: data.url || "",
              total:
                Number(data.total) ||
                0,

              createdAt:
                data.createdAt,

              pedidoId:
                data.pedidoId ||
                pedidoId,

              ejecucionId:
                data.ejecucionId ??
                ejecucionId ??
                null,

              numeroEjecucion:
                Number(
                  data.numeroEjecucion
                ) ||
                (ejecucionId
                  ? undefined
                  : 1),

              tipoEjecucion:
                data.tipoEjecucion ||
                (ejecucionId
                  ? "repeticion"
                  : "original"),

              etiquetaEjecucion:
                data.etiquetaEjecucion ||
                (ejecucionId
                  ? "Repetición"
                  : "Ejecución 1 · Original"),

              tituloPedido:
                data.tituloPedido ||
                "",
            });
          }
        );

        setVersions(arr);
      } catch (error) {
        console.error(
          "No se pudieron cargar las versiones:",
          {
            pedidoId,
            ejecucionId:
              ejecucionId || null,
            error,
          }
        );

        setVersions([]);
      }
    }, [
      getQuoteRefs,
      pedidoId,
      ejecucionId,
    ]);

  useEffect(() => {
    void loadVersions();
  }, [loadVersions]);

  const subtotalBaseMXN =
    useMemo(() => {
      return quoteLines.reduce(
        (accumulator, row) =>
          accumulator +
          Number(
            row.data.subtotalMXN ||
              0
          ),
        0
      );
    }, [quoteLines]);

  const gananciaMonto =
    useMemo(() => {
      return (
        subtotalBaseMXN *
        ((Number(
          draft.gananciaPct
        ) ||
          0) /
          100)
      );
    }, [
      subtotalBaseMXN,
      draft.gananciaPct,
    ]);

  const subtotalConGananciaMXN =
    useMemo(() => {
      return (
        subtotalBaseMXN +
        gananciaMonto
      );
    }, [
      subtotalBaseMXN,
      gananciaMonto,
    ]);

  const ivaMonto =
    useMemo(() => {
      return (
        subtotalConGananciaMXN *
        0.16
      );
    }, [
      subtotalConGananciaMXN,
    ]);

  const totalFinal =
    useMemo(() => {
      return (
        subtotalConGananciaMXN +
        ivaMonto +
        (Number(draft.envio) ||
          0)
      );
    }, [
      subtotalConGananciaMXN,
      ivaMonto,
      draft.envio,
    ]);

  /**
   * El folio sigue siendo global para evitar duplicados
   * entre originales y ejecuciones.
   */
  const nextFolio =
    async (): Promise<string> => {
      const counterRef = doc(
        db,
        "counters",
        "quotes"
      );

      const folio =
        await runTransaction(
          db,
          async (transaction) => {
            const snap =
              await transaction.get(
                counterRef
              );

            const last =
              snap.exists()
                ? Number(
                    (
                      snap.data() as any
                    ).lastFolio ||
                      0
                  )
                : 0;

            const next =
              last + 1;

            transaction.set(
              counterRef,
              {
                lastFolio:
                  next,
              },
              {
                merge: true,
              }
            );

            return next;
          }
        );

      return `Q-${String(
        folio
      ).padStart(6, "0")}`;
    };

  const buildDetailsForLine =
    useCallback(
      (line: QuoteLine) => {
        const labels =
          serviceLabelsMap[
            line.serviceId || ""
          ] || {};

        const selectItems =
          Object.entries(
            line.selects || {}
          )
            .filter(
              ([, value]) =>
                Boolean(value)
            )
            .map(
              ([key, value]) =>
                `${
                  labels[key] ||
                  prettyKey(key)
                }: ${value}`
            );

        const answerItems =
          Object.entries(
            line.answers || {}
          )
            .filter(
              ([key, value]) =>
                typeof value ===
                  "number" &&
                Number.isFinite(
                  value
                ) &&
                value !== 0 &&
                !key.startsWith(
                  "is_"
                )
            )
            .map(
              ([key, value]) =>
                `${
                  labels[key] ||
                  prettyKey(key)
                }: ${formatNumber(
                  value as number
                )}`
            );

        return [
          ...selectItems,
          ...answerItems,
        ];
      },
      [serviceLabelsMap]
    );

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

    pedidoId,
    ejecucionId:
      ejecucionId || null,

    esCotizacionOriginal:
      !ejecucionId,
  };
}