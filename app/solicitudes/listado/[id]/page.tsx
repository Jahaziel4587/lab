"use client";

import { useEffect, useMemo, useRef, useState, FormEvent } from "react";
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
  addDoc,
  onSnapshot,
} from "firebase/firestore";
import {
  ref as storageRef,
  uploadBytes,
  getDownloadURL,
  getBytes,
  listAll,
} from "firebase/storage";
import { db, storage } from "@/src/firebase/firebaseConfig";
import { FiArrowLeft, FiX, FiChevronUp, FiChevronDown } from "react-icons/fi";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { useAuth } from "@/src/Context/AuthContext";

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
  subtotalMXN?: number;
  createdAt?: any;
};

type ServiceField = { key: string; label: string; type: string; options?: string[] };
type ServiceDoc = { name: string; fields: ServiceField[] };

type QuoteDraft = {
  gananciaPct: number;
  cliente?: string;
  atencionA?: string;
  envio?: number;
  notas?: string;
};

type OrgBranding = {
  companyName?: string;
  addressLine?: string;
  phone?: string;
  email?: string;
};

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

type SpecUpdate = {
  id: string;
  version: number;
  descripcion: string;
  createdAt?: any;
  archivos?: { name: string; url: string }[];
};

type ChatMessage = {
  id: string;
  text: string;
  createdAt?: any;
  userId?: string | null;
  userName?: string | null;
  userEmail?: string;
  isAdmin?: boolean;
  vistoPorUser?: boolean;
  vistoPorAdmin?: boolean;
  notificacionCreada?: boolean;
};

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

  const { isAdmin, user } = useAuth() as any;

  const [pedido, setPedido] = useState<any>(null);

  // Cotización Viva
  const [quoteMeta, setQuoteMeta] = useState<QuoteMeta | null>(null);
  const [quoteLines, setQuoteLines] = useState<Array<{ id: string; data: QuoteLine }>>([]);
  const [loadingQuote, setLoadingQuote] = useState<boolean>(true);

  // Mapa de etiquetas por servicio
  const [serviceLabelsMap, setServiceLabelsMap] = useState<Record<string, Record<string, string>>>({});

  // Draft del PM (autosave)
  const [draft, setDraft] = useState<QuoteDraft>({ gananciaPct: 0, envio: 0 });
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Branding
  const [branding, setBranding] = useState<OrgBranding>({});

  // Versiones
  const [versions, setVersions] = useState<Array<{ id: string; url: string; total: number; createdAt?: any }>>([]);

  // PDF Template state
  const [pdfTpl, setPdfTpl] = useState<PdfTemplateConf | null>(null);

  // Estado de generación
  const [isGen, setIsGen] = useState(false);

  // Archivos adjuntos
  const [filesLoading, setFilesLoading] = useState<boolean>(false);
  const [files, setFiles] = useState<Array<{ name: string; url: string }>>([]);

  // versiones de especificaciones
  const [specUpdates, setSpecUpdates] = useState<SpecUpdate[]>([]);
  const [showSpecForm, setShowSpecForm] = useState(false);
  const [specDesc, setSpecDesc] = useState("");
  const [specFiles, setSpecFiles] = useState<File[]>([]);
  const [savingSpec, setSavingSpec] = useState(false);
  const specInputRef = useRef<HTMLInputElement | null>(null);

  // Chat
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const chatEndRef = useRef<HTMLDivElement | null>(null);

  const [nameByEmail, setNameByEmail] = useState<Record<string, string>>({});

  const ownerEmail: string | null = pedido?.correoUsuario || pedido?.usuario || null;

  // ======== UI helpers (clases) ========
  const cardClass =
    "rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-xl shadow-[0_30px_120px_-90px_rgba(0,0,0,0.95)]";
  const cardPad = "p-5 sm:p-6";
  const muted = "text-white/60";
  const label = "text-white/70";
  const value = "text-white/90";

  const inputClass =
    "w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 text-sm text-white placeholder:text-white/35 " +
    "focus:outline-none focus:ring-2 focus:ring-emerald-400/30";
  const textareaClass =
    "w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 text-sm text-white placeholder:text-white/35 " +
    "focus:outline-none focus:ring-2 focus:ring-emerald-400/30 resize-none";

  const pillBase =
    "px-3 py-1 rounded-full text-[11px] font-semibold border inline-flex items-center justify-center whitespace-nowrap";
  const normStatus = (s: any) => String(s || "").trim().toLowerCase();
  const statusPillClass = (status: any) => {
    const s = normStatus(status);
    if (s === "en proceso")
      return `${pillBase} bg-yellow-500/15 text-yellow-200 border-yellow-400/30 shadow-[0_10px_28px_-18px_rgba(234,179,8,0.75)]`;
    if (s === "listo")
      return `${pillBase} bg-emerald-500/15 text-emerald-200 border-emerald-400/30 shadow-[0_10px_28px_-18px_rgba(45,212,191,0.75)]`;
    if (s === "cancelado")
      return `${pillBase} bg-red-500/15 text-red-200 border-red-400/30 shadow-[0_10px_28px_-18px_rgba(239,68,68,0.7)]`;
    return `${pillBase} bg-white/5 text-white/80 border-white/15`;
  };
  const statusLabel = (s: any) => {
    const v = String(s || "enviado");
    return v.replace(/\b\w/g, (c) => c.toUpperCase());
  };

  const btnGhost =
    "inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-4 py-2 text-sm text-white/90 hover:bg-white/10 transition";
  const btnSoft =
    "inline-flex items-center justify-center rounded-xl border border-white/12 bg-white/5 px-4 py-2 text-sm text-white/85 hover:bg-white/10 transition";
  const btnPrimary =
    "inline-flex items-center justify-center rounded-xl bg-emerald-500/15 border border-emerald-400/30 px-4 py-2 text-sm text-emerald-100 hover:bg-emerald-500/20 transition shadow-[0_12px_30px_-22px_rgba(16,185,129,0.9)]";
  const btnDanger =
    "inline-flex items-center justify-center rounded-xl border border-red-400/25 bg-red-500/10 px-3 py-2 text-sm text-red-200 hover:bg-red-500/15 transition";

  // === Carga nombres (email->nombre) ===
  useEffect(() => {
    const loadUsers = async () => {
      try {
        const snap = await getDocs(collection(db, "users"));
        const map: Record<string, string> = {};
        snap.forEach((d) => {
          const data = d.data() as any;
          const email = data.email as string | undefined;
          const nombre = data.nombre as string | undefined;
          const apellido = data.apellido as string | undefined;
          if (email && nombre) map[email] = apellido ? `${nombre} ${apellido}` : nombre;
        });
        setNameByEmail(map);
      } catch (e) {
        console.error("No se pudieron cargar los usuarios para el chat:", e);
      }
    };
    loadUsers();
  }, []);

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

  // --------- Cargar archivos adjuntos ---------
  useEffect(() => {
    const listarAdjuntos = async () => {
      if (!id) return;
      setFilesLoading(true);
      try {
        const refById = storageRef(storage, `pedidos/${id as string}`);
        let items = (await listAll(refById)).items;

        if (items.length === 0 && pedido?.titulo) {
          try {
            const refByTitle = storageRef(storage, `pedidos/${pedido.titulo}`);
            items = (await listAll(refByTitle)).items;
          } catch {}
        }

        items = items.filter((it) => !it.name.startsWith("spec_v"));

        const out = await Promise.all(
          items.map(async (it) => {
            const url = await getDownloadURL(it);
            const name = decodeURIComponent(
  url.split("/").pop()?.split("?")[0] || ""
).split("/").pop() || "archivo";

            return { name, url };
          })
        );
        setFiles(out);
      } catch (e) {
        console.warn("No se pudieron listar adjuntos del pedido:", e);
        setFiles([]);
      } finally {
        setFilesLoading(false);
      }
    };
    listarAdjuntos();
  }, [id, pedido?.titulo]);

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

  // --------- Cargar versiones de especificaciones ---------
  const loadSpecUpdates = async () => {
    if (!id) return;
    try {
      const qSpecs = query(collection(db, "pedidos", id as string, "spec_updates"), orderBy("createdAt", "asc"));
      const snap = await getDocs(qSpecs);
      const arr: SpecUpdate[] = [];
      snap.forEach((d) => {
        const data = d.data() as any;
        arr.push({
          id: d.id,
          version: data.version ?? 2,
          descripcion: data.descripcion || "",
          createdAt: data.createdAt,
          archivos: (data.archivos || []) as { name: string; url: string }[],
        });
      });
      setSpecUpdates(arr);
    } catch (e) {
      console.error("No se pudieron cargar especificaciones adicionales:", e);
    }
  };
  useEffect(() => {
    loadSpecUpdates();
  }, [id]);

  // --------- CHAT: suscripción en tiempo real ---------
  useEffect(() => {
    if (!id) return;

    const qChat = query(collection(db, "pedidos", id as string, "chat"), orderBy("createdAt", "asc"));
    const unsub = onSnapshot(
      qChat,
      (snap) => {
        const arr: ChatMessage[] = [];
        snap.forEach((d) => {
          const data = d.data() as any;
          arr.push({
            id: d.id,
            text: data.text || "",
            createdAt: data.createdAt,
            userId: data.userId,
            userName: data.userName,
            userEmail: data.userEmail ?? data.userName ?? null,
            isAdmin: data.isAdmin,
            vistoPorUser: data.vistoPorUser ?? false,
            vistoPorAdmin: data.vistoPorAdmin ?? false,
            notificacionCreada: data.notificacionCreada ?? false,
          });
        });
        setChatMessages(arr);
      },
      (err) => console.error("Error escuchando chat:", err)
    );

    return () => unsub();
  }, [id]);

  // --------- CHAT: marcar mensajes como "visto" ---------
  useEffect(() => {
    if (!id || !user) return;
    if (chatMessages.length === 0) return;

    const updates: Promise<void>[] = [];
    chatMessages.forEach((m) => {
      const esMio = m.userId === user.uid;

      if (isAdmin) {
        if (!esMio && !m.vistoPorAdmin) {
          const ref = doc(db, "pedidos", id as string, "chat", m.id);
          updates.push(updateDoc(ref, { vistoPorAdmin: true }));
        }
      } else {
        if (!esMio && !m.vistoPorUser) {
          const ref = doc(db, "pedidos", id as string, "chat", m.id);
          updates.push(updateDoc(ref, { vistoPorUser: true }));
        }
      }
    });

    if (updates.length > 0) {
      Promise.all(updates).catch((err) => console.error("Error al marcar mensajes como vistos:", err));
    }
  }, [chatMessages, id, isAdmin, user]);

  // scroll a último mensaje SOLO dentro del recuadro de chat
  useEffect(() => {
    if (!chatEndRef.current) return;
    const parent = chatEndRef.current.parentElement;
    if (!parent) return;

    parent.scrollTo({
      top: parent.scrollHeight,
      behavior: "smooth",
    });
  }, [chatMessages.length]);

  // --------- Cálculos (base MXN) ---------
  const subtotalBaseMXN = useMemo(
    () => quoteLines.reduce((acc, r) => acc + (r.data.subtotalMXN || 0), 0),
    [quoteLines]
  );
  const gananciaMonto = useMemo(
    () => subtotalBaseMXN * ((Number(draft.gananciaPct) || 0) / 100),
    [subtotalBaseMXN, draft.gananciaPct]
  );
  const subtotalConGananciaMXN = useMemo(() => subtotalBaseMXN + gananciaMonto, [subtotalBaseMXN, gananciaMonto]);
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
  // === Generar PDF (genérico)
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

      const filasServicios = quoteLines.map((ln) => {
        const d = ln.data;
        const base = d.subtotalMXN ?? 0;
        const inflado = base * (1 + (Number(draft.gananciaPct) || 0) / 100);
        const detalles = buildDetailsForLine(d);
        return { servicio: d.serviceName || d.serviceId || "Servicio", detalles, total: inflado };
      });

      const pdfMake = await loadPdfMake();

      // Logo opcional
      const logoCandidates = ["org/logo.png"];
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
          } catch {}
        }
        return null;
      };
      const logoDataUrl = await loadLogo();

      const company = branding.companyName || "Bioana SAPI de CV";
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

      function sectionBlock(title: string, items: string[]) {
        return {
          table: {
            widths: ["*"],
            body: [
              [{ text: title, color: "white", margin: [6, 3, 6, 3] }],
              [{ ul: items, margin: [6, 6, 6, 6], fontSize: 8.5 }],
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

      const cotizadoPor = "Manuel García";

      const docDefinition: any = {
        pageSize: "A4",
        pageMargins: [40, 60, 40, 70],
        content: [
          {
            columns: [
              {
                width: "*",
                stack: [
                  ...(logoDataUrl ? [{ image: logoDataUrl, width: 120, margin: [0, 0, 0, 6] }] : []),
                  { text: company, bold: true, fontSize: 12 },
                ],
              },
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
          {
            table: {
              headerRows: 1,
              widths: ["*", "*", 90],
              body: [
                [{ text: "Servicio", style: "th" }, { text: "Detalles del servicio", style: "th" }, { text: "Total", style: "th" }],
                ...filasServicios.map((f) => [
                  { text: f.servicio, bold: true },
                  { ul: f.detalles.length ? f.detalles : ["—"] },
                  { text: formatMoney(f.total), alignment: "right" },
                ]),
              ],
            },
            layout: { fillColor: (rowIndex: number) => (rowIndex === 0 ? "#f2f2f2" : null) },
            margin: [0, 6, 0, 10],
          },
          {
            columns: [
              { width: "*", text: "" },
              {
                width: 260,
                table: {
                  widths: [120, 120],
                  body: [
                    [{ text: "Subtotal:", bold: true }, { text: formatMoney(subtotalConGananciaMXN), alignment: "right" }],
                    [{ text: "IVA (16%):", bold: true }, { text: formatMoney(ivaMonto), alignment: "right" }],
                    [{ text: "Envío:", bold: true }, { text: formatMoney(Number(draft.envio) || 0), alignment: "right" }],
                    [{ text: "TOTAL:", bold: true }, { text: formatMoney(totalFinal), bold: true, alignment: "right" }],
                  ],
                },
                layout: "lightHorizontalLines",
              },
            ],
            margin: [0, 0, 0, 16],
          },
          sectionBlock("General Information", generalInfo),
          { text: " " },
          sectionBlock("Conditions", conditionsInfo),
          { text: " " },
          sectionBlock("Payment", paymentInfo),
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
          {
            margin: [0, 20, 0, 0],
            alignment: "center",
            stack: [
              { text: "¡Gracias por su preferencia!", italics: true, fontSize: 9 },
              {
                text:
                  "Calle Ángel Martínez Villarreal 510, Monterrey, NL, México\nmanuel.garcia@bioana.com.mx\nwww.bioanamedical.com",
                fontSize: 8,
                margin: [0, 4, 0, 0],
              },
            ],
          },
        ].filter(Boolean),
        styles: { th: { bold: true } },
        defaultStyle: { fontSize: 10 },
      };

      const pdfBlob: Blob = await new Promise((resolve) => {
        const gen = pdfMake.createPdf(docDefinition);
        gen.getBlob((blob: Blob) => resolve(blob));
      });

      const filePath = `cotizaciones/${id}/${folio}.pdf`;
      const fileRef = storageRef(storage, filePath);
      await uploadBytes(fileRef, pdfBlob);
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
      };
      const versionDataClean = sanitizeForFirestore(versionDataRaw);
      await setDoc(doc(db, "pedidos", id as string, "quote_versions", folio), versionDataClean);

      alert(`PDF generado: ${folio}`);

      const snap = await getDocs(query(collection(db, "pedidos", id as string, "quote_versions"), orderBy("createdAt", "desc")));
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

      const tplRef = storageRef(storage, pdfTpl.templatePath);
      const tplBytes = await getBytes(tplRef);

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

      safeDraw("fecha", fecha.toLocaleDateString(), 10);
      safeDraw("folio", folio, 10, true);
      safeDraw("cliente", draft.cliente || "-", 12, true);
      safeDraw("atencion", draft.atencionA || "-", 10);

      safeDraw("subtotal", `MXN ${subtotalConGananciaMXN.toFixed(2)}`);
      safeDraw("iva", `MXN ${ivaMonto.toFixed(2)}`);
      safeDraw("envio", `MXN ${(Number(draft.envio) || 0).toFixed(2)}`);
      safeDraw("total", `MXN ${totalFinal.toFixed(2)}`, 12, true);

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

      const pdfBytes = await pdfDoc.save();
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

  // ======== SPEC files helpers ========
  const addSpecFiles = (list: FileList | null) => {
    if (!list) return;
    const incoming = Array.from(list);

    setSpecFiles((prev) => {
      const seen = new Set(prev.map((f) => `${f.name}_${f.size}_${f.lastModified}`));
      const filtered = incoming.filter((f) => {
        const k = `${f.name}_${f.size}_${f.lastModified}`;
        if (seen.has(k)) return false;
        seen.add(k);
        return true;
      });
      return [...prev, ...filtered];
    });

    if (specInputRef.current) specInputRef.current.value = "";
  };

  const removeSpecFile = (idx: number) => setSpecFiles((prev) => prev.filter((_, i) => i !== idx));

  const moveSpecFile = (idx: number, dir: -1 | 1) => {
    setSpecFiles((prev) => {
      const next = [...prev];
      const target = idx + dir;
      if (target < 0 || target >= next.length) return prev;
      [next[idx], next[target]] = [next[target], next[idx]];
      return next;
    });
  };

  // --------- Guardar nueva versión de especificaciones ---------
  const handleSpecSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!id) return;
    if (!specDesc.trim() && specFiles.length === 0) {
      alert("Agrega una descripción o al menos un archivo.");
      return;
    }
    try {
      setSavingSpec(true);

      const currentMax =
        specUpdates.length === 0
          ? 1
          : specUpdates.reduce((max, s) => (s.version > max ? s.version : max), 1);
      const nextVersion = currentMax + 1;

      const uploaded: { name: string; url: string }[] = [];
      for (const file of specFiles) {
        const safeName = file.name.replace(/\s+/g, "_");
        const path = `pedidos/${id}/spec_v${nextVersion}_${Date.now()}_${safeName}`;
        const ref = storageRef(storage, path);
        await uploadBytes(ref, file);
        const url = await getDownloadURL(ref);
        uploaded.push({ name: file.name, url });
      }

      await addDoc(collection(db, "pedidos", id as string, "spec_updates"), {
        version: nextVersion,
        descripcion: specDesc.trim(),
        archivos: uploaded,
        createdAt: serverTimestamp(),
      });

      // notificaciones
      const titulo = pedido?.titulo || "Sin título";
      if (isAdmin) {
        if (ownerEmail) {
          await addDoc(collection(db, "notifications"), {
            userEmail: ownerEmail,
            pedidoId: id,
            tipo: "spec_nueva_admin",
            mensaje: `Tu pedido "${titulo}" tiene una nueva especificación.`,
            createdAt: serverTimestamp(),
            leido: false,
          });
        }
      } else {
        await addDoc(collection(db, "notifications_admin"), {
          pedidoId: id,
          tipo: "spec_nueva_usuario",
          mensaje: `El pedido "${titulo}" tiene una nueva especificación.`,
          createdAt: serverTimestamp(),
          leido: false,
        });
      }

      await loadSpecUpdates();
      setSpecDesc("");
      setSpecFiles([]);
      setShowSpecForm(false);
    } catch (err) {
      console.error("Error al guardar especificaciones adicionales:", err);
      alert("No se pudo guardar las especificaciones adicionales.");
    } finally {
      setSavingSpec(false);
    }
  };

  // --------- Enviar mensaje de chat ---------
  const handleSendMessage = async (e: FormEvent) => {
    e.preventDefault();
    if (!id || !user) return;

    const text = newMessage.trim();
    if (!text) return;

    try {
      const displayName = user.displayName || (user as any).name || user.email || "Usuario";
      const chatColRef = collection(db, "pedidos", id as string, "chat");

      const msgData = {
        text,
        createdAt: serverTimestamp(),
        userId: user.uid,
        userEmail: user.email,
        userName: displayName,
        isAdmin,
        vistoPorAdmin: !!isAdmin,
        vistoPorUser: !isAdmin,
        notificacionCreada: false,
      };

      const msgRef = await addDoc(chatColRef, msgData);
      setNewMessage("");

      setTimeout(async () => {
        try {
          const snap = await getDoc(msgRef);
          if (!snap.exists()) return;
          const data = snap.data() as any;
          if (data.notificacionCreada) return;

          const sigueSinLeer = isAdmin ? !data.vistoPorUser : !data.vistoPorAdmin;
          if (!sigueSinLeer) return;

          const titulo = pedido?.titulo || "Sin título";

          if (isAdmin) {
            if (ownerEmail) {
              await addDoc(collection(db, "notifications"), {
                userEmail: ownerEmail,
                pedidoId: id,
                tipo: "chat_msg_para_usuario",
                mensaje: `Tu pedido "${titulo}" tiene un mensaje nuevo.`,
                createdAt: serverTimestamp(),
                leido: false,
              });
            }
          } else {
            await addDoc(collection(db, "notifications_admin"), {
              pedidoId: id,
              tipo: "chat_msg_para_admin",
              mensaje: `El pedido "${titulo}" tiene un mensaje nuevo.`,
              createdAt: serverTimestamp(),
              leido: false,
            });
          }

          await updateDoc(msgRef, { notificacionCreada: true });
        } catch (err) {
          console.error("Error al evaluar notificación de chat:", err);
        }
      }, 60_000);
    } catch (err) {
      console.error("Error al enviar mensaje de chat:", err);
      alert("No se pudo enviar el mensaje.");
    }
  };

  if (!pedido) {
    return <div className="mx-auto max-w-7xl px-4 sm:px-8 py-10 text-white/80">Cargando…</div>;
  }

  // ======== Render ========
  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-8 py-10 text-white">
      {/* Back */}
      <button onClick={() => router.back()} className={btnGhost}>
        <FiArrowLeft /> Regresar
      </button>

      {/* Header */}
      <div className="mt-6">
        <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-white/95">
          Detalles del pedido
        </h1>
        <div className="mt-2 text-sm text-white/60">
          <span className="text-white/75">ID:</span>{" "}
          <span className="font-semibold text-white/85 break-all">{String(id)}</span>
        </div>
      </div>

      {/* Top grid: Pedido + Chat */}
      <div className="mt-8 grid grid-cols-1 lg:grid-cols-5 gap-6 items-stretch">
        {/* Pedido */}
        <div className={`${cardClass} ${cardPad} lg:col-span-2`}>
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-white/90">Resumen</h2>
              <p className="mt-1 text-sm text-white/60">Información general del pedido.</p>
            </div>

            <span className={statusPillClass(pedido.status || "enviado")}>
              {statusLabel(pedido.status || "enviado")}
            </span>
          </div>

          <div className="mt-5 space-y-3 text-sm">
            <div>
              <div className={label}>Título</div>
              <div className={`${value} font-medium break-words`}>{pedido.titulo || "Sin título"}</div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <div className={label}>Proyecto</div>
                <div className={`${value} break-words`}>{pedido.proyecto || "—"}</div>
              </div>
              <div>
                <div className={label}>Servicio</div>
                <div className={value}>{pedido.servicio || "—"}</div>
              </div>
              <div>
                <div className={label}>Máquina</div>
                <div className={value}>{pedido.maquina || "—"}</div>
              </div>
              <div>
                <div className={label}>Material</div>
                <div className={value}>{pedido.material || "—"}</div>
              </div>
            </div>

            <div>
              <div className={label}>Descripción</div>
              <div className={`${value} whitespace-pre-wrap leading-relaxed`}>
                {pedido.descripcion || "—"}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <div className={label}>Entrega propuesta</div>
                <div className={value}>{pedido.fechaLimite || "—"}</div>
              </div>
              <div>
                <div className={label}>Entrega real</div>
                <div className={value}>{pedido.fechaEntregaReal || "Pendiente"}</div>
              </div>
            </div>
          </div>

          {/* Adjuntos */}
          <div className="mt-5 border-t border-white/10 pt-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-sm font-semibold text-white/90">Archivos adjuntos</div>
                <div className="text-xs text-white/50">Archivos del pedido (Storage).</div>
              </div>
            </div>

            <div className="mt-3">
              {filesLoading ? (
                <div className="text-sm text-white/60">Cargando…</div>
              ) : files.length === 0 ? (
                <div className="text-sm text-white/60 italic">No hay archivos adjuntos.</div>
              ) : (
                <ul className="space-y-2">
                  {files.map((f) => (
                    <li key={f.url} className="flex items-center justify-between gap-3">
                      <a
                        href={f.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-emerald-200 hover:text-emerald-100 underline decoration-white/20 text-sm break-all"
                      >
                        {f.name}
                      </a>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {isAdmin && (
              <div className="mt-5">
                <button
                  onClick={() => {
                    const proyecto = encodeURIComponent(pedido.proyecto || "");
                    const titulo = encodeURIComponent(pedido.titulo || "");
                    router.push(`/cotizador?proyecto=${proyecto}&titulo=${titulo}`);
                  }}
                  className={btnSoft}
                >
                  Cotizar servicio
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Chat */}
        <div className={`${cardClass} ${cardPad} lg:col-span-3 flex flex-col`}>
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-white/90">Canal de comunicación</h2>
              <p className="mt-1 text-sm text-white/60">
                Mensajes entre administradores y usuarios sobre este pedido.
              </p>
            </div>
          </div>

          {/* Messages box */}
          <div className="mt-4 flex-1 rounded-2xl border border-white/10 bg-black/20 overflow-hidden flex flex-col">
            <div className="flex-1 p-3 sm:p-4 overflow-y-auto space-y-2">
              {chatMessages.length === 0 ? (
                <p className="text-white/55 text-sm text-center mt-6">
                  Aún no hay mensajes en este pedido.
                </p>
              ) : (
                chatMessages.map((m) => {
                  const fecha =
                    m.createdAt?.toDate?.() instanceof Date ? m.createdAt.toDate() : null;

                  const isMine = user && m.userId && m.userId === user.uid;

                  const email = m.userEmail || m.userName || undefined;
                  const friendlyName =
                    (email && nameByEmail[email]) ||
                    m.userName ||
                    (m.isAdmin ? "Admin" : "Usuario");

                  const bubbleMine =
                    "bg-emerald-500/15 border border-emerald-400/25 text-emerald-50";
                  const bubbleOther =
                    "bg-white/5 border border-white/10 text-white/90";

                  return (
                    <div key={m.id} className={`flex ${isMine ? "justify-end" : "justify-start"}`}>
                      <div className={`max-w-[85%] rounded-2xl px-3 py-2 ${isMine ? bubbleMine : bubbleOther}`}>
                        <div className="flex items-center justify-between gap-3 mb-1">
                          <span className="text-[11px] font-semibold text-white/80">
                            {friendlyName}
                            {m.isAdmin ? " · Admin" : ""}
                          </span>
                          {fecha && (
                            <span className="text-[10px] text-white/45">
                              {fecha.toLocaleDateString()}{" "}
                              {fecha.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                            </span>
                          )}
                        </div>

                        <p className="whitespace-pre-wrap text-sm leading-relaxed">{m.text}</p>
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={chatEndRef} />
            </div>

            {/* Composer */}
            <form onSubmit={handleSendMessage} className="border-t border-white/10 p-3 sm:p-4">
              <textarea
                className={textareaClass}
                rows={2}
                placeholder="Escribe un mensaje…"
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSendMessage(e as any);
                  }
                }}
              />

              <div className="mt-3 flex items-center justify-end">
                <button
                  type="submit"
                  className={btnPrimary}
                  disabled={!newMessage.trim()}
                >
                  Enviar
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>

      {/* Especificaciones */}
      <div className={`mt-6 ${cardClass} ${cardPad}`}>
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-white/90">Especificaciones adicionales / versiones</h2>
            <p className="mt-1 text-sm text-white/60">
              Cambios sobre el pedido original (v1).
            </p>
          </div>

          <button
            type="button"
            onClick={() => setShowSpecForm((prev) => !prev)}
            className={btnSoft}
          >
            {showSpecForm ? "Cerrar" : "Agregar especificaciones"}
          </button>
        </div>

        <div className="mt-4">
          {specUpdates.length === 0 ? (
            <p className="text-sm text-white/60">
              Aún no se han registrado cambios. La versión 1 corresponde al pedido original.
            </p>
          ) : (
            <div className="space-y-3">
              {specUpdates.map((s) => {
                const fecha = s.createdAt?.toDate?.() instanceof Date ? s.createdAt.toDate() : null;
                return (
                  <div
                    key={s.id}
                    className="rounded-2xl border border-white/10 bg-white/[0.04] p-4"
                  >
                    <div className="flex items-center justify-between gap-3 mb-2">
                      <span className="font-semibold text-white/90">
                        Versión {s.version} <span className="text-white/50 font-normal">(sobre original)</span>
                      </span>
                      <span className="text-xs text-white/45">
                        {fecha ? fecha.toLocaleString() : "Fecha no disponible"}
                      </span>
                    </div>

                    {s.descripcion && (
                      <p className="text-sm text-white/85 whitespace-pre-wrap leading-relaxed">
                        {s.descripcion}
                      </p>
                    )}

                    {s.archivos && s.archivos.length > 0 && (
                      <div className="mt-3">
                        <div className="text-sm font-medium text-white/80">
                          Archivos adjuntos de esta versión:
                        </div>
                        <ul className="mt-2 space-y-2">
                          {s.archivos.map((a) => (
                            <li key={a.url}>
                              <a
                                href={a.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-emerald-200 hover:text-emerald-100 underline decoration-white/20 text-sm"
                              >
                                {a.name}
                              </a>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {showSpecForm && (
          <form onSubmit={handleSpecSubmit} className="mt-5 border-t border-white/10 pt-5 space-y-4">
            <div>
              <label className="block text-sm font-medium text-white/85 mb-2">
                Descripción del cambio / especificaciones nuevas
              </label>
              <textarea
                className={textareaClass}
                rows={3}
                value={specDesc}
                onChange={(e) => setSpecDesc(e.target.value)}
                placeholder="Ejemplo: Se actualiza el archivo de diseño por versión con más grosor en la pared lateral…"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-white/85 mb-2">Adjuntar archivos</label>

              <label className="inline-flex items-center gap-2 rounded-xl border border-white/12 bg-white/5 px-4 py-2 text-sm text-white/85 cursor-pointer hover:bg-white/10 transition">
                <span className="text-white/70">⬆</span>
                Seleccionar archivos
                <input
                  ref={specInputRef}
                  type="file"
                  multiple
                  className="hidden"
                  onChange={(e) => addSpecFiles(e.target.files)}
                />
              </label>

              {specFiles.length > 0 && (
                <div className="mt-3 rounded-2xl border border-white/10 bg-black/20 overflow-hidden">
                  <div className="px-4 py-3 text-xs text-white/60 border-b border-white/10">
                    Archivos seleccionados (puedes reordenar):
                  </div>

                  <ul className="divide-y divide-white/10">
                    {specFiles.map((f, idx) => (
                      <li
                        key={`${f.name}_${f.size}_${f.lastModified}`}
                        className="flex items-center justify-between gap-3 px-4 py-3"
                      >
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-white/90 truncate">{f.name}</p>
                          <p className="text-xs text-white/50">
                            {(f.size / 1024 / 1024).toFixed(2)} MB
                          </p>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            type="button"
                            onClick={() => moveSpecFile(idx, -1)}
                            disabled={idx === 0}
                            className={`${btnSoft} !px-2 !py-2 disabled:opacity-40`}
                            title="Subir"
                          >
                            <FiChevronUp />
                          </button>

                          <button
                            type="button"
                            onClick={() => moveSpecFile(idx, 1)}
                            disabled={idx === specFiles.length - 1}
                            className={`${btnSoft} !px-2 !py-2 disabled:opacity-40`}
                            title="Bajar"
                          >
                            <FiChevronDown />
                          </button>

                          <button
                            type="button"
                            onClick={() => removeSpecFile(idx)}
                            className={`${btnDanger} !px-2 !py-2`}
                            title="Quitar"
                          >
                            <FiX />
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            <div className="flex items-center gap-3">
              <button
                type="submit"
                disabled={savingSpec}
                className={btnPrimary}
              >
                {savingSpec ? "Guardando…" : "Guardar como nueva versión"}
              </button>

              <p className="text-xs text-white/45">
                Se registrará como la versión siguiente (v2, v3, etc.) con fecha automática.
              </p>
            </div>
          </form>
        )}
      </div>

      {/* Cotización */}
      <div id="cotizacion-viva" className={`mt-6 ${cardClass} ${cardPad}`}>
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-white/90">Cotización</h2>
            <p className="mt-1 text-sm text-white/60">Cotización viva del pedido.</p>
          </div>

          <button onClick={cargarCotizacionViva} className={btnSoft} title="Actualizar">
            Refrescar
          </button>
        </div>

        <div className="mt-4">
          {loadingQuote ? (
            <p className="text-sm text-white/60">Cargando cotización…</p>
          ) : quoteLines.length === 0 ? (
            <p className="text-sm text-white/60">No se han adjuntado servicios a esta cotización.</p>
          ) : (
            <>
              {/* Meta */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm text-white/70">
                <div>
                  <span className="font-medium text-white/80">Moneda base:</span> MXN
                </div>
                <div>
                  <span className="font-medium text-white/80">Tasa USD→MXN:</span> {quoteMeta?.exchangeRate ?? 17}
                </div>
                <div>
                  <span className="font-medium text-white/80">IVA (default):</span> 16.00%
                </div>
              </div>

              {/* Tabla */}
              <div className="mt-4 rounded-2xl border border-white/10 bg-black/20 overflow-hidden">
                <div className="w-full overflow-x-auto">
                  <table className="min-w-[900px] w-full text-sm">
                    <thead className="bg-white/[0.04] text-white/70">
                      <tr>
                        <th className="text-left px-4 py-3 font-semibold">Servicio</th>
                        <th className="text-left px-4 py-3 font-semibold">Título del pedido</th>
                        <th className="text-left px-4 py-3 font-semibold">Total</th>
                        <th className="text-left px-4 py-3 font-semibold">Detalles del servicio</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/10">
                      {quoteLines.map((ln) => {
                        const d = ln.data;
                        const base = d.subtotalMXN ?? 0;
                        const inflado = base * (1 + (Number(draft.gananciaPct) || 0) / 100);
                        const details = buildDetailsForLine(d);

                        return (
                          <tr key={ln.id} className="align-top hover:bg-emerald-500/[0.04] transition">
                            <td className="px-4 py-3">
                              <div className="font-medium text-white/90">
                                {d.serviceName || d.serviceId || "—"}
                              </div>
                            </td>
                            <td className="px-4 py-3 text-white/80">{pedido.titulo || "Sin título"}</td>
                            <td className="px-4 py-3 text-white/85 whitespace-nowrap">
                              MXN {inflado.toFixed(2)}
                            </td>
                            <td className="px-4 py-3">
                              {details.length === 0 ? (
                                <span className="text-white/50">—</span>
                              ) : (
                                <ul className="list-disc pl-5 space-y-1 text-white/80">
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
              </div>

              {/* Totales */}
              <div className="mt-5 grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                  <div className="text-sm text-white/60">
                    * El PDF mostrará los importes por servicio <span className="text-white/80 font-semibold">ya con ganancia</span>, sin revelar el %.
                  </div>

                  <div className="mt-4 flex items-center gap-3">
                    <button
                      onClick={async () => {
                        try {
                          setIsGen(true);
                          const ok = await handleGenerarPDF(); // genérico
                          if (ok) await cargarCotizacionViva();
                        } finally {
                          setIsGen(false);
                        }
                      }}
                      disabled={isGen}
                      className={btnPrimary}
                    >
                      {isGen ? "Generando…" : "Generar PDF"}
                    </button>

                    {/* Si un día quieres permitir plantilla, descomenta y usa handleGenerarPDF_Template */}
                    {/* <button
                      onClick={async () => {
                        try {
                          setIsGen(true);
                          const okTpl = await handleGenerarPDF_Template();
                          if (!okTpl) await handleGenerarPDF();
                        } finally {
                          setIsGen(false);
                        }
                      }}
                      disabled={isGen}
                      className={btnSoft}
                    >
                      {isGen ? "Generando…" : "Generar PDF (plantilla)"}
                    </button> */}
                  </div>
                </div>

                <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                  <div className="space-y-2 text-sm text-white/80">
                    <div className="flex items-center justify-between">
                      <span className="text-white/70">Subtotal sin ganancia</span>
                      <span className="font-semibold text-white/90">{formatMoney(subtotalBaseMXN)}</span>
                    </div>

                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <span className="text-white/70">Ganancia (%)</span>
                        <input
                          id="gananciaPct"
                          type="number"
                          step="10"
                          min="0"
                          value={draft.gananciaPct}
                          onChange={(e) => scheduleSave({ ...draft, gananciaPct: Number(e.target.value) })}
                          className="w-24 rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white text-right focus:outline-none focus:ring-2 focus:ring-emerald-400/30"
                        />
                      </div>
                      <span className="font-semibold text-white/90">{formatMoney(gananciaMonto)}</span>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-white/70">Subtotal con ganancia</span>
                      <span className="font-semibold text-white/90">{formatMoney(subtotalConGananciaMXN)}</span>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-white/70">IVA (16%)</span>
                      <span className="font-semibold text-white/90">{formatMoney(ivaMonto)}</span>
                    </div>

                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <span className="text-white/70">Envío (MXN)</span>
                        <input
                          id="envio"
                          type="number"
                          step="10"
                          min="0"
                          value={draft.envio ?? 0}
                          onChange={(e) => scheduleSave({ ...draft, envio: Number(e.target.value) })}
                          className="w-32 rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white text-right focus:outline-none focus:ring-2 focus:ring-emerald-400/30"
                        />
                      </div>
                      <span className="font-semibold text-white/90">{formatMoney(Number(draft.envio) || 0)}</span>
                    </div>

                    <div className="pt-2 border-t border-white/10 flex items-center justify-between">
                      <span className="text-white/80 font-semibold">TOTAL</span>
                      <span className="text-lg font-bold text-white/95">{formatMoney(totalFinal)}</span>
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Draft */}
      <div className={`mt-6 ${cardClass} ${cardPad}`}>
        <div>
          <h2 className="text-lg font-semibold text-white/90">Datos de cotización (draft)</h2>
          <p className="mt-1 text-sm text-white/60">
            Se guarda automáticamente y alimentará el PDF final.
          </p>
        </div>

        <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-white/80 mb-2">Cliente</label>
            <input
              className={inputClass}
              value={draft.cliente ?? ""}
              onChange={(e) => scheduleSave({ ...draft, cliente: e.target.value })}
              placeholder="Nombre / empresa"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-white/80 mb-2">Atención a</label>
            <input
              className={inputClass}
              value={draft.atencionA ?? ""}
              onChange={(e) => scheduleSave({ ...draft, atencionA: e.target.value })}
              placeholder="Contacto"
            />
          </div>

          <div className="sm:col-span-2">
            <label className="block text-sm font-medium text-white/80 mb-2">Notas</label>
            <textarea
              className={textareaClass}
              rows={3}
              value={draft.notas ?? ""}
              onChange={(e) => scheduleSave({ ...draft, notas: e.target.value })}
              placeholder="Notas internas que aparecerán en el PDF (opcional)"
            />
          </div>
        </div>
      </div>

      {/* Versiones */}
      <div className={`mt-6 ${cardClass} ${cardPad}`}>
        <div>
          <h2 className="text-lg font-semibold text-white/90">Versiones generadas</h2>
          <p className="mt-1 text-sm text-white/60">Historial de PDFs generados.</p>
        </div>

        <div className="mt-4">
          {versions.length === 0 ? (
            <p className="text-sm text-white/60">Aún no hay versiones.</p>
          ) : (
            <ul className="space-y-3">
              {versions.map((v) => {
                const fecha = v.createdAt?.toDate?.() instanceof Date ? v.createdAt.toDate() : null;
                return (
                  <li
                    key={v.id}
                    className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 rounded-2xl border border-white/10 bg-white/[0.04] p-4"
                  >
                    <div>
                      <div className="font-semibold text-white/90">{v.id}</div>
                      <div className="text-xs text-white/55 mt-1">
                        {fecha ? fecha.toLocaleString() : "—"} · Total:{" "}
                        <span className="text-white/80 font-semibold">{formatMoney(v.total || 0)}</span>
                      </div>
                    </div>

                    <a
                      className="inline-flex items-center justify-center rounded-xl border border-white/12 bg-white/5 px-4 py-2 text-sm text-white/85 hover:bg-white/10 transition"
                      href={v.url}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Ver PDF
                    </a>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
