"use client";

import { useEffect, useMemo, useRef, useState, FormEvent } from "react";
import type { Dispatch, ReactNode, RefObject, SetStateAction } from "react";
import { useRouter } from "next/navigation";
import {
  addDoc,
  collection,
  doc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";
import {
  ref as storageRef,
  uploadBytes,
  getDownloadURL,
} from "firebase/storage";
import {
  FiArrowLeft,
  FiUpload,
  FiCheck,
  FiX,
  FiPlus,
  FiFileText,
  FiLink,
  FiTrash2,
  FiChevronDown,
  FiChevronRight,
} from "react-icons/fi";
import { db, storage } from "@/src/firebase/firebaseConfig";

type Props = {
  pedido: any;
  pedidoId: string;
  isAdmin: boolean;
  user: any;
};

type UploadedFile = {
  name: string;
  url: string;
};

type FixtureVersion = {
  id: string;
  versionLabel: string;
  descripcion?: string;
  especificacionesExtra?: string[];
  archivos?: UploadedFile[];
  status?: "pendiente" | "aprobado" | "rechazado";
  createdAt?: any;
  creadoPor?: string;
  firmas?: Record<string, any>;
};

type ApprovalRole = "pm" | "disenador" | "encargado";
type Decision = "aprobado" | "rechazado";

type UserPermissionData = {
  email?: string;
  nombre?: string;
  apellido?: string;
  displayName?: string;
  pmProjects?: string[];
  isDesigner?: boolean;
  processOwnerOf?: string[];
};

type LinkedPedido = {
  id: string;
  titulo?: string;
  servicio?: string;
  subtotal?: number;
  status?: string;
};

type TabKey =
  | "resumen"
  | "concepto"
  | "prueba"
  | "confirmacion"
  | "specDraft"
  | "beta"
  | "specFinal";

export default function DetalleFixture({
  pedido,
  pedidoId,
  isAdmin,
  user,
}: Props) {
  const router = useRouter();

  const [activeTab, setActiveTab] = useState<TabKey>("resumen");

  const [conceptos, setConceptos] = useState<FixtureVersion[]>([]);
  const [pruebas, setPruebas] = useState<FixtureVersion[]>([]);
  const [betas, setBetas] = useState<FixtureVersion[]>([]);
  const [linkedPedidos, setLinkedPedidos] = useState<LinkedPedido[]>([]);

  const [loading, setLoading] = useState(false);

  const [generatingPdf, setGeneratingPdf] = useState(false);

  const [faseActual, setFaseActual] = useState(
    pedido?.faseFixture || "proof_of_concept_solicitud"
  );
  const [specDraftGenerada, setSpecDraftGenerada] = useState(
    !!pedido?.specDraft?.generado
  );
  const [specFinalGenerada, setSpecFinalGenerada] = useState(
    !!pedido?.specFinal?.generado
  );

  const [conceptoDesc, setConceptoDesc] = useState("");
  const [conceptoSpecs, setConceptoSpecs] = useState<string[]>([""]);
  const [conceptoFiles, setConceptoFiles] = useState<File[]>([]);
  const [expandedConceptIds, setExpandedConceptIds] = useState<string[]>([]);

  const [pruebaDesc, setPruebaDesc] = useState("");
  const [pruebaFiles, setPruebaFiles] = useState<File[]>([]);

  const [betaDesc, setBetaDesc] = useState("");
  const [betaFiles, setBetaFiles] = useState<File[]>([]);

  const [userData, setUserData] = useState<UserPermissionData | null>(null);

  const conceptoInputRef = useRef<HTMLInputElement | null>(null);
  const pruebaInputRef = useRef<HTMLInputElement | null>(null);
  const betaInputRef = useRef<HTMLInputElement | null>(null);

  const solicitud = pedido?.fixtureSolicitud || {};
  const necesidad = solicitud?.necesidad || {};
  const alcance = solicitud?.alcance || {};
  const inputs = solicitud?.inputs || {};
  const firmaPM = solicitud?.firmaPM || {};

  const normalizePermissionValue = (value: string) =>
    String(value || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .trim()
      .toLowerCase()
      .replace(/&/g, "y")
      .replace(/\s+/g, "_")
      .replace(/[^a-z0-9_]/g, "");

  const userDisplayName =
    userData?.displayName ||
    [userData?.nombre, userData?.apellido].filter(Boolean).join(" ") ||
    user?.displayName ||
    user?.email ||
    "Usuario";

  const pedidoProyecto = String(pedido?.proyecto || "").trim();

  const fixtureProcesses = (() => {
    const raw =
      pedido?.proceso ||
      pedido?.procesoFixture ||
      solicitud?.proceso ||
      solicitud?.alcance?.proceso ||
      solicitud?.alcance?.procesos ||
      [];

    const list = Array.isArray(raw) ? raw : [raw];

    return list
      .map((p: any) => normalizePermissionValue(String(p || "")))
      .filter(Boolean);
  })();

  const canApprovePM = !!userData?.pmProjects?.some(
    (project) => String(project || "").trim() === pedidoProyecto
  );

  const canApproveDesigner = userData?.isDesigner === true;

  const canApproveProcessOwner = !!userData?.processOwnerOf?.some((process) =>
    fixtureProcesses.includes(normalizePermissionValue(process))
  );

  const canApproveRole = (role: ApprovalRole) => {
    if (role === "pm") return canApprovePM;
    if (role === "disenador") return canApproveDesigner;
    return canApproveProcessOwner;
  };

  const cardClass =
    "rounded-3xl border border-white/10 bg-white/[0.04] p-5 md:p-6 shadow-[0_25px_80px_rgba(0,0,0,0.35)] backdrop-blur";

  const inputClass =
    "w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white placeholder:text-white/35 outline-none focus:ring-2 focus:ring-emerald-400/30";

  const btnSoft =
    "inline-flex items-center justify-center gap-2 rounded-xl border border-white/12 bg-white/5 px-4 py-2 text-sm text-white/85 hover:bg-white/10 transition";

  const btnPrimary =
    "inline-flex items-center justify-center gap-2 rounded-xl border border-emerald-400/30 bg-emerald-500/15 px-4 py-2 text-sm text-emerald-100 hover:bg-emerald-500/20 transition disabled:cursor-not-allowed disabled:opacity-50";

  const btnDanger =
    "inline-flex items-center justify-center gap-2 rounded-xl border border-red-400/25 bg-red-500/10 px-4 py-2 text-sm text-red-200 hover:bg-red-500/15 transition disabled:cursor-not-allowed disabled:opacity-50";

  const hasConceptApproved = conceptos.some((c) => c.status === "aprobado");
  const hasPruebaCreated = pruebas.length > 0;
  const hasConfirmacionApproved = pruebas.some((p) => p.status === "aprobado");
  const hasBetaApproved = betas.some((b) => b.status === "aprobado");

  const tabs: Array<{
    key: TabKey;
    label: string;
    done: boolean;
  }> = [
    { key: "resumen", label: "Solicitud formal", done: true },
    { key: "concepto", label: "Concepto de diseño", done: hasConceptApproved },
    { key: "prueba", label: "Prueba de diseño", done: hasPruebaCreated },
    {
      key: "confirmacion",
      label: "Confirmación conceptual",
      done: hasConfirmacionApproved,
    },
    { key: "specDraft", label: "Spec Draft", done: specDraftGenerada },
    { key: "beta", label: "Beta", done: hasBetaApproved },
    { key: "specFinal", label: "Spec Final", done: specFinalGenerada },
  ];

  const nextConceptLabel = useMemo(() => {
    const letters = ["VA", "VB", "VC", "VD", "VE", "VF", "VG"];
    return letters[conceptos.length] || `V${conceptos.length + 1}`;
  }, [conceptos.length]);

  const nextPruebaLabel = useMemo(() => {
    const base =
      conceptos.find((c) => c.status === "aprobado")?.versionLabel || "VA";
    return `${base}.${pruebas.length + 1}`;
  }, [conceptos, pruebas.length]);

  const nextBetaLabel = useMemo(() => {
    return `Beta V${betas.length + 1}`;
  }, [betas.length]);

  const loadSubcollections = async () => {
    try {
      const conceptoSnap = await getDocs(
        query(
          collection(db, "pedidos", pedidoId, "fixture_conceptos"),
          orderBy("createdAt", "asc")
        )
      );

      const pruebaSnap = await getDocs(
        query(
          collection(db, "pedidos", pedidoId, "fixture_pruebas"),
          orderBy("createdAt", "asc")
        )
      );

      const betaSnap = await getDocs(
        query(
          collection(db, "pedidos", pedidoId, "fixture_betas"),
          orderBy("createdAt", "asc")
        )
      );

      setConceptos(
        conceptoSnap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as any),
        }))
      );

      setPruebas(
        pruebaSnap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as any),
        }))
      );

      setBetas(
        betaSnap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as any),
        }))
      );
    } catch (error) {
      console.error("Error cargando subcolecciones FXT:", error);
    }
  };

  const loadUserPermissions = async () => {
    if (!user?.email) {
      setUserData(null);
      return;
    }

    try {
      const snap = await getDocs(collection(db, "users"));
      let found: UserPermissionData | null = null;

      snap.forEach((docSnap) => {
        const data = docSnap.data() as any;
        if (String(data?.email || "").toLowerCase() === String(user.email).toLowerCase()) {
          found = {
            email: data.email,
            nombre: data.nombre,
            apellido: data.apellido,
            displayName: data.displayName,
            pmProjects: Array.isArray(data.pmProjects) ? data.pmProjects : [],
            isDesigner: data.isDesigner === true,
            processOwnerOf: Array.isArray(data.processOwnerOf)
              ? data.processOwnerOf
              : [],
          };
        }
      });

      setUserData(found);
    } catch (error) {
      console.error("Error cargando permisos del usuario:", error);
      setUserData(null);
    }
  };

