"use client";

import { useEffect, useMemo, useRef, useState, FormEvent } from "react";
import type { Dispatch, RefObject, SetStateAction } from "react";
import {
  addDoc,
  collection,
  doc,
  updateDoc,
} from "firebase/firestore";
import { FiArrowLeft } from "react-icons/fi";
import { db } from "@/src/firebase/firebaseConfig";

import type {
  Props,
  FixtureVersion,
  ApprovalRole,
  Decision,
  UserPermissionData,
  LinkedPedido,
  TabKey,
} from "./detalleFixture/types";

import { btnSoft } from "./detalleFixture/styles";
import { normalizePermissionValue } from "./detalleFixture/helpers";

import { uploadFixtureFiles } from "./detalleFixture/services/fixtureStorage";
import { registrarHistorialFixture } from "./detalleFixture/services/fixtureHistorial";
import {
  getFixtureSubcollections,
  getLinkedPedidos,
  getUserPermissionsByEmail,
} from "./detalleFixture/services/fixtureData";
import { buildFixtureFirmaPayload } from "./detalleFixture/services/fixtureDecisiones";

import ResumenSolicitud from "./detalleFixture/sections/ResumenSolicitud";
import ConceptoDiseno from "./detalleFixture/sections/ConceptoDiseno";
import PruebaDiseno from "./detalleFixture/sections/PruebaDiseno";
import ConfirmacionConceptual from "./detalleFixture/sections/ConfirmacionConceptual";
import SpecDraft from "./detalleFixture/sections/SpecDraft";
import FaseBeta from "./detalleFixture/sections/FaseBeta";
import SpecFinal from "./detalleFixture/sections/SpecFinal";

