"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  doc,
  getDoc,
  collection,
  getDocs,
  query,
  orderBy,
  setDoc,
  updateDoc,
  runTransaction,
  serverTimestamp,
} from "firebase/firestore";
import {
  ref as storageRef,
  uploadBytes,
  getDownloadURL,
  getBytes,
} from "firebase/storage";
import { db, storage } from "@/src/firebase/firebaseConfig";
import { FiArrowLeft } from "react-icons/fi";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

// ---- Tipos ----
type QuoteMeta = {
  currency?: "MXN" | "USD";
  exchangeRate?: number;
  ivaDefault?: number;
  status?: "open" | "locked";
  createdAt?: any;
  updatedAt?: any;
};

type QuoteLine = {
  serviceId?: string;
  serviceName?: string;
  answers?: Record<string, number>;
  selects?: Record<string, string>;
  subtotalMXN?: number; // base en MXN
  createdAt?: any;
};

type ServiceField = { key: string; label: string; type: string; options?: string[] };
type ServiceDoc = { name: string; fields: ServiceField[] };

type QuoteDraft = {
  gananciaPct: number; // %
  cliente?: string;
  atencionA?: string;
  envio?: number; // MXN
  notas?: string;
};

// Branding opcional (si no existe, usamos defaults)
type OrgBranding = {
  companyName?: string;
  addressLine?: string;
  phone?: string;
  email?: string;
};

// ---- PDF Template types ----
type PdfCoords = {
  fecha?: { x: number; y: number };
  folio?: { x: number; y: number };
  cliente?: { x: number; y: number };
  atencion?: { x: number; y: number };
  subtotal?: { x: number; y: number };
  iva?: { x: number; y: number };
  envio?: { x: number; y: number };
  total?: { x: number; y: number };
  itemsArea: {
    x: number;
    yTop: number;
    width: number;
    lineHeight: number;
    yBottom: number;
  };
};
type PdfTemplateConf = { templatePath: string; coords: PdfCoords };

// ---- Utils ----
function prettyKey(k: string) {
  if (!k) return k;
  return k.replace(/_/g, " ").replace(/\b\w/g, (m) => m.toUpperCase());
}
function formatNumber(n: number) {
  if (Number.isInteger(n)) return n.toString();
  return n.toLocaleString(undefined, { maximumFractionDigits: 4 });
}
function formatMoney(n: number) {
  return `MXN ${n.toFixed(2)}`;
}
// helper: limpia datos para Firestore (sin funciones / undefined)
function sanitizeForFirestore<T = any>(val: T): T {
  if (val === undefined) return null as any;
  if (val === null) return val;
  if (typeof val === "function") return undefined as any;
  if (Array.isArray(val)) {
    return val
      .map((x) => sanitizeForFirestore(x))
      .filter((x) => x !== undefined) as any;
  }
  if (typeof val === "object") {
    const out: any = {};
    Object.entries(val as any).forEach(([k, v]) => {
      const clean = sanitizeForFirestore(v);
      if (clean !== undefined) out[k] = clean;
    });
    return out;
  }
  return val;
}

// Helpers PDF-LIB
function wrapLines(text: string, font: any, fontSize: number, maxWidth: number): string[] {
  if (!text) return [];
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let line = "";
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    const width = font.widthOfTextAtSize(test, fontSize);
    if (width <= maxWidth) line = test;
    else {
      if (line) lines.push(line);
      line = w;
    }
  }
  if (line) lines.push(line);
  return lines;
}

// Carga dinámica de pdfmake para que funcione en Next (client-side)
async function loadPdfMake() {
  const pdfMake = (await import("pdfmake/build/pdfmake")).default;
  const vfsFonts = await import("pdfmake/build/vfs_fonts");
  // @ts-ignore
  pdfMake.vfs = vfsFonts.vfs;
  return pdfMake;
}