const getFreshUserPermissions = async (): Promise<UserPermissionData | null> => {
  if (!user?.email) return null;

  const snap = await getDocs(collection(db, "users"));
  let found: UserPermissionData | null = null;

  snap.forEach((docSnap) => {
    const data = docSnap.data() as any;

    if (
      String(data?.email || "").toLowerCase() ===
      String(user.email).toLowerCase()
    ) {
      found = {
        email: data.email,
        nombre: data.nombre,
        apellido: data.apellido,
        displayName: data.displayName,
        pmProjects: Array.isArray(data.pmProjects) ? data.pmProjects : [],
        isDesigner: data.isDesigner === true,
        processOwnerOf: Array.isArray(data.processOwnerOf)
          ? data.processOwnerOf
          : [],
      };
    }
  });

  setUserData(found);
  return found;
};


  const loadLinkedPedidos = async () => {
    try {
      const snap = await getDocs(collection(db, "pedidos"));
      const rows: LinkedPedido[] = [];

      snap.forEach((d) => {
        const data = d.data() as any;

        if (data.fixtureRelacionadoId === pedidoId) {
          rows.push({
            id: d.id,
            titulo: data.titulo,
            servicio: data.servicio,
            subtotal: data.subtotalMXN || data.totalMXN || 0,
            status: data.status,
          });
        }
      });

      setLinkedPedidos(rows);
    } catch (error) {
      console.error("Error cargando pedidos asociados al fixture:", error);
    }
  };

  useEffect(() => {
    loadSubcollections();
    loadLinkedPedidos();
  }, [pedidoId]);

  useEffect(() => {
    loadUserPermissions();
  }, [user?.email]);

  const uploadFiles = async (
    files: File[],
    folder: string
  ): Promise<UploadedFile[]> => {
    const uploaded: UploadedFile[] = [];

    for (const file of files) {
      const safeName = file.name.replaceAll("/", "-");
      const path = `pedidos/${pedidoId}/fixturing/${folder}/${Date.now()}-${safeName}`;
      const ref = storageRef(storage, path);

      await uploadBytes(ref, file);
      const url = await getDownloadURL(ref);

      uploaded.push({
        name: file.name,
        url,
      });
    }

    return uploaded;
  };

  const addFiles = (
    list: FileList | null,
    setter: Dispatch<SetStateAction<File[]>>,
    inputRef: RefObject<HTMLInputElement | null>
  ) => {
    if (!list) return;

    const incoming = Array.from(list);

    setter((prev) => {
      const existing = new Set(
        prev.map((f) => `${f.name}-${f.size}-${f.lastModified}`)
      );

      const filtered = incoming.filter((f) => {
        const key = `${f.name}-${f.size}-${f.lastModified}`;
        if (existing.has(key)) return false;
        existing.add(key);
        return true;
      });

      return [...prev, ...filtered];
    });

    if (inputRef.current) inputRef.current.value = "";
  };

  const removeFile = (
    index: number,
    setter: Dispatch<SetStateAction<File[]>>
  ) => {
    setter((prev) => prev.filter((_, i) => i !== index));
  };

  const updateSpec = (index: number, value: string) => {
    setConceptoSpecs((prev) =>
      prev.map((item, i) => (i === index ? value : item))
    );
  };

  const addSpec = () => {
    setConceptoSpecs((prev) => [...prev, ""]);
  };

  const removeSpec = (index: number) => {
    setConceptoSpecs((prev) => prev.filter((_, i) => i !== index));
  };

  const registrarHistorial = async (tipo: string, descripcion: string) => {
    await addDoc(collection(db, "pedidos", pedidoId, "historialFixture"), {
      tipo,
      descripcion,
      creadoPor: user?.email || "",
      createdAt: serverTimestamp(),
    });
  };

  const guardarConcepto = async (e: FormEvent) => {
    e.preventDefault();

    if (!isAdmin) return alert("Solo administradores pueden registrar conceptos.");
    if (!conceptoDesc.trim()) return alert("Agrega la descripción del concepto.");

    try {
      setLoading(true);

      const archivos = await uploadFiles(
        conceptoFiles,
        `conceptos/${nextConceptLabel}`
      );

      await addDoc(collection(db, "pedidos", pedidoId, "fixture_conceptos"), {
        versionLabel: nextConceptLabel,
        descripcion: conceptoDesc.trim(),
        especificacionesExtra: conceptoSpecs
          .map((s) => s.trim())
          .filter(Boolean),
        archivos,
        status: "pendiente",
        creadoPor: user?.email || "",
        createdAt: serverTimestamp(),
      });

      await updateDoc(doc(db, "pedidos", pedidoId), {
        faseFixture: "concepto_diseno",
      });

      setFaseActual("concepto_diseno");

      await registrarHistorial(
        "concepto_creado",
        `Se registró el concepto de diseño ${nextConceptLabel}.`
      );

      setConceptoDesc("");
      setConceptoSpecs([""]);
      setConceptoFiles([]);
      setExpandedConceptIds((prev) => prev.filter((id) => id !== "new"));
      await loadSubcollections();
    } catch (error) {
      console.error(error);
      alert("No se pudo guardar el concepto.");
    } finally {
      setLoading(false);
    }
  };

  const getExistingFirma = (item: FixtureVersion, role: ApprovalRole) => {
    const firma = item.firmas?.[role];
    if (!firma) return null;

    return {
      ...firma,
      correo: firma.correo || firma.approvedByEmail || "",
      nombre: firma.nombre || firma.approvedByName || "",
      fecha: firma.fecha || firma.approvedAt || "",
      rejectReason: firma.rejectReason || "",
    };
  };

  const canEditExistingDecision = (item: FixtureVersion, role: ApprovalRole) => {
    return canApproveRole(role);
  };

  const validateRoleDecision = (
    item: FixtureVersion,
    role: ApprovalRole,
    decision: Decision,
    rejectReason?: string
  ) => {
    if (!canApproveRole(role)) {
      alert("Tu cuenta no tiene permisos para tomar esta decisión.");
      return false;
    }

    if (!canEditExistingDecision(item, role)) {
      alert("Solo la cuenta que tomó esta decisión puede editarla.");
      return false;
    }

    if (decision === "rechazado" && !String(rejectReason || "").trim()) {
      alert("Agrega una breve explicación del rechazo.");
      return false;
    }

    return true;
  };

  const buildFirmaPayload = (decision: Decision, rejectReason?: string) => ({
    decision,
    correo: user?.email || "",
    nombre: userDisplayName,
    fecha: new Date().toISOString(),
    approvedByEmail: user?.email || "",
    approvedByName: userDisplayName,
    approvedAt: new Date().toISOString(),
    rejectReason: decision === "rechazado" ? String(rejectReason || "").trim() : "",
  });

  const decidirConcepto = async (
  concepto: FixtureVersion,
  decision: Decision,
  rejectReason?: string
) => {
  const freshUserData = await getFreshUserPermissions();

  const freshCanApprovePM = !!freshUserData?.pmProjects?.some(
    (project) => String(project || "").trim() === pedidoProyecto
  );

  if (!freshCanApprovePM) {
    alert("Solo una cuenta PM asignada al proyecto puede aprobar o rechazar el concepto de diseño.");
    return;
  }

  if (decision === "rechazado" && !String(rejectReason || "").trim()) {
    alert("Agrega una breve explicación del rechazo.");
    return;
  }

    try {
      setLoading(true);

      const prevFirmas = concepto.firmas || {};
      const nuevasFirmas = {
        ...prevFirmas,
        pm: buildFirmaPayload(decision, rejectReason),
      };

      await updateDoc(
        doc(db, "pedidos", pedidoId, "fixture_conceptos", concepto.id),
        {
          status: decision,
          firmas: nuevasFirmas,
        }
      );

      const nextFase =
        decision === "aprobado" ? "prueba_diseno" : "concepto_diseno";

      await updateDoc(doc(db, "pedidos", pedidoId), {
        faseFixture: nextFase,
      });

      setFaseActual(nextFase);

      await registrarHistorial(
        `concepto_${decision}`,
        `El concepto ${concepto.versionLabel} fue ${decision} por ${userDisplayName}${
          decision === "rechazado" ? `. Motivo: ${String(rejectReason || "").trim()}` : "."
        }`
      );

      await loadSubcollections();
    } catch (error) {
      console.error(error);
      alert("No se pudo actualizar el concepto.");
    } finally {
      setLoading(false);
    }
  };

  const guardarPrueba = async (e: FormEvent) => {
    e.preventDefault();

    if (!isAdmin) return alert("Solo administradores pueden registrar pruebas.");
    if (!pruebaDesc.trim()) return alert("Agrega la descripción de la prueba.");

    try {
      setLoading(true);

      const archivos = await uploadFiles(pruebaFiles, `pruebas/${nextPruebaLabel}`);

      await addDoc(collection(db, "pedidos", pedidoId, "fixture_pruebas"), {
        versionLabel: nextPruebaLabel,
        descripcion: pruebaDesc.trim(),
        archivos,
        status: "pendiente",
        creadoPor: user?.email || "",
        createdAt: serverTimestamp(),
      });

      await updateDoc(doc(db, "pedidos", pedidoId), {
        faseFixture: "confirmacion_conceptual",
      });

      setFaseActual("confirmacion_conceptual");

      await registrarHistorial(
        "prueba_creada",
        `Se registró la prueba de diseño ${nextPruebaLabel}.`
      );

      setPruebaDesc("");
      setPruebaFiles([]);

      await loadSubcollections();
    } catch (error) {
      console.error(error);
      alert("No se pudo guardar la prueba.");
    } finally {
      setLoading(false);
    }
  };

  const decidirPrueba = async (
    prueba: FixtureVersion,
    rol: ApprovalRole,
    decision: Decision,
    rejectReason?: string
  ) => {
    if (!validateRoleDecision(prueba, rol, decision, rejectReason)) return;

    try {
      setLoading(true);

      const prevFirmas = prueba.firmas || {};

      const nuevasFirmas = {
        ...prevFirmas,
        [rol]: buildFirmaPayload(decision, rejectReason),
      };

      const allRoles: ApprovalRole[] = ["pm", "disenador", "encargado"];

      const completa = allRoles.every(
        (r) => nuevasFirmas[r]?.decision === "aprobado"
      );

      const rechazada = allRoles.some(
        (r) => nuevasFirmas[r]?.decision === "rechazado"
      );

      await updateDoc(doc(db, "pedidos", pedidoId, "fixture_pruebas", prueba.id), {
        firmas: nuevasFirmas,
        status: completa ? "aprobado" : rechazada ? "rechazado" : "pendiente",
      });

      if (completa && !rechazada) {
        await updateDoc(doc(db, "pedidos", pedidoId), {
          faseFixture: "spec_draft",
        });

        setFaseActual("spec_draft");

        await registrarHistorial(
          "confirmacion_conceptual_aprobada",
          `La prueba ${prueba.versionLabel} fue aprobada por PM, diseñador y encargado.`
        );
      }

      if (rechazada) {
        await updateDoc(doc(db, "pedidos", pedidoId), {
          faseFixture: "prueba_diseno",
        });

        setFaseActual("prueba_diseno");

        await registrarHistorial(
          "confirmacion_conceptual_rechazada",
          `La prueba ${prueba.versionLabel} fue rechazada por ${userDisplayName}. Motivo: ${String(
            rejectReason || ""
          ).trim()}`
        );
      }

      await loadSubcollections();
    } catch (error) {
      console.error(error);
      alert("No se pudo registrar la firma.");
    } finally {
      setLoading(false);
    }
  };

  const guardarBeta = async (e: FormEvent) => {
    e.preventDefault();

    if (!isAdmin) return alert("Solo administradores pueden registrar beta.");
    if (!betaDesc.trim()) return alert("Agrega la propuesta beta.");

    try {
      setLoading(true);

      const archivos = await uploadFiles(betaFiles, `beta/${nextBetaLabel}`);

      await addDoc(collection(db, "pedidos", pedidoId, "fixture_betas"), {
        versionLabel: nextBetaLabel,
        descripcion: betaDesc.trim(),
        archivos,
        status: "pendiente",
        creadoPor: user?.email || "",
        createdAt: serverTimestamp(),
      });

      await updateDoc(doc(db, "pedidos", pedidoId), {
        faseFixture: "fase_beta",
      });

      setFaseActual("fase_beta");

      await registrarHistorial(
        "beta_creada",
        `Se registró la propuesta ${nextBetaLabel}.`
      );

      setBetaDesc("");
      setBetaFiles([]);

      await loadSubcollections();
    } catch (error) {
      console.error(error);
      alert("No se pudo guardar beta.");
    } finally {
      setLoading(false);
    }
  };

  const decidirBeta = async (
    beta: FixtureVersion,
    rol: "pm" | "encargado",
    decision: Decision,
    rejectReason?: string
  ) => {
    if (!validateRoleDecision(beta, rol, decision, rejectReason)) return;

    try {
      setLoading(true);

      const prevFirmas = beta.firmas || {};

      const nuevasFirmas = {
        ...prevFirmas,
        [rol]: buildFirmaPayload(decision, rejectReason),
      };

      const completa =
        nuevasFirmas.pm?.decision === "aprobado" &&
        nuevasFirmas.encargado?.decision === "aprobado";

      const rechazada =
        nuevasFirmas.pm?.decision === "rechazado" ||
        nuevasFirmas.encargado?.decision === "rechazado";

      await updateDoc(doc(db, "pedidos", pedidoId, "fixture_betas", beta.id), {
        firmas: nuevasFirmas,
        status: completa ? "aprobado" : rechazada ? "rechazado" : "pendiente",
      });

      if (completa && !rechazada) {
        await updateDoc(doc(db, "pedidos", pedidoId), {
          faseFixture: "spec_final",
        });

        setFaseActual("spec_final");

        await registrarHistorial(
          "beta_aprobada",
          `La propuesta ${beta.versionLabel} fue aprobada por PM y encargado.`
        );
      }

      if (rechazada) {
        await updateDoc(doc(db, "pedidos", pedidoId), {
          faseFixture: "fase_beta",
        });

        setFaseActual("fase_beta");

        await registrarHistorial(
          "beta_rechazada",
          `La propuesta ${beta.versionLabel} fue rechazada por ${userDisplayName}. Motivo: ${String(
            rejectReason || ""
          ).trim()}`
        );
      }

      await loadSubcollections();
    } catch (error) {
      console.error(error);
      alert("No se pudo registrar la decisión beta.");
    } finally {
      setLoading(false);
    }
  };

  const generarSpecDraft = async () => {
    if (!isAdmin) return;

    const pruebaAprobada = pruebas.some((p) => p.status === "aprobado");
    if (!pruebaAprobada) {
      alert("No se puede registrar la Spec Draft hasta que PM, diseñador y encargado aprueben una prueba.");
      return;
    }

    try {
      setLoading(true);

      await updateDoc(doc(db, "pedidos", pedidoId), {
        faseFixture: "spec_draft",
        specDraft: {
          generado: true,
          generadoPor: user?.email || "",
          fecha: new Date().toISOString(),
        },
      });

      setFaseActual("spec_draft");
      setSpecDraftGenerada(true);

      await registrarHistorial(
        "spec_draft_generada",
        "Se generó la Spec Draft como guía para la versión beta."
      );

      alert("Spec Draft registrada. Después conectamos aquí la generación DOCX.");
    } catch (error) {
      console.error(error);
      alert("No se pudo registrar la Spec Draft.");
    } finally {
      setLoading(false);
    }
  };

  const generarSpecFinal = async () => {
    if (!isAdmin) return;

    const betaAprobada = betas.some((b) => b.status === "aprobado");
    if (!betaAprobada) {
      alert("No se puede registrar la Spec Final hasta que PM y encargado aprueben una Beta.");
      return;
    }

    try {
      setLoading(true);

      await updateDoc(doc(db, "pedidos", pedidoId), {
        faseFixture: "spec_final",
        specFinal: {
          generado: true,
          generadoPor: user?.email || "",
          fecha: new Date().toISOString(),
        },
      });

      setFaseActual("spec_final");
      setSpecFinalGenerada(true);

      await registrarHistorial(
        "spec_final_generada",
        "Se registró la Spec Final para formato QMS."
      );

      alert("Spec Final registrada. Después conectamos aquí la generación DOCX QMS.");
    } catch (error) {
      console.error(error);
      alert("No se pudo registrar la Spec Final.");
    } finally {
      setLoading(false);
    }
  };