export default function DetalleFixture({
  pedido,
  pedidoId,
  isAdmin,
  user,
}: Props) {
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
      const data = await getFixtureSubcollections(pedidoId);
      setConceptos(data.conceptos);
      setPruebas(data.pruebas);
      setBetas(data.betas);
    } catch (error) {
      console.error("Error cargando subcolecciones FXT:", error);
    }
  };

  const loadUserPermissions = async () => {
    try {
      const found = await getUserPermissionsByEmail(user?.email);
      setUserData(found);
    } catch (error) {
      console.error("Error cargando permisos del usuario:", error);
      setUserData(null);
    }
  };

  const getFreshUserPermissions =
    async (): Promise<UserPermissionData | null> => {
      const found = await getUserPermissionsByEmail(user?.email);
      setUserData(found);
      return found;
    };

  const loadLinkedPedidos = async () => {
    try {
      const rows = await getLinkedPedidos(pedidoId);
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
    await registrarHistorialFixture({
      pedidoId,
      tipo,
      descripcion,
      userEmail: user?.email,
    });
  };

  const buildFirmaPayload = (decision: Decision, rejectReason?: string) =>
    buildFixtureFirmaPayload({
      decision,
      rejectReason,
      userEmail: user?.email,
      userDisplayName,
    });

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

    if (decision === "rechazado" && !String(rejectReason || "").trim()) {
      alert("Agrega una breve explicación del rechazo.");
      return false;
    }

    return true;
  };

  const guardarConcepto = async (e: FormEvent) => {
    e.preventDefault();

    if (!isAdmin) return alert("Solo administradores pueden registrar conceptos.");
    if (!conceptoDesc.trim()) return alert("Agrega la descripción del concepto.");

    try {
      setLoading(true);

      const archivos = await uploadFixtureFiles({
        pedidoId,
        files: conceptoFiles,
        folder: `conceptos/${nextConceptLabel}`,
      });

      await addDoc(collection(db, "pedidos", pedidoId, "fixture_conceptos"), {
        versionLabel: nextConceptLabel,
        descripcion: conceptoDesc.trim(),
        especificacionesExtra: conceptoSpecs
          .map((s) => s.trim())
          .filter(Boolean),
        archivos,
        status: "pendiente",
        creadoPor: user?.email || "",
        createdAt: new Date(),
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
      alert(
        "Solo una cuenta PM asignada al proyecto puede aprobar o rechazar el concepto de diseño."
      );
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
          decision === "rechazado"
            ? `. Motivo: ${String(rejectReason || "").trim()}`
            : "."
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

      const archivos = await uploadFixtureFiles({
        pedidoId,
        files: pruebaFiles,
        folder: `pruebas/${nextPruebaLabel}`,
      });

      await addDoc(collection(db, "pedidos", pedidoId, "fixture_pruebas"), {
        versionLabel: nextPruebaLabel,
        descripcion: pruebaDesc.trim(),
        archivos,
        status: "pendiente",
        creadoPor: user?.email || "",
        createdAt: new Date(),
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

      const archivos = await uploadFixtureFiles({
        pedidoId,
        files: betaFiles,
        folder: `beta/${nextBetaLabel}`,
      });

      await addDoc(collection(db, "pedidos", pedidoId, "fixture_betas"), {
        versionLabel: nextBetaLabel,
        descripcion: betaDesc.trim(),
        archivos,
        status: "pendiente",
        creadoPor: user?.email || "",
        createdAt: new Date(),
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
      alert(
        "No se puede registrar la Spec Draft hasta que PM, diseñador y encargado aprueben una prueba."
      );
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
      alert(
        "No se puede registrar la Spec Final hasta que PM y encargado aprueben una Beta."
      );
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

      const safeTitle = String(pedido?.titulo || pedido?.io || "solicitud-formal")
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
   <ResumenSolicitud
  pedido={pedido}
  pedidoId={pedidoId}
  faseActual={faseActual}
  userDisplayName={userDisplayName}
  generatingPdf={generatingPdf}
  onDownloadDocx={descargarSolicitudFormalPDF}
/>

      );
    }

    if (activeTab === "concepto") {
      return (
        <ConceptoDiseno
          conceptos={conceptos}
          isAdmin={isAdmin}
          loading={loading}
          nextConceptLabel={nextConceptLabel}
          conceptoDesc={conceptoDesc}
          setConceptoDesc={setConceptoDesc}
          conceptoSpecs={conceptoSpecs}
          conceptoFiles={conceptoFiles}
          setConceptoFiles={setConceptoFiles}
          conceptoInputRef={conceptoInputRef}
          expandedConceptIds={expandedConceptIds}
          setExpandedConceptIds={setExpandedConceptIds}
          userEmail={user?.email}
          canApprovePM={canApprovePM}
          addFiles={addFiles}
          removeFile={removeFile}
          updateSpec={updateSpec}
          addSpec={addSpec}
          removeSpec={removeSpec}
          onGuardarConcepto={guardarConcepto}
          onDecidirConcepto={decidirConcepto}
        />
      );
    }

    if (activeTab === "prueba") {
      return (
        <PruebaDiseno
          pruebas={pruebas}
          linkedPedidos={linkedPedidos}
          isAdmin={isAdmin}
          loading={loading}
          nextPruebaLabel={nextPruebaLabel}
          pruebaDesc={pruebaDesc}
          setPruebaDesc={setPruebaDesc}
          pruebaFiles={pruebaFiles}
          setPruebaFiles={setPruebaFiles}
          pruebaInputRef={pruebaInputRef}
          addFiles={addFiles}
          removeFile={removeFile}
          onGuardarPrueba={guardarPrueba}
        />
      );
    }

    if (activeTab === "confirmacion") {
      return (
        <ConfirmacionConceptual
          pruebas={pruebas}
          userEmail={user?.email}
          canApprovePM={canApprovePM}
          canApproveDesigner={canApproveDesigner}
          canApproveProcessOwner={canApproveProcessOwner}
          onDecidirPrueba={decidirPrueba}
        />
      );
    }

    if (activeTab === "specDraft") {
      return (
        <SpecDraft
          specDraftGenerada={specDraftGenerada}
          loading={loading}
          isAdmin={isAdmin}
          onGenerarSpecDraft={generarSpecDraft}
        />
      );
    }

    if (activeTab === "beta") {
      return (
        <FaseBeta
          betas={betas}
          isAdmin={isAdmin}
          loading={loading}
          nextBetaLabel={nextBetaLabel}
          betaDesc={betaDesc}
          setBetaDesc={setBetaDesc}
          betaFiles={betaFiles}
          setBetaFiles={setBetaFiles}
          betaInputRef={betaInputRef}
          userEmail={user?.email}
          canApprovePM={canApprovePM}
          canApproveProcessOwner={canApproveProcessOwner}
          addFiles={addFiles}
          removeFile={removeFile}
          onGuardarBeta={guardarBeta}
          onDecidirBeta={decidirBeta}
        />
      );
    }

    return (
      <SpecFinal
        specFinalGenerada={specFinalGenerada}
        loading={loading}
        isAdmin={isAdmin}
        onGenerarSpecFinal={generarSpecFinal}
      />
    );
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 text-white sm:px-8">
      <button onClick={() => window.history.back()} className={btnSoft}>
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