export default function DetallePedidoPage() {
  const { id } = useParams();
  const router = useRouter();

  const [pedido, setPedido] = useState<any>(null);

  // Cotización Viva
  const [quoteMeta, setQuoteMeta] = useState<QuoteMeta | null>(null);
  const [quoteLines, setQuoteLines] = useState<Array<{ id: string; data: QuoteLine }>>([]);
  const [loadingQuote, setLoadingQuote] = useState<boolean>(true);

  // Mapa de etiquetas por servicio: serviceId -> (key -> label)
  const [serviceLabelsMap, setServiceLabelsMap] = useState<Record<string, Record<string, string>>>({});

  // Draft del PM (autosave)
  const [draft, setDraft] = useState<QuoteDraft>({ gananciaPct: 0, envio: 0 });
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Branding opcional
  const [branding, setBranding] = useState<OrgBranding>({});

  // Versiones existentes
  const [versions, setVersions] = useState<Array<{ id: string; url: string; total: number; createdAt?: any }>>([]);

  // PDF Template state
  const [pdfTpl, setPdfTpl] = useState<PdfTemplateConf | null>(null);

  // Estado de generación
  const [isGen, setIsGen] = useState(false);

  // --------- Cargar pedido ---------
  useEffect(() => {
    if (!id) return;
    const cargarPedido = async () => {
      try {
        const docRef = doc(db, "pedidos", id as string);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setPedido(docSnap.data());
        } else {
          alert("Pedido no encontrado.");
          router.push("/solicitudes");
        }
      } catch (err) {
        console.error("Error al obtener el pedido:", err);
        alert("Error al cargar el pedido.");
      }
    };
    cargarPedido();
  }, [id, router]);

  // --------- Cargar Cotización Viva ---------
  const cargarCotizacionViva = async () => {
    if (!id) return;
    setLoadingQuote(true);
    try {
      const metaRef = doc(db, "pedidos", id as string, "quote_live", "live");
      const metaSnap = await getDoc(metaRef);
      setQuoteMeta(metaSnap.exists() ? (metaSnap.data() as QuoteMeta) : null);

      const linesRef = collection(db, "pedidos", id as string, "quote_live", "live", "lines");
      const qLines = query(linesRef, orderBy("createdAt", "asc"));
      const linesSnap = await getDocs(qLines);
      const rows: Array<{ id: string; data: QuoteLine }> = [];
      linesSnap.forEach((d) => rows.push({ id: d.id, data: d.data() as QuoteLine }));
      setQuoteLines(rows);
    } catch (e) {
      console.error("No se pudo cargar la Cotización Viva:", e);
      setQuoteMeta(null);
      setQuoteLines([]);
    } finally {
      setLoadingQuote(false);
    }
  };
  useEffect(() => {
    cargarCotizacionViva();
  }, [id]);

  // --------- Cargar services (labels) ---------
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
      } catch (e) {
        console.error("No se pudieron cargar services para etiquetas:", e);
      }
    };
    loadServices();
  }, []);

  // --------- Cargar draft (y crear si no existe) ---------
  useEffect(() => {
    const loadDraft = async () => {
      if (!id) return;
      const ref = doc(db, "pedidos", id as string, "quote_draft", "current");
      const snap = await getDoc(ref);
      if (!snap.exists()) {
        const base: QuoteDraft = { gananciaPct: 0, envio: 0, notas: "" };
        await setDoc(ref, base);
        setDraft(base);
      } else {
        const data = snap.data() as QuoteDraft;
        setDraft({
          gananciaPct: typeof data.gananciaPct === "number" ? data.gananciaPct : 0,
          cliente: data.cliente || "",
          atencionA: data.atencionA || "",
          envio: typeof data.envio === "number" ? data.envio : 0,
          notas: data.notas || "",
        });
      }
    };
    loadDraft();
  }, [id]);

  // --------- Autosave draft (debounce) ---------
  const scheduleSave = (next: QuoteDraft) => {
    setDraft(next);
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      if (!id) return;
      try {
        const ref = doc(db, "pedidos", id as string, "quote_draft", "current");
        await updateDoc(ref, {
          gananciaPct: Number(next.gananciaPct) || 0,
          cliente: next.cliente || "",
          atencionA: next.atencionA || "",
          envio: Number(next.envio) || 0,
          notas: next.notas || "",
        });
      } catch {
        const ref = doc(db, "pedidos", id as string, "quote_draft", "current");
        await setDoc(ref, {
          gananciaPct: Number(next.gananciaPct) || 0,
          cliente: next.cliente || "",
          atencionA: next.atencionA || "",
          envio: Number(next.envio) || 0,
          notas: next.notas || "",
        });
      }
    }, 500);
  };

  // --------- Branding opcional ---------
  useEffect(() => {
    const loadBranding = async () => {
      try {
        const snap = await getDoc(doc(db, "org_settings", "branding"));
        if (snap.exists()) setBranding(snap.data() as OrgBranding);
      } catch {}
    };
    loadBranding();
  }, []);

  // --------- Cargar PDF Template ---------
  useEffect(() => {
    const loadTpl = async () => {
      try {
        const snap = await getDoc(doc(db, "org_settings", "pdf_template"));
        if (snap.exists()) setPdfTpl(snap.data() as PdfTemplateConf);
      } catch {}
    };
    loadTpl();
  }, []);

  // --------- Versiones existentes ---------
  useEffect(() => {
    const loadVersions = async () => {
      if (!id) return;
      try {
        const snap = await getDocs(
          query(collection(db, "pedidos", id as string, "quote_versions"), orderBy("createdAt", "desc"))
        );
        const arr: Array<{ id: string; url: string; total: number; createdAt?: any }> = [];
        snap.forEach((d) => {
          const data = d.data() as any;
          arr.push({ id: d.id, url: data.url, total: data.total, createdAt: data.createdAt });
        });
        setVersions(arr);
      } catch (e) {
        console.error("No se pudieron cargar versiones:", e);
      }
    };
    loadVersions();
  }, [id]);

  // --------- Cálculos (base MXN) ---------
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
  const IVA_PORC = 0.16;
  const ivaMonto = useMemo(() => subtotalConGananciaMXN * IVA_PORC, [subtotalConGananciaMXN]);
  const totalFinal = useMemo(
    () => subtotalConGananciaMXN + ivaMonto + (Number(draft.envio) || 0),
    [subtotalConGananciaMXN, ivaMonto, draft.envio]
  );

  // --------- Generar Folio con transacción ---------
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

  // --------- Armar detalles legibles por línea ---------
  const buildDetailsForLine = (d: QuoteLine) => {
    const labels = serviceLabelsMap[d.serviceId || ""] || {};
    const selectItems = Object.entries(d.selects || {})
      .filter(([_, v]) => !!v)
      .map(([k, v]) => `${labels[k] || prettyKey(k)}: ${v}`);

    const answerItems = Object.entries(d.answers || {})
      .filter(([k, v]) => typeof v === "number" && Number.isFinite(v) && v !== 0 && !k.startsWith("is_"))
      .map(([k, v]) => `${labels[k] || prettyKey(k)}: ${formatNumber(v as number)}`);

    return [...selectItems, ...answerItems];
  };

  // =========================
  // === Generar PDF (nuevo)
  // =========================
  const handleGenerarPDF = async (): Promise<boolean> => {
    try {
      if (!id) throw new Error("Sin id de pedido");
      if (quoteLines.length === 0) {
        alert("No hay líneas en la Cotización Viva.");
        return false;
      }

      const folio = await nextFolio();
      const fecha = new Date();

      // Tabla de servicios: total por servicio YA INCLUYE ganancia
      const filasServicios = quoteLines.map((ln) => {
        const d = ln.data;
        const base = d.subtotalMXN ?? 0;
        const inflado = base * (1 + (Number(draft.gananciaPct) || 0) / 100);
        const detalles = buildDetailsForLine(d);
        return { servicio: d.serviceName || d.serviceId || "Servicio", detalles, total: inflado };
      });

      // Cargar pdfmake
      const pdfMake = await loadPdfMake();

      // Intentar cargar LOGO desde Storage (varias rutas candidatas)
      const logoCandidates = ["logo", "logo.png", "org/logo", "org/logo.png"];
      const loadLogo = async (): Promise<string | null> => {
        for (const p of logoCandidates) {
          try {
            const r = storageRef(storage, p);
            const url = await getDownloadURL(r);
            const resp = await fetch(url);
            const blob = await resp.blob();
            const dataUrl = await new Promise<string>((resolve, reject) => {
              const reader = new FileReader();
              reader.onerror = () => reject(new Error("No se pudo leer el logo"));
              reader.onload = () => resolve(String(reader.result));
              reader.readAsDataURL(blob);
            });
            return dataUrl;
          } catch {
            // intenta siguiente
          }
        }
        return null;
      };
      const logoDataUrl = await loadLogo();

      // Branding por si quieres mostrarlo:
      const company = branding.companyName || "Bioana SAPI de CV";

      // Textos de secciones (edítalos a tu gusto)
      const generalInfo = [
        "Once the deposit payment is made, the order cannot be canceled either entirely or partially.",
        "Pieces with different or extra details mentioned in the quotation are not covered by the quotation.",
        "This parts are delivered without supports or raft. If additional post processing such as sanding or special considerations are needed, the supports within this quotation would appear as comments to explain the object’s geometry.",
      ];
      const conditionsInfo = [
        "Within 3-5 business days after receiving the deposit.",
        "Delivery will be at Bioana’s offices unless shipping has been agreed upon with Bioana staff.",
        "Bioana is not responsible for shipping once the package has left our offices.",
      ];
      const paymentInfo = [
        "To initiate the purchasing process, a purchase order and a 50% deposit are required.",
        "The payment can be made via electronic transfer to the account at the end of this document or as defined with Bioana staff.",
        "If the price is in US dollars, the exchange rate of Banorte on the day the payment is made will be applied.",
      ];

      // Construcción del documento
      const headerLeftStack: any[] = [];
      if (logoDataUrl) {
        headerLeftStack.push({ image: logoDataUrl, width: 120, margin: [0, 0, 0, 6] });
      }
      headerLeftStack.push({ text: company, bold: true, fontSize: 12 });

      const cotizadoPor = "Manuel García"; // puedes cambiarlo por el PM logueado si luego lo tienes

      const docDefinition: any = {
        pageSize: "A4",
        pageMargins: [40, 60, 40, 70],

        content: [
          // Encabezado
          {
            columns: [
              { width: "*", stack: headerLeftStack },
              {
                width: 220,
                table: {
                  widths: ["auto", "*"],
                  body: [
                    [{ text: "Fecha:", bold: true }, { text: fecha.toLocaleDateString() }],
                    [{ text: "Cotizado por:", bold: true }, { text: cotizadoPor }],
                  ],
                },
                layout: "noBorders",
              },
            ],
            margin: [0, 0, 0, 6],
          },

          // Cliente / Atención a
          {
            columns: [
              {
                width: "*",
                table: {
                  widths: [70, "*"],
                  body: [
                    [{ text: "Cliente:", bold: true }, { text: draft.cliente || "-" }],
                    [{ text: "Atención a:", bold: true }, { text: draft.atencionA || "-" }],
                  ],
                },
                layout: "noBorders",
                margin: [0, 0, 0, 10],
              },
            ],
          },

          // Tabla de servicios
          {
            table: {
              headerRows: 1,
              widths: ["*", "*", 90],
              body: [
                [
                  { text: "Servicio", style: "th" },
                  { text: "Detalles del servicio", style: "th" },
                  { text: "Total", style: "th" },
                ],
                ...filasServicios.map((f) => [
                  { text: f.servicio, bold: true },
                  { ul: f.detalles.length ? f.detalles : ["—"] },
                  { text: formatMoney(f.total), alignment: "right" },
                ]),
              ],
            },
            layout: {
              fillColor: (rowIndex: number) => (rowIndex === 0 ? "#f2f2f2" : null),
            },
            margin: [0, 6, 0, 10],
          },

          // Tabla de totales (debajo de servicios)
          {
            alignment: "right",
            table: {
              widths: [120, 120],
              body: [
                [{ text: "Subtotal:", bold: true }, { text: formatMoney(subtotalConGananciaMXN), alignment: "right" }],
                [{ text: "IVA (16%):", bold: true }, { text: formatMoney(ivaMonto), alignment: "right" }],
                [{ text: "Envío:", bold: true }, { text: formatMoney(Number(draft.envio) || 0), alignment: "right" }],
                [
                  { text: "TOTAL:", bold: true },
                  { text: formatMoney(totalFinal), bold: true, alignment: "right" },
                ],
              ],
            },
            layout: "lightHorizontalLines",
            margin: [0, 0, 0, 16],
          },

          // Bloques informativos con banda verde
          sectionBlock("General Information", generalInfo),
          { text: " " },
          sectionBlock("Conditions", conditionsInfo),
          { text: " " },
          sectionBlock("Payment", paymentInfo),

          // Notas del PM (opcional)
          draft.notas
            ? {
                margin: [0, 12, 0, 0],
                stack: [
                  { canvas: [{ type: "rect", x: 0, y: 0, w: 515, h: 1, color: "#e5e7eb" }] },
                  { text: "Notas", bold: true, margin: [0, 6, 0, 2] },
                  { text: draft.notas, fontSize: 9 },
                ],
              }
            : null,

          // Pie
          {
            margin: [0, 20, 0, 0],
            alignment: "center",
            stack: [
              { text: "¡Gracias por su preferencia!", italics: true, fontSize: 9 },
              {
                text:
                  "Calle Ángel Martínez Villarreal, Monterrey, NL, México\nmanuel.garcia@bioana.com.mx\nwww.bioanamedia.com",
                fontSize: 8,
                margin: [0, 4, 0, 0],
              },
            ],
          },
        ].filter(Boolean),

        styles: {
          th: { bold: true },
        },
        defaultStyle: { fontSize: 10 },
      };

      // helper para secciones con banda verde
      function sectionBlock(title: string, items: string[]) {
        return {
          table: {
            widths: ["*"],
            body: [
              [
                {
                  text: title,
                  color: "white",
                  margin: [6, 3, 6, 3],
                },
              ],
              [
                {
                  ul: items,
                  margin: [6, 6, 6, 6],
                  fontSize: 8.5,
                },
              ],
            ],
          },
          layout: {
            fillColor: (rowIndex: number) => (rowIndex === 0 ? "#1ABC80" : null),
            hLineWidth: () => 0.6,
            vLineWidth: () => 0.6,
            hLineColor: () => "#e5e7eb",
            vLineColor: () => "#e5e7eb",
          },
        };
      }

      // Generar blob
      const pdfBlob: Blob = await new Promise((resolve) => {
        const gen = pdfMake.createPdf(docDefinition);
        gen.getBlob((blob: Blob) => resolve(blob));
      });

      // Subir a Storage
      const filePath = `cotizaciones/${id}/${folio}.pdf`;
      const fileRef = storageRef(storage, filePath);
      await uploadBytes(fileRef, pdfBlob);
      const url = await getDownloadURL(fileRef);

      // Guardar versión en Firestore
      const versionDataRaw = {
        folio,
        url,
        cliente: draft.cliente || "",
        atencionA: draft.atencionA || "",
        envio: Number(draft.envio) || 0,
        notas: draft.notas || "",
        gananciaPct: Number(draft.gananciaPct) || 0,
        subtotalBaseMXN,
        gananciaMonto,
        subtotalConGananciaMXN,
        ivaMonto,
        total: totalFinal,
        createdAt: serverTimestamp(),
        lines: filasServicios.map((f) => ({ servicio: f.servicio, detalles: f.detalles, total: f.total })),
      };
      const versionDataClean = sanitizeForFirestore(versionDataRaw);
      await setDoc(doc(db, "pedidos", id as string, "quote_versions", folio), versionDataClean);

      alert(`PDF generado: ${folio}`);

      // refrescar versiones
      const snap = await getDocs(
        query(collection(db, "pedidos", id as string, "quote_versions"), orderBy("createdAt", "desc"))
      );
      const arr: Array<{ id: string; url: string; total: number; createdAt?: any }> = [];
      snap.forEach((d) => {
        const data = d.data() as any;
        arr.push({ id: d.id, url: data.url, total: data.total, createdAt: data.createdAt });
      });
      setVersions(arr);

      return true;
    } catch (err) {
      console.error("[handleGenerarPDF] Error:", err);
      alert("No se pudo generar el PDF.");
      return false;
    }
  };

  // --------- Generar PDF con plantilla (pdf-lib) ---------
  const handleGenerarPDF_Template = async (): Promise<boolean> => {
    try {
      if (!id) throw new Error("Sin id de pedido");
      if (!pdfTpl) throw new Error("No hay plantilla PDF configurada");
      if (quoteLines.length === 0) {
        alert("No hay líneas en la Cotización Viva.");
        return false;
      }

      const folio = await nextFolio();
      const fecha = new Date();

      // Descarga plantilla desde Storage
      const tplRef = storageRef(storage, pdfTpl.templatePath);
      const tplBytes = await getBytes(tplRef); // Uint8Array

      // pdf-lib setup
      const pdfDoc = await PDFDocument.load(tplBytes);
      const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
      const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
      let page = pdfDoc.getPages()[0];
      const { coords } = pdfTpl;

      const safeDraw = (key: keyof PdfCoords, text: string, size = 10, bold = false) => {
        const c = (coords as any)?.[key];
        if (!c) return;
        page.drawText(text ?? "", {
          x: c.x,
          y: c.y,
          size,
          color: rgb(0, 0, 0),
          font: bold ? fontBold : font,
        });
      };

      // Encabezado
      safeDraw("fecha", fecha.toLocaleDateString(), 10);
      safeDraw("folio", folio, 10, true);
      safeDraw("cliente", draft.cliente || "-", 12, true);
      safeDraw("atencion", draft.atencionA || "-", 10);

      // Resumen (sin base/ganancia)
      safeDraw("subtotal", `MXN ${subtotalConGananciaMXN.toFixed(2)}`);
      safeDraw("iva", `MXN ${ivaMonto.toFixed(2)}`);
      safeDraw("envio", `MXN ${(Number(draft.envio) || 0).toFixed(2)}`);
      safeDraw("total", `MXN ${totalFinal.toFixed(2)}`, 12, true);

      // Área de items
      const area = coords.itemsArea;
      if (!area) {
        alert("Faltan coords.itemsArea en la plantilla.");
        return false;
      }

      let cursorY = area.yTop;
      const lh = area.lineHeight;
      const maxWidth = area.width;
      const x = area.x;

      const newPageIfNeeded = () => {
        if (cursorY <= area.yBottom) {
          const size = page.getSize();
          page = pdfDoc.addPage([size.width, size.height]);
          cursorY = area.yTop;
        }
      };

      const filasServicios = quoteLines.map((ln) => {
        const d = ln.data;
        const base = d.subtotalMXN ?? 0;
        const inflado = base * (1 + (Number(draft.gananciaPct) || 0) / 100);
        const details = buildDetailsForLine(d);
        return { servicio: d.serviceName || d.serviceId || "Servicio", detalles: details, total: inflado };
      });

      for (const f of filasServicios) {
        newPageIfNeeded();
        page.drawText(f.servicio, { x, y: cursorY, size: 11, font: fontBold });
        const totalStr = `MXN ${f.total.toFixed(2)}`;
        const tw = font.widthOfTextAtSize(totalStr, 11);
        page.drawText(totalStr, { x: x + maxWidth - tw, y: cursorY, size: 11, font: fontBold });
        cursorY -= lh;

        const linesArr = f.detalles.length ? f.detalles : ["—"];
        for (const dline of linesArr) {
          newPageIfNeeded();
          const wrapped = wrapLines(dline, font, 10, maxWidth - 12);
          for (let i = 0; i < wrapped.length; i++) {
            newPageIfNeeded();
            const prefix = i === 0 ? "• " : "  ";
            page.drawText(prefix + wrapped[i], { x: x + 8, y: cursorY, size: 10, font });
            cursorY -= lh;
          }
        }
        cursorY -= 6;
      }

      if (draft.notas) {
        const notes = wrapLines(draft.notas, font, 10, maxWidth);
        for (const l of notes) {
          newPageIfNeeded();
          page.drawText(l, { x, y: cursorY, size: 10, font });
          cursorY -= lh;
        }
      }

      const pdfBytes = await pdfDoc.save(); // Uint8Array
      const filePath = `cotizaciones/${id}/${folio}.pdf`;
      const fileRef = storageRef(storage, filePath);
      await uploadBytes(fileRef, pdfBytes, { contentType: "application/pdf" });
      const url = await getDownloadURL(fileRef);

      const versionDataRaw = {
        folio,
        url,
        cliente: draft.cliente || "",
        atencionA: draft.atencionA || "",
        envio: Number(draft.envio) || 0,
        notas: draft.notas || "",
        gananciaPct: Number(draft.gananciaPct) || 0,
        subtotalBaseMXN,
        gananciaMonto,
        subtotalConGananciaMXN,
        ivaMonto,
        total: totalFinal,
        createdAt: serverTimestamp(),
        lines: filasServicios.map((f) => ({ servicio: f.servicio, detalles: f.detalles, total: f.total })),
        templateUsed: pdfTpl.templatePath,
      };
      const versionDataClean = sanitizeForFirestore(versionDataRaw);
      await setDoc(doc(db, "pedidos", id as string, "quote_versions", folio), versionDataClean);

      alert(`PDF con plantilla generado: ${folio}`);
      return true;
    } catch (err) {
      console.error("[handleGenerarPDF_Template] Error:", err);
      alert("No se pudo generar con la plantilla. Intentaré el formato genérico.");
      return false;
    }
  };

  if (!pedido) return <p className="text-black p-4">Cargando...</p>;

  return (
    <div className="max-w-3xl mx-auto p-4 text-black space-y-6">
      <button
        onClick={() => router.back()}
        className="bg-white text-black px-4 py-2 rounded hover:bg-gray-200 flex items-center gap-2"
      >
        <FiArrowLeft /> Regresar
      </button>

      <h1 className="text-xl font-bold">Detalles del pedido</h1>

      {/* ----- Datos base del pedido ----- */}
      <div className="bg-white shadow rounded-xl p-6 space-y-4">
        <p>
          <strong>Título:</strong> {pedido.titulo || "Sin título"}
        </p>
        <p>
          <strong>Proyecto:</strong> {pedido.proyecto}
        </p>
        <p>
          <strong>Servicio:</strong> {pedido.servicio}
        </p>
        <p>
          <strong>Máquina:</strong> {pedido.maquina}
        </p>
        <p>
          <strong>Material:</strong> {pedido.material}
        </p>
        <p>
          <strong>Descripción:</strong> {pedido.descripcion}
        </p>
        <p>
          <strong>Fecha de entrega propuesta:</strong> {pedido.fechaLimite}
        </p>
        <p>
          <strong>Fecha de entrega real:</strong> {pedido.fechaEntregaReal || "No definida"}
        </p>

        {/* Archivo legacy */}
        <p>
          <strong>Cotización (legacy):</strong>{" "}
          {pedido.costo && pedido.nombreCosto ? (
            <a href={pedido.costo} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">
              {pedido.nombreCosto}
            </a>
          ) : (
            "No definido"
          )}
        </p>

        <p>
          <strong>Status:</strong> {pedido.status || "Enviado"}
        </p>
      </div>

      {/* ----- COTIZACIÓN VIVA ----- */}
      <div id="cotizacion-viva" className="bg-white shadow rounded-xl p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Cotización Viva</h2>
          <button onClick={cargarCotizacionViva} className="px-3 py-1 rounded border hover:bg-gray-100" title="Actualizar">
            Refrescar
          </button>
        </div>

        {loadingQuote ? (
          <p>Cargando cotización…</p>
        ) : quoteLines.length === 0 ? (
          <p className="text-gray-600">
            Aún no hay líneas en la Cotización Viva para este pedido. Usa el cotizador y presiona “Adjuntar servicio a la
            cotización”.
          </p>
        ) : (
          <>
            {/* Meta informativa */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
              <div>
                <span className="font-medium">Moneda base:</span> MXN
              </div>
              <div>
                <span className="font-medium">Tasa USD→MXN:</span> {quoteMeta?.exchangeRate ?? 17}
              </div>
              <div>
                <span className="font-medium">IVA (default):</span> 16.00%
              </div>
            </div>

            {/* Tabla de servicios */}
            <div className="border border-gray-200 rounded-xl overflow-hidden">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="text-left px-3 py-2">Servicio</th>
                    <th className="text-left px-3 py-2">TÍTULO DEL PEDIDO</th>
                    <th className="text-left px-3 py-2">Total</th>
                    <th className="text-left px-3 py-2">Detalles del servicio</th>
                  </tr>
                </thead>
                <tbody>
                  {quoteLines.map((ln) => {
                    const d = ln.data;
                    const base = d.subtotalMXN ?? 0;
                    const inflado = base * (1 + (Number(draft.gananciaPct) || 0) / 100);
                    const details = buildDetailsForLine(d);
                    return (
                      <tr key={ln.id} className="border-t align-top">
                        <td className="px-3 py-2">
                          <div className="font-medium">{d.serviceName || d.serviceId || "—"}</div>
                        </td>
                        <td className="px-3 py-2">{pedido.titulo || "Sin título"}</td>
                        <td className="px-3 py-2">MXN {inflado.toFixed(2)}</td>
                        <td className="px-3 py-2">
                          {details.length === 0 ? (
                            <span className="text-gray-500">—</span>
                          ) : (
                            <ul className="list-disc pl-5 space-y-0.5">
                              {details.map((txt, i) => (
                                <li key={i}>{txt}</li>
                              ))}
                            </ul>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Resumen de totales */}
            <div className="space-y-2 text-right">
              <div className="font-semibold">Subtotal (base): {formatMoney(subtotalBaseMXN)}</div>

              <div className="flex items-center justify-end gap-2">
                <label className="text-sm" htmlFor="gananciaPct">
                  Ganancia (%):
                </label>
                <input
                  id="gananciaPct"
                  type="number"
                  step="10"
                  min="0"
                  value={draft.gananciaPct}
                  onChange={(e) => scheduleSave({ ...draft, gananciaPct: Number(e.target.value) })}
                  className="w-24 px-2 py-1 border rounded text-right"
                />
                <span className="ml-2">{formatMoney(gananciaMonto)}</span>
              </div>

              <div>
                <span className="font-medium">Subtotal con ganancia:</span> {formatMoney(subtotalConGananciaMXN)}
              </div>
              <div>
                <span className="font-medium">IVA (16%):</span> {formatMoney(ivaMonto)}
              </div>

              <div className="flex items-center justify-end gap-2">
                <label className="text-sm" htmlFor="envio">
                  Envío (MXN):
                </label>
                <input
                  id="envio"
                  type="number"
                  step="10"
                  min="0"
                  value={draft.envio ?? 0}
                  onChange={(e) => scheduleSave({ ...draft, envio: Number(e.target.value) })}
                  className="w-32 px-2 py-1 border rounded text-right"
                />
              </div>

              <div className="text-lg font-bold">TOTAL: {formatMoney(totalFinal)}</div>
            </div>

            <div className="text-xs text-gray-600">
              * El PDF mostrará los importes por servicio <strong>ya con ganancia</strong>, sin revelar el %.
            </div>

            <div className="pt-2">
              <button
                onClick={async () => {
  try {
    setIsGen(true);
    const ok = await handleGenerarPDF();   // ← siempre el genérico
    if (ok) await cargarCotizacionViva();
  } finally {
    setIsGen(false);
  }
}}

                disabled={isGen}
                className="px-4 py-2 rounded-xl bg-black text-white hover:opacity-90 disabled:opacity-50"
              >
                {isGen ? "Generando…" : "Generar PDF"}
              </button>
            </div>
          </>
        )}
      </div>

      {/* ----- Panel Draft (PM) ----- */}
      <div className="bg-white shadow rounded-xl p-6 space-y-4">
        <h2 className="text-lg font-semibold">Datos de cotización (draft)</h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium">Cliente</label>
            <input
              className="mt-1 w-full border rounded px-3 py-2"
              value={draft.cliente ?? ""}
              onChange={(e) => scheduleSave({ ...draft, cliente: e.target.value })}
            />
          </div>

          <div>
            <label className="block text-sm font-medium">Atención a</label>
            <input
              className="mt-1 w-full border rounded px-3 py-2"
              value={draft.atencionA ?? ""}
              onChange={(e) => scheduleSave({ ...draft, atencionA: e.target.value })}
            />
          </div>

          <div className="sm:col-span-2">
            <label className="block text-sm font-medium">Notas</label>
            <textarea
              className="mt-1 w-full border rounded px-3 py-2"
              rows={3}
              value={draft.notas ?? ""}
              onChange={(e) => scheduleSave({ ...draft, notas: e.target.value })}
            />
          </div>
        </div>

        <p className="text-xs text-gray-600">Este draft se guarda automáticamente y alimentará el PDF final.</p>
      </div>

      {/* ----- Versiones generadas ----- */}
      <div className="bg-white shadow rounded-xl p-6 space-y-3">
        <h2 className="text-lg font-semibold">Versiones generadas</h2>
        {versions.length === 0 ? (
          <p className="text-gray-600">Aún no hay versiones.</p>
        ) : (
          <ul className="space-y-2">
            {versions.map((v) => {
              const fecha = v.createdAt?.toDate?.() instanceof Date ? v.createdAt.toDate() : null;
              return (
                <li key={v.id} className="flex items-center justify-between border rounded p-2">
                  <div>
                    <div className="font-medium">{v.id}</div>
                    <div className="text-xs text-gray-600">
                      {fecha ? fecha.toLocaleString() : "—"} · Total: {formatMoney(v.total || 0)}
                    </div>
                  </div>
                  <a className="text-blue-600 underline" href={v.url} target="_blank" rel="noopener noreferrer">
                    Ver PDF
                  </a>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