const descargarSolicitudFormalPDF = async () => {
  try {
    setGeneratingPdf(true);

    const response = await fetch(
      `/api/fixtures/${pedidoId}/solicitud-formal-docx`,
      {
        method: "POST",
      }
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => null);
      throw new Error(
        errorData?.detail ||
          errorData?.error ||
          "No se pudo generar el DOCX."
      );
    }

    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);

    const safeTitle = String(
      pedido?.titulo || pedido?.io || "solicitud-formal"
    )
      .replace(/[^\w\dáéíóúÁÉÍÓÚñÑ.-]+/g, "_")
      .replace(/_+/g, "_");

    const a = document.createElement("a");
    a.href = url;
    a.download = `${safeTitle}.docx`;
    document.body.appendChild(a);
    a.click();
    a.remove();

    window.URL.revokeObjectURL(url);
  } catch (error) {
    console.error("Error descargando DOCX:", error);
    alert(
      error instanceof Error
        ? error.message
        : "No se pudo descargar la solicitud formal."
    );
  } finally {
    setGeneratingPdf(false);
  }
};

  const renderTabContent = () => {
    if (activeTab === "resumen") {
      return (
        <section className={cardClass}>
          <div className="flex items-start justify-between gap-4">
            <div>
  <h2 className="text-xl font-semibold">
    Resumen de solicitud formal
  </h2>
  <p className="mt-1 text-sm text-white/55">
    Esta información se considera congelada como base del proceso.
  </p>

  <button
    type="button"
    onClick={descargarSolicitudFormalPDF}
    disabled={generatingPdf}
    className={`${btnPrimary} mt-4`}
  >
    <FiFileText />
    {generatingPdf ? "Generando DOCX..." : "Descargar DOCX"}
  </button>
</div>

            <span className="rounded-full border border-emerald-300/30 bg-emerald-400/10 px-3 py-1 text-xs font-semibold text-emerald-100">
              {pedido?.status || "En proceso"}
            </span>
          </div>

          <div className="mt-5 grid gap-4 text-sm md:grid-cols-2">
            <Info label="Título" value={pedido?.titulo} />
            <Info label="ID / Referencia" value={pedido?.io} />
            <Info label="Proyecto" value={pedido?.proyecto} />
            <Info label="Solicitante" value={pedido?.correoUsuario} />
            <Info label="Fase actual" value={faseActual} />
          </div>

          <div className="mt-6 grid gap-5">
            <Block title="1. Necesidad">
              <InfoText label="Problemática" value={necesidad?.problematica} />
              <InfoText
                label="Piezas / producto"
                value={necesidad?.piezasProducto}
              />
            </Block>

            <Block title="2. Alcance">
              <InfoText
                label="Para qué sí se usará"
                value={alcance?.descripcion}
              />
              <InfoText
                label="Proceso donde se usará"
                value={(alcance?.procesos || []).join(", ")}
              />
            </Block>

            <Block title="3. Inputs">
              <div className="grid gap-3 md:grid-cols-2">
                <BooleanInfo label="Cuarto limpio" value={inputs?.cuartoLimpio} />
                <BooleanInfo label="Horno" value={inputs?.horno} />
                <BooleanInfo
                  label="Rigidez / dureza"
                  value={inputs?.rigidezDureza}
                />
                <BooleanInfo
                  label="Esterilizable"
                  value={inputs?.esterilizable}
                />
                <BooleanInfo
                  label="Dimensiones críticas"
                  value={inputs?.dimensionesCriticas}
                />
                <BooleanInfo
                  label="Reportar presupuestos al PM"
                  value={inputs?.presupuestoPM}
                />
              </div>

              {inputs?.equipos?.length > 0 && (
                <div className="mt-4">
                  <p className="text-sm font-semibold text-white/80">
                    Equipos involucrados
                  </p>
                  <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-white/70">
                    {inputs.equipos.map((eq: string, index: number) => (
                      <li key={index}>{eq}</li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="mt-4 grid gap-3 md:grid-cols-2">
                <InfoText
                  label="Temperatura máxima"
                  value={inputs?.temperaturaMax}
                />
                <InfoText
                  label="Detalle rigidez / dureza"
                  value={inputs?.rigidezDetalle}
                />
                <InfoText label="Referencia DWG" value={inputs?.referenciaDWG} />
                <InfoText label="Tiempo para trabajar" value={inputs?.tiempoTrabajo} />
              </div>

              <InfoText label="Información extra" value={inputs?.extra} />
            </Block>

            <Block title="4. Criterios de éxito">
              <InfoText label="Criterios" value={solicitud?.criteriosExito} />
            </Block>

            <Block title="Firma solicitud formal">
              <Info label="Firmado por" value={userDisplayName} />
              <Info label="Fecha" value={firmaPM?.fecha} />
            </Block>
          </div>
        </section>
      );
    }

    if (activeTab === "concepto") {
      const toggleConcept = (id: string) => {
        setExpandedConceptIds((prev) =>
          prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
        );
      };

      const isNewConceptOpen = expandedConceptIds.includes("new");

      return (
        <section className={cardClass}>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="text-xl font-semibold">Concepto de diseño</h2>
              <p className="mt-1 text-sm text-white/55">
                Las versiones se registran como VA, VB, VC… y se recorren hacia la derecha.
                Cada versión puede desplegarse o comprimirse.
              </p>
            </div>

            {isAdmin && (
              <button
                type="button"
                onClick={() => {
                  if (!expandedConceptIds.includes("new")) {
                    setExpandedConceptIds((prev) => [...prev, "new"]);
                  }
                }}
                className={btnPrimary}
              >
                <FiPlus /> Agregar {nextConceptLabel}
              </button>
            )}
          </div>

  <div className="mt-6">
  <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
              {conceptos.map((item, index) => {
                const isOpen = expandedConceptIds.includes(item.id);
                const fecha =
                  item.createdAt?.toDate?.() instanceof Date
                    ? item.createdAt.toDate().toLocaleString()
                    : "Fecha no disponible";

                return (
                  <div
                    key={item.id}
                    className={`w-full rounded-2xl border p-4 transition ${
                      item.status === "aprobado"
                        ? "border-emerald-300/30 bg-emerald-400/10"
                        : item.status === "rechazado"
                        ? "border-red-300/30 bg-red-400/10"
                        : "border-white/10 bg-black/20"
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => toggleConcept(item.id)}
                      className="flex w-full items-center justify-between gap-3 text-left"
                    >
                      <div className="min-w-0">
                        <p className="text-xs uppercase tracking-[0.22em] text-white/40">
                          Versión {index + 1}
                        </p>
                        <p className="mt-1 text-lg font-semibold text-white/90">
                          {item.versionLabel}
                        </p>
                        <p className="mt-1 text-xs text-white/45">{fecha}</p>
                      </div>

                      <div className="flex items-center gap-2">
                        <span
                          className={`rounded-full border px-3 py-1 text-[11px] font-semibold ${
                            item.status === "aprobado"
                              ? "border-emerald-300/30 bg-emerald-400/10 text-emerald-100"
                              : item.status === "rechazado"
                              ? "border-red-300/30 bg-red-400/10 text-red-100"
                              : "border-yellow-300/30 bg-yellow-400/10 text-yellow-100"
                          }`}
                        >
                          {item.status || "pendiente"}
                        </span>
                        {isOpen ? <FiChevronDown /> : <FiChevronRight />}
                      </div>
                    </button>

                    {isOpen && (
                      <div className="mt-4 border-t border-white/10 pt-4">
                        {item.descripcion && (
                          <p className="whitespace-pre-wrap text-sm leading-relaxed text-white/75">
                            {item.descripcion}
                          </p>
                        )}

                        {item.especificacionesExtra &&
                          item.especificacionesExtra.length > 0 && (
                            <div className="mt-4">
                              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/40">
                                Especificaciones extra
                              </p>
                              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-white/70">
                                {item.especificacionesExtra.map((s, i) => (
                                  <li key={i}>{s}</li>
                                ))}
                              </ul>
                            </div>
                          )}

                        {item.archivos && item.archivos.length > 0 && (
                          <div className="mt-4 space-y-1">
                            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/40">
                              Archivos
                            </p>
                            {item.archivos.map((file) => (
                              <a
                                key={file.url}
                                href={file.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="block truncate text-sm text-emerald-200 underline decoration-white/20 hover:text-emerald-100"
                              >
                                {file.name}
                              </a>
                            ))}
                          </div>
                        )}

                        <div className="mt-4">
                          <ApprovalRow
                            label="Firma PM"
                            approvalKey="pm"
                            firma={item.firmas?.pm}
                            currentUserEmail={user?.email}
                            canApprove={canApprovePM}
                            onDecision={(decision, reason) =>
                              decidirConcepto(item, decision, reason)
                            }
                          />
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}

             {isAdmin && (conceptos.length === 0 || isNewConceptOpen) && (
  <div className="w-full rounded-2xl border border-emerald-300/20 bg-emerald-400/10 p-4">
                  <button
                    type="button"
                    onClick={() => toggleConcept("new")}
                    className="flex w-full items-center justify-between gap-3 text-left"
                  >
                    <div>
                      <p className="text-xs uppercase tracking-[0.22em] text-emerald-100/60">
                        Nueva versión
                      </p>
                      <p className="mt-1 text-lg font-semibold text-emerald-50">
                        {nextConceptLabel}
                      </p>
                      <p className="mt-1 text-xs text-emerald-50/55">
                        Carga descripción, archivos y especificaciones.
                      </p>
                    </div>
                    {isNewConceptOpen ? <FiChevronDown /> : <FiChevronRight />}
                  </button>
{isNewConceptOpen && (
  <form
    onSubmit={guardarConcepto}
    className="mt-4 space-y-4 border-t border-emerald-100/10 pt-4"
  >
    <div className="space-y-3">
      <p className="text-sm font-semibold text-white/80">
        Especificaciones extra encontradas sobre la solicitud formal
      </p>

      {conceptoSpecs.map((spec, index) => (
        <div key={index} className="flex gap-3">
          <input
            className={inputClass}
            value={spec}
            onChange={(e) => updateSpec(index, e.target.value)}
            placeholder="Ej. requiere mayor soporte lateral..."
          />

          {index === conceptoSpecs.length - 1 && (
            <button
              type="button"
              onClick={addSpec}
              className="shrink-0 rounded-xl border border-white/12 bg-white/5 px-4 py-2 text-sm text-white/85 transition hover:bg-white/10"
              title="Agregar especificación"
            >
              <FiPlus />
            </button>
          )}

          {conceptoSpecs.length > 1 && (
            <button
              type="button"
              onClick={() => removeSpec(index)}
              className={btnDanger}
              title="Eliminar especificación"
            >
              <FiX />
            </button>
          )}
        </div>
      ))}
    </div>

    <div className="space-y-3">
      <p className="text-sm font-semibold text-white/80">
        Concepto de diseño
      </p>

      <textarea
        className={`${inputClass} min-h-[110px]`}
        value={conceptoDesc}
        onChange={(e) => setConceptoDesc(e.target.value)}
        placeholder="La idea de diseño consiste en..."
      />
    </div>

    <FilePicker
      label="Adjuntar archivos del concepto"
      files={conceptoFiles}
      inputRef={conceptoInputRef}
      onChange={(list) =>
        addFiles(list, setConceptoFiles, conceptoInputRef)
      }
      onRemove={(i) => removeFile(i, setConceptoFiles)}
    />

    <button disabled={loading} className={btnPrimary}>
      <FiCheck /> Guardar concepto
    </button>
  </form>
)}
                </div>
              )}
            </div>
          </div>

          {!isAdmin && conceptos.length === 0 && (
            <div className="mt-5 rounded-2xl border border-white/10 bg-black/20 p-4 text-sm text-white/55">
              Aún no hay conceptos registrados.
            </div>
          )}
        </section>
      );
    }

    if (activeTab === "prueba") {
      return (
        <section className={cardClass}>
          <h2 className="text-xl font-semibold">Prueba de diseño</h2>
          <p className="mt-1 text-sm text-white/55">
            Las piezas fabricadas para esta fase deben ser pedidos normales
            asociados a este fixture.
          </p>

          <div className="mt-5 rounded-2xl border border-white/10 bg-black/20 p-4">
            <h3 className="font-semibold text-white/90">
              Pedidos normales asociados
            </h3>

            {linkedPedidos.length === 0 ? (
              <p className="mt-2 text-sm text-white/55">
                Todavía no hay pedidos asociados a este fixture.
              </p>
            ) : (
              <ul className="mt-3 space-y-2">
                {linkedPedidos.map((p) => (
                  <li key={p.id}>
                    <button
                      onClick={() => router.push(`/solicitudes/listado/${p.id}`)}
                      className="inline-flex items-center gap-2 text-sm text-emerald-200 underline decoration-white/20 hover:text-emerald-100"
                    >
                      <FiLink /> {p.titulo || p.id}{" "}
                      {p.subtotal ? `(MXN ${p.subtotal.toFixed(2)})` : ""}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {isAdmin && (
            <form onSubmit={guardarPrueba} className="mt-5 space-y-4">
              <div className="rounded-2xl border border-emerald-300/20 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-100">
                Nueva prueba: <strong>{nextPruebaLabel}</strong>
              </div>

              <textarea
                className={`${inputClass} min-h-[110px]`}
                value={pruebaDesc}
                onChange={(e) => setPruebaDesc(e.target.value)}
                placeholder="Describe la prueba, ensamble, funcionalidad observada y decisiones críticas..."
              />

              <FilePicker
                label="Adjuntar fotos o videos del ensamble / prueba"
                files={pruebaFiles}
                inputRef={pruebaInputRef}
                onChange={(list) => addFiles(list, setPruebaFiles, pruebaInputRef)}
                onRemove={(i) => removeFile(i, setPruebaFiles)}
                accept="image/*,video/*"
              />

              <button disabled={loading} className={btnPrimary}>
                <FiCheck /> Guardar prueba
              </button>
            </form>
          )}

          <VersionList title="Pruebas registradas" items={pruebas} />
        </section>
      );
    }

    if (activeTab === "confirmacion") {
      return (
        <section className={cardClass}>
          <h2 className="text-xl font-semibold">Confirmación conceptual</h2>
          <p className="mt-1 text-sm text-white/55">
            Se confirma la funcionalidad de la prueba por PM, diseñador y
            encargado del proceso.
          </p>

          <VersionList
            title="Pruebas pendientes / confirmadas"
            items={pruebas}
            renderActions={(item) => (
              <div className="grid gap-3">
                <ApprovalRow
                  label="PM"
                  approvalKey="pm"
                  firma={item.firmas?.pm}
                  currentUserEmail={user?.email}
                  canApprove={canApprovePM}
                  onDecision={(decision, reason) =>
                    decidirPrueba(item, "pm", decision, reason)
                  }
                />
                <ApprovalRow
                  label="Diseñador"
                  approvalKey="disenador"
                  firma={item.firmas?.disenador}
                  currentUserEmail={user?.email}
                  canApprove={canApproveDesigner}
                  onDecision={(decision, reason) =>
                    decidirPrueba(item, "disenador", decision, reason)
                  }
                />
                <ApprovalRow
                  label="Encargado del proceso"
                  approvalKey="encargado"
                  firma={item.firmas?.encargado}
                  currentUserEmail={user?.email}
                  canApprove={canApproveProcessOwner}
                  onDecision={(decision, reason) =>
                    decidirPrueba(item, "encargado", decision, reason)
                  }
                />
              </div>
            )}
          />
        </section>
      );
    }

    if (activeTab === "specDraft") {
      return (
        <section className={cardClass}>
          <h2 className="text-xl font-semibold">Spec Draft</h2>
          <p className="mt-1 text-sm text-white/55">
            Se genera cuando la confirmación conceptual queda aprobada. Será la
            guía para la versión beta.
          </p>

          {specDraftGenerada && (
            <div className="mt-5 rounded-2xl border border-emerald-300/20 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-100">
              Spec Draft registrada para este pedido.
            </div>
          )}

          <div className="mt-5 flex flex-wrap gap-3">
            <button
              onClick={generarSpecDraft}
              disabled={loading || !isAdmin}
              className={btnPrimary}
            >
              <FiFileText /> Registrar Spec Draft
            </button>
          </div>
        </section>
      );
    }

    if (activeTab === "beta") {
      return (
        <section className={cardClass}>
          <h2 className="text-xl font-semibold">Fase Beta</h2>
          <p className="mt-1 text-sm text-white/55">
            Los diseñadores proponen materiales, presupuesto, ajustes y versión
            robusta para repetibilidad.
          </p>

          {isAdmin && (
            <form onSubmit={guardarBeta} className="mt-5 space-y-4">
              <div className="rounded-2xl border border-emerald-300/20 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-100">
                Nueva propuesta: <strong>{nextBetaLabel}</strong>
              </div>

              <textarea
                className={`${inputClass} min-h-[110px]`}
                value={betaDesc}
                onChange={(e) => setBetaDesc(e.target.value)}
                placeholder="Materiales, presupuesto, ajustes, decisiones críticas, etc..."
              />

              <FilePicker
                label="Adjuntar archivos de beta"
                files={betaFiles}
                inputRef={betaInputRef}
                onChange={(list) => addFiles(list, setBetaFiles, betaInputRef)}
                onRemove={(i) => removeFile(i, setBetaFiles)}
              />

              <button disabled={loading} className={btnPrimary}>
                <FiCheck /> Guardar beta
              </button>
            </form>
          )}

          <VersionList
            title="Betas registradas"
            items={betas}
            renderActions={(item) => (
              <div className="grid gap-3">
                <ApprovalRow
                  label="PM"
                  approvalKey="pm"
                  firma={item.firmas?.pm}
                  currentUserEmail={user?.email}
                  canApprove={canApprovePM}
                  onDecision={(decision, reason) =>
                    decidirBeta(item, "pm", decision, reason)
                  }
                />
                <ApprovalRow
                  label="Encargado del proceso"
                  approvalKey="encargado"
                  firma={item.firmas?.encargado}
                  currentUserEmail={user?.email}
                  canApprove={canApproveProcessOwner}
                  onDecision={(decision, reason) =>
                    decidirBeta(item, "encargado", decision, reason)
                  }
                />
              </div>
            )}
          />
        </section>
      );
    }

    return (
      <section className={cardClass}>
        <h2 className="text-xl font-semibold">Spec Final y validación</h2>
        <p className="mt-1 text-sm text-white/55">
          La SPEC final se redacta en formato QMS y se valida por el encargado.
        </p>

        {specFinalGenerada && (
          <div className="mt-5 rounded-2xl border border-emerald-300/20 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-100">
            Spec Final registrada para este pedido.
          </div>
        )}

        <div className="mt-5 flex flex-wrap gap-3">
          <button
            onClick={generarSpecFinal}
            disabled={loading || !isAdmin}
            className={btnPrimary}
          >
            <FiFileText /> Registrar Spec Final
          </button>
        </div>
      </section>
    );
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 text-white sm:px-8">
      <button onClick={() => router.back()} className={btnSoft}>
        <FiArrowLeft /> Regresar
      </button>

      <div className="mt-6">
        <p className="text-sm uppercase tracking-[0.35em] text-emerald-300/80">
          Fixturing & Jigs
        </p>

        <h1 className="mt-2 text-3xl font-semibold text-white md:text-4xl">
          Detalles del pedido FXT
        </h1>

        <p className="mt-3 max-w-3xl text-sm text-white/60">
          Expediente formal del fixture: Solicitud, Concepto de diseño, Prueba,
          Confirmación conceptual, SPEC Draft, Beta y SPEC Final.
        </p>
      </div>

      <div className="mt-8 rounded-3xl border border-white/10 bg-white/[0.035] p-5 md:p-6">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-7">
          {tabs.map((tab, index) => {
            const selected = activeTab === tab.key;

            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveTab(tab.key)}
                className={`w-full rounded-full border px-4 py-2 text-center text-xs font-semibold transition ${
                  selected
                    ? "border-emerald-300/60 bg-emerald-400/20 text-emerald-50 shadow-[0_0_25px_rgba(16,185,129,0.18)]"
                    : tab.done
                    ? "border-emerald-300/35 bg-emerald-400/10 text-emerald-100 hover:bg-emerald-400/15"
                    : "border-white/10 bg-white/5 text-white/45 hover:bg-white/10 hover:text-white/75"
                }`}
              >
                {index + 1}. {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="mt-8">{renderTabContent()}</div>
    </div>
  );
}

function Info({ label, value }: { label: string; value?: any }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-[0.18em] text-white/40">
        {label}
      </p>
      <p className="mt-1 break-words text-sm text-white/85">{value || "—"}</p>
    </div>
  );
}

function InfoText({ label, value }: { label: string; value?: any }) {
  return (
    <div className="mt-3">
      <p className="text-sm font-semibold text-white/75">{label}</p>
      <p className="mt-1 whitespace-pre-wrap rounded-2xl border border-white/10 bg-black/20 p-4 text-sm leading-relaxed text-white/75">
        {value || "—"}
      </p>
    </div>
  );
}

function BooleanInfo({ label, value }: { label: string; value?: boolean }) {
  return (
    <div className="flex items-center gap-2 text-sm text-white/75">
      <span
        className={`h-2.5 w-2.5 rounded-full ${
          value ? "bg-emerald-300" : "bg-white/20"
        }`}
      />
      {label}: {value ? "Sí" : "No"}
    </div>
  );
}

function Block({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
      <h3 className="font-semibold text-white/90">{title}</h3>
      <div className="mt-3">{children}</div>
    </div>
  );
}

function FilePicker({
  label,
  files,
  inputRef,
  onChange,
  onRemove,
  accept,
}: {
  label: string;
  files: File[];
  inputRef: RefObject<HTMLInputElement | null>;
  onChange: (files: FileList | null) => void;
  onRemove: (index: number) => void;
  accept?: string;
}) {
  return (
    <div>
      <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-white/12 bg-white/5 px-4 py-2 text-sm text-white/85 transition hover:bg-white/10">
        <FiUpload /> {label}
        <input
          ref={inputRef}
          type="file"
          multiple
          accept={accept}
          className="hidden"
          onChange={(e) => onChange(e.target.files)}
        />
      </label>

      {files.length > 0 && (
        <div className="mt-3 rounded-2xl border border-white/10 bg-black/20 overflow-hidden">
          <div className="border-b border-white/10 px-4 py-3 text-xs text-white/55">
            Archivos seleccionados: {files.length}
          </div>

          <ul className="divide-y divide-white/10">
            {files.map((file, index) => (
              <li
                key={`${file.name}-${file.size}-${file.lastModified}`}
                className="flex items-center justify-between gap-3 px-4 py-3 text-sm text-white/75"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium text-white/85">
                    {file.name}
                  </p>
                  <p className="text-xs text-white/45">
                    {(file.size / 1024 / 1024).toFixed(2)} MB
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => onRemove(index)}
                  className="shrink-0 rounded-lg border border-red-300/20 bg-red-400/10 px-3 py-2 text-red-200 transition hover:bg-red-400/20"
                >
                  <FiTrash2 />
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function VersionList({
  title,
  items,
  renderActions,
}: {
  title: string;
  items: FixtureVersion[];
  renderActions?: (item: FixtureVersion) => ReactNode;
}) {
  if (items.length === 0) {
    return (
      <div className="mt-5 rounded-2xl border border-white/10 bg-black/20 p-4 text-sm text-white/55">
        Aún no hay registros en esta sección.
      </div>
    );
  }

  return (
    <div className="mt-6">
      <h3 className="font-semibold text-white/90">{title}</h3>

      <div className="mt-3 space-y-3">
        {items.map((item) => {
          const fecha =
            item.createdAt?.toDate?.() instanceof Date
              ? item.createdAt.toDate().toLocaleString()
              : "Fecha no disponible";

          return (
            <div
              key={item.id}
              className="rounded-2xl border border-white/10 bg-black/20 p-4"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-semibold text-white/90">
                    {item.versionLabel}
                  </p>
                  <p className="text-xs text-white/45">{fecha}</p>
                </div>

                <span
                  className={`rounded-full border px-3 py-1 text-xs font-semibold ${
                    item.status === "aprobado"
                      ? "border-emerald-300/30 bg-emerald-400/10 text-emerald-100"
                      : item.status === "rechazado"
                      ? "border-red-300/30 bg-red-400/10 text-red-100"
                      : "border-yellow-300/30 bg-yellow-400/10 text-yellow-100"
                  }`}
                >
                  {item.status || "pendiente"}
                </span>
              </div>

              {item.descripcion && (
                <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-white/75">
                  {item.descripcion}
                </p>
              )}

              {item.especificacionesExtra &&
                item.especificacionesExtra.length > 0 && (
                  <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-white/70">
                    {item.especificacionesExtra.map((s, i) => (
                      <li key={i}>{s}</li>
                    ))}
                  </ul>
                )}

              {item.archivos && item.archivos.length > 0 && (
                <div className="mt-3 space-y-1">
                  {item.archivos.map((file) => (
                    <a
                      key={file.url}
                      href={file.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block text-sm text-emerald-200 underline decoration-white/20 hover:text-emerald-100"
                    >
                      {file.name}
                    </a>
                  ))}
                </div>
              )}

              {renderActions && (
                <div className="mt-4 border-t border-white/10 pt-4">
                  {renderActions(item)}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ApprovalRow({
  label,
  approvalKey,
  firma,
  currentUserEmail,
  canApprove,
  onDecision,
}: {
  label: string;
  approvalKey: ApprovalRole;
  firma?: any;
  currentUserEmail?: string;
  canApprove: boolean;
  onDecision: (decision: Decision, reason?: string) => void;
}) {
  const normalizedFirma = {
    ...firma,
    decision: firma?.decision || "",
    correo: firma?.correo || firma?.approvedByEmail || "",
    nombre: firma?.nombre || firma?.approvedByName || "",
    fecha: firma?.fecha || firma?.approvedAt || "",
    rejectReason: firma?.rejectReason || "",
  };

  const alreadyAnswered =
    normalizedFirma.decision === "aprobado" ||
    normalizedFirma.decision === "rechazado";

  const [signingOpen, setSigningOpen] = useState(false);
  const [decision, setDecision] = useState<Decision | "">(
    normalizedFirma.decision || ""
  );
  const [reason, setReason] = useState(normalizedFirma.rejectReason || "");

  useEffect(() => {
    setDecision(normalizedFirma.decision || "");
    setReason(normalizedFirma.rejectReason || "");
    setSigningOpen(false);
  }, [normalizedFirma.decision, normalizedFirma.rejectReason]);

  const statusClass =
    normalizedFirma.decision === "aprobado"
      ? "border-emerald-300/30 bg-emerald-400/10 text-emerald-100"
      : normalizedFirma.decision === "rechazado"
      ? "border-red-300/30 bg-red-400/10 text-red-100"
      : "border-yellow-300/30 bg-yellow-400/10 text-yellow-100";

  const submitDecision = () => {
    if (!decision) {
      alert("Selecciona aprobado o rechazado.");
      return;
    }

    if (decision === "rechazado" && !reason.trim()) {
      alert("Agrega una breve explicación del rechazo.");
      return;
    }

    onDecision(decision, decision === "rechazado" ? reason : "");
    setSigningOpen(false);
  };

  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold text-white/85">{label}</p>
            <span className={`rounded-full border px-3 py-1 text-[11px] font-semibold ${statusClass}`}>
              {normalizedFirma.decision || "pendiente"}
            </span>
          </div>

          {alreadyAnswered && normalizedFirma.nombre && (
            <p className="mt-2 text-xs text-white/60">
              {normalizedFirma.decision === "aprobado" ? "Aprobado por" : "Rechazado por"}{" "}
              <span className="font-semibold text-white/85">
                {normalizedFirma.nombre}
              </span>
            </p>
          )}

          {alreadyAnswered && normalizedFirma.fecha && (
            <p className="mt-1 text-[11px] text-white/35">
              {normalizedFirma.fecha}
            </p>
          )}

          {normalizedFirma.decision === "rechazado" &&
            normalizedFirma.rejectReason && (
              <div className="mt-3 rounded-xl border border-red-300/20 bg-red-400/10 px-3 py-2 text-xs leading-relaxed text-red-100">
                Motivo: {normalizedFirma.rejectReason}
              </div>
            )}

          {!canApprove && !alreadyAnswered && (
            <p className="mt-2 text-xs text-yellow-100/75">
              Pendiente de firma. Tu cuenta no está asignada como {approvalKey === "pm" ? "PM del proyecto" : label}.
            </p>
          )}
        </div>

        {canApprove && (
          <button
            type="button"
            onClick={() => setSigningOpen((prev) => !prev)}
            className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white/75 hover:bg-white/10"
          >
            {alreadyAnswered ? "Editar firma" : "Firmar"}
          </button>
        )}
      </div>

      {signingOpen && canApprove && (
        <div className="mt-4 grid gap-3 border-t border-white/10 pt-4">
          <label className="text-xs font-semibold uppercase tracking-[0.18em] text-white/40">
            Decisión
          </label>

          <select
            value={decision}
            onChange={(e) => setDecision(e.target.value as Decision | "")}
            className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none focus:ring-2 focus:ring-emerald-400/20"
          >
            <option value="">Seleccionar decisión</option>
            <option value="aprobado">Aprobado</option>
            <option value="rechazado">Rechazado</option>
          </select>

          {decision === "rechazado" && (
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Razón del rechazo o cambio de decisión..."
              className="min-h-[82px] w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-xs text-white placeholder:text-white/35 outline-none focus:ring-2 focus:ring-emerald-400/20"
            />
          )}

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={submitDecision}
              className="rounded-lg border border-emerald-300/25 bg-emerald-400/10 px-3 py-1.5 text-xs text-emerald-100 hover:bg-emerald-400/20"
            >
              Guardar firma
            </button>
            <button
              type="button"
              onClick={() => setSigningOpen(false)}
              className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white/75 hover:bg-white/10"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
