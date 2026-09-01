"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import {
  collection,
  doc,
  setDoc,
  serverTimestamp,
  query,
  where,
  getDocs,
} from "firebase/firestore";
import { auth, db, storage } from "@/src/firebase/firebaseConfig";
import { useRouter, useSearchParams } from "next/navigation";
import { FiX, FiUpload, FiVideo } from "react-icons/fi";
import OrderFlowHeader from "../components/OrderFlowHeader";

export default function EspecificacionesPage() {
  const [titulo, setTitulo] = useState("");
  const [prefijoTitulo, setPrefijoTitulo] = useState<string>("");
  const [tituloFinalUnico, setTituloFinalUnico] = useState("");
  const [explicacion, setExplicacion] = useState("");
  const [fecha, setFecha] = useState("");
  const [archivos, setArchivos] = useState<File[]>([]);
  const [subiendo, setSubiendo] = useState(false);

  const [grabando, setGrabando] = useState(false);
  const [pausado, setPausado] = useState(false);
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [videoFile, setVideoFile] = useState<File | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const router = useRouter();
  const searchParams = useSearchParams();

  const fixtureRelacionadoId =
    searchParams.get("fixtureRelacionadoId") ||
    localStorage.getItem("fixtureRelacionadoId");

  const fixtureRelacionadoFase =
    searchParams.get("fixtureRelacionadoFase") ||
    localStorage.getItem("fixtureRelacionadoFase");

  const fixtureRelacionadoVersion =
    searchParams.get("fixtureRelacionadoVersion") ||
    localStorage.getItem("fixtureRelacionadoVersion");

  const fixtureRelacionadoProyecto =
    searchParams.get("proyecto") ||
    localStorage.getItem("fixtureRelacionadoProyecto");

  const primaryButton =
    "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-emerald-500/90 px-4 py-2 text-sm font-semibold text-black transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-60 sm:rounded-full";

  const darkButton =
    "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.06] px-4 py-2 text-sm text-white transition hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-60 sm:rounded-full";

  const warnButton =
    "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-yellow-500/90 px-4 py-2 text-sm font-semibold text-black transition hover:bg-yellow-400 disabled:cursor-not-allowed disabled:opacity-60 sm:rounded-full";

  const card =
    "rounded-2xl border border-white/10 bg-white/[0.035] shadow-none sm:bg-white/5 sm:backdrop-blur sm:shadow-[0_10px_35px_rgba(0,0,0,0.35)]";

  const input =
    "w-full rounded-xl border border-white/10 bg-white/[0.05] px-3 py-3 text-base text-white outline-none placeholder:text-white/35 focus:border-emerald-300/30 focus:ring-2 focus:ring-emerald-400/30 sm:py-2 sm:text-sm";

  const label = "mb-1.5 block text-sm font-medium text-white/80";

  const normalize = (s: string) =>
    (s || "")
      .toString()
      .trim()
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");

  const ABBR_MAP: Record<string, string> = {
    "pla 2.85mm": "UMKR",
    "pla 1.75mm": "BML",
    "nylon retardante de fuego 1.75 (bambu lab)": "BML",
    "resina formlabs 3b": "FL3B",
    "resina formlabs 2b": "FL2B",
    "laser co2": "Láser",
    "láser co2": "Láser",
    "fresadora cnc": "CNC",
    "polipropileno": "CNC",
    "hdpe": "CNC",
    "necesidad": "Need",
    "libre": "FXT",
  };

  function resolveAbbrFromValue(value: string | null): string | null {
    if (!value) return null;
    const key = normalize(value);
    if (ABBR_MAP[key]) return ABBR_MAP[key];
    if (key.includes("2.85") && key.includes("pla")) return "UMKR";
    if (key.includes("1.75") && key.includes("pla")) return "BML";
    if (key.includes("1.75") && key.includes("nylon")) return "BML";
    if (key.includes("formlabs") && key.includes("3b")) return "FL3B";
    if (key.includes("formlabs") && key.includes("2b")) return "FL2B";
    if (key.includes("laser") || key.includes("láser")) return "Láser";
    if (key.includes("cnc")) return "CNC";
    if (key.includes("necesidad") || key === "need") return "Need";
    if (key.includes("libre")) return "FXT";
    return null;
  }

  function getProyectoCode(raw: string | null): string {
    const clean = (raw || "")
      .toString()
      .replace(/[^A-Za-z0-9]/g, "")
      .toUpperCase()
      .slice(0, 4);
    return clean || "PRJ0";
  }

  function computePrefijo(): string {
    const servicio = localStorage.getItem("servicio");
    const tecnica = localStorage.getItem("tecnica");
    const material = localStorage.getItem("material");
    const maquina = localStorage.getItem("maquina");

    const sNorm = normalize(servicio || "");
    if (sNorm.includes("necesidad") || sNorm === "need") {
      const proyecto = localStorage.getItem("proyecto");
      const code = getProyectoCode(proyecto);
      return `Need_${code}_`;
    }

    const abbrCandidate =
      resolveAbbrFromValue(servicio) ||
      resolveAbbrFromValue(tecnica) ||
      resolveAbbrFromValue(material) ||
      resolveAbbrFromValue(maquina) ||
      "GEN";

    const proyecto = localStorage.getItem("proyecto");
    const code = getProyectoCode(proyecto);
    return `${abbrCandidate}_${code}_`;
  }

  async function generarTituloUnico(tituloBase: string): Promise<string> {
    let tituloTest = tituloBase;
    let i = 1;

    while (true) {
      const q = query(collection(db, "pedidos"), where("titulo", "==", tituloTest));
      const snap = await getDocs(q);
      if (snap.empty) return tituloTest;
      tituloTest = `${tituloBase}_${String(i).padStart(2, "0")}`;
      i++;
    }
  }

  useEffect(() => {
    setPrefijoTitulo(computePrefijo());
  }, []);

  useEffect(() => {
    let alive = true;
    const t = setTimeout(async () => {
      if (!prefijoTitulo) return;

      const base = `${prefijoTitulo}${titulo}`;
      if (!titulo) {
        if (alive) setTituloFinalUnico(base);
        return;
      }

      const unico = await generarTituloUnico(base);
      if (alive) setTituloFinalUnico(unico);
    }, 350);

    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [titulo, prefijoTitulo]);

  const handleSelectFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    const nuevosArchivos = Array.from(e.target.files || []);
    setArchivos((prev) => [...prev, ...nuevosArchivos]);
    e.target.value = "";
  };

  const handleRemove = (nombre: string) => {
    setArchivos((prev) => prev.filter((file) => file.name !== nombre));
    if (videoFile?.name === nombre) setVideoFile(null);
  };

  const handleClickBoton = () => fileInputRef.current?.click();
  const totalArchivos = useMemo(() => archivos.length, [archivos]);

  const handleUploadAll = async () => {
    if (!tituloFinalUnico) return alert("Agrega el título del pedido.");
    if (!fecha) return alert("Selecciona una fecha de entrega.");

    const prefijo = computePrefijo();
    setPrefijoTitulo(prefijo);
    setSubiendo(true);

    try {
      const proyecto =
        fixtureRelacionadoProyecto ||
        localStorage.getItem("proyecto") ||
        "Sin proyecto";
      const servicio = localStorage.getItem("servicio") || "Sin servicio";
      const maquina = localStorage.getItem("maquina") || "Sin máquina";
      const material = localStorage.getItem("material") || "Sin material";
      const usuario = auth.currentUser?.email || "desconocido";

      const pedidosCol = collection(db, "pedidos");
      const nuevoDocRef = doc(pedidosCol);
      const carpetaId = nuevoDocRef.id;
      const archivosSubidos: string[] = [];

      for (const archivo of archivos) {
        const archivoRef = ref(storage, `pedidos/${carpetaId}/${archivo.name}`);
        await uploadBytes(archivoRef, archivo);
        const url = await getDownloadURL(archivoRef);
        archivosSubidos.push(url);
      }

      let urlDelVideo = "";
      if (videoFile) {
        const videoStorageRef = ref(
          storage,
          `pedidos/${carpetaId}/${videoFile.name}`,
        );
        await uploadBytes(videoStorageRef, videoFile);
        urlDelVideo = await getDownloadURL(videoStorageRef);
        if (!archivos.includes(videoFile)) archivosSubidos.push(urlDelVideo);
      }

      await setDoc(nuevoDocRef, {
        titulo: tituloFinalUnico,
        descripcion: explicacion,
        fechaLimite: fecha,
        proyecto,
        servicio,
        maquina,
        material,
        usuario,
        archivos: archivosSubidos,
        videoURL: urlDelVideo,
        timestamp: serverTimestamp(),
        correoUsuario: usuario,
        fixtureRelacionadoId: fixtureRelacionadoId || null,
        fixtureRelacionadoFase: fixtureRelacionadoFase || null,
        fixtureRelacionadoVersion: fixtureRelacionadoVersion || null,
        fixtureRelacionadoProyecto: fixtureRelacionadoProyecto || null,
      });

      let mondaySincronizado = true;

      try {
        const currentUser = auth.currentUser;
        if (!currentUser) throw new Error("No hay una sesión activa");

        const idToken = await currentUser.getIdToken();
        const mondayResponse = await fetch("/api/monday/pedidos", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${idToken}`,
          },
          body: JSON.stringify({ pedidoId: nuevoDocRef.id }),
        });

        const responseText = await mondayResponse.text();
        let mondayResult: { error?: string; mondayUserFound?: boolean } = {};

        try {
          mondayResult = responseText ? JSON.parse(responseText) : {};
        } catch {
          throw new Error(
            `La ruta de Monday respondió con ${mondayResponse.status} y no devolvió JSON`,
          );
        }

        if (!mondayResponse.ok) {
          throw new Error(
            mondayResult.error ||
              `Error ${mondayResponse.status} al sincronizar con Monday`,
          );
        }

        if (mondayResult.mondayUserFound === false) {
          console.warn(
            "El pedido se creó en Monday, pero no se encontró una cuenta con el correo del solicitante.",
          );
        }
      } catch (mondayError) {
        mondaySincronizado = false;
        console.error(
          "El pedido se guardó, pero Monday no pudo sincronizarse:",
          mondayError,
        );
      }

      if (mondaySincronizado) {
        alert("✅ Pedido enviado con éxito");
      } else {
        alert("⚠️ El pedido se guardó correctamente, pero no pudo enviarse a Monday.");
      }

      localStorage.removeItem("fixtureRelacionadoId");
      localStorage.removeItem("fixtureRelacionadoFase");
      localStorage.removeItem("fixtureRelacionadoVersion");
      localStorage.removeItem("fixtureRelacionadoProyecto");
      router.push("/");
    } catch (err: any) {
      console.error(err);
      alert(`Error: ${err.message || err}`);
    } finally {
      setSubiendo(false);
    }
  };

  const iniciarGrabacion = async () => {
    const mediaStream = await navigator.mediaDevices.getUserMedia({
      video: true,
      audio: true,
    });
    const recorder = new MediaRecorder(mediaStream);
    const chunks: Blob[] = [];

    recorder.ondataavailable = (e) => chunks.push(e.data);
    recorder.onstop = () => {
      const blob = new Blob(chunks, { type: "video/mp4" });
      const archivo = new File([blob], `grabacion-${Date.now()}.mp4`, {
        type: "video/mp4",
      });
      setVideoFile(archivo);
      setArchivos((prev) => [...prev, archivo]);

      if (videoRef.current) videoRef.current.srcObject = null;
      mediaStream.getTracks().forEach((track) => track.stop());
      setStream(null);
    };

    recorder.start();
    setMediaRecorder(recorder);
    setStream(mediaStream);
    setGrabando(true);
    setPausado(false);
  };

  const detenerGrabacion = () => {
    mediaRecorder?.stop();
    setGrabando(false);
  };

  const togglePausa = () => {
    if (!mediaRecorder) return;
    if (mediaRecorder.state === "recording") {
      mediaRecorder.pause();
      setPausado(true);
    } else if (mediaRecorder.state === "paused") {
      mediaRecorder.resume();
      setPausado(false);
    }
  };

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
      videoRef.current.muted = true;
      videoRef.current.play().catch(() => {});
    }
  }, [stream]);

  return (
    <div className="mx-auto w-full max-w-5xl px-3 py-4 sm:px-6 sm:py-8">
      <OrderFlowHeader
        step={5}
        title="Especificaciones del pedido"
        description="Completa la información final, adjunta la evidencia necesaria y envía la solicitud."
        detail={
          totalArchivos > 0
            ? `${totalArchivos} archivo(s) listo(s) para enviar`
            : "Los archivos son opcionales"
        }
        onBack={() => router.back()}
      />

      <div className="grid grid-cols-1 gap-3 sm:gap-5 lg:grid-cols-[1.2fr_0.8fr]">
        <div className={`${card} space-y-5 p-4 sm:p-5`}>
          <div>
            <label className={label}>Título del pedido</label>

            {/* Móvil: prefijo separado para evitar que comprima el campo. */}
            <div className="sm:hidden">
              <div className="mb-2 inline-flex max-w-full rounded-lg border border-emerald-300/15 bg-emerald-400/[0.08] px-2.5 py-1.5 text-xs font-medium text-emerald-100">
                <span className="truncate">{prefijoTitulo || "GEN_PRJ0_"}</span>
              </div>
              <input
                type="text"
                value={titulo}
                onChange={(e) => setTitulo(e.target.value)}
                className={input}
                placeholder="Nombre corto del pedido"
              />
            </div>

            <div className="hidden items-stretch overflow-hidden rounded-xl border border-white/10 bg-white/5 sm:flex">
              <span className="select-none whitespace-nowrap border-r border-white/10 px-3 py-2 text-white/70">
                {prefijoTitulo || "GEN_PRJ0_"}
              </span>
              <input
                type="text"
                value={titulo}
                onChange={(e) => setTitulo(e.target.value)}
                className="min-w-0 flex-1 bg-transparent px-3 py-2 text-white outline-none"
                placeholder="Escribe la parte final. Evita usar /"
              />
            </div>

            <p className="mt-2 break-words text-xs leading-relaxed text-white/45">
              Se guardará como:{" "}
              <span className="font-semibold text-white/75">
                {tituloFinalUnico || "..."}
              </span>
            </p>
          </div>

          <div>
            <label className={label}>Explicación del pedido</label>
            <textarea
              rows={5}
              value={explicacion}
              onChange={(e) => setExplicacion(e.target.value)}
              className={`${input} min-h-[130px] resize-y`}
              placeholder="Describe medidas, tolerancias, objetivo, cantidad o cualquier detalle importante."
            />
          </div>

          <div>
            <label className={label}>Fecha propuesta</label>
            <input
              type="date"
              value={fecha}
              onChange={(e) => setFecha(e.target.value)}
              className={`${input} [color-scheme:dark]`}
            />
          </div>

          {/* En escritorio se conserva el envío dentro de la tarjeta principal. */}
          <div className="hidden lg:block">
            <button
              type="button"
              onClick={handleUploadAll}
              disabled={subiendo}
              className={`${primaryButton} h-12 w-full`}
            >
              {subiendo ? "Enviando pedido..." : "Enviar pedido"}
            </button>
            <p className="mt-2 text-xs leading-relaxed text-white/40">
              Los archivos se guardarán junto con el pedido y la solicitud se sincronizará automáticamente.
            </p>
          </div>
        </div>

        <div className={`${card} space-y-4 p-4 sm:p-5`}>
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="font-semibold text-white">Archivos y video</h2>
              <p className="mt-0.5 text-xs text-white/45">Opcional</p>
            </div>
            <span className="shrink-0 rounded-full bg-white/[0.06] px-2.5 py-1 text-xs text-white/55">
              {archivos.length} adjunto(s)
            </span>
          </div>

          <div className="grid grid-cols-1 gap-2 min-[380px]:grid-cols-2 lg:flex lg:flex-wrap">
            <button type="button" onClick={handleClickBoton} className={darkButton}>
              <FiUpload /> Seleccionar archivos
            </button>

            <button
              type="button"
              onClick={grabando ? detenerGrabacion : iniciarGrabacion}
              className={darkButton}
            >
              <FiVideo /> {grabando ? "Detener" : "Grabar video"}
            </button>

            {grabando && (
              <button type="button" onClick={togglePausa} className={warnButton}>
                {pausado ? "Reanudar" : "Pausar"}
              </button>
            )}
          </div>

          {grabando && (
            <video
              ref={videoRef}
              autoPlay
              muted
              playsInline
              className="h-auto max-h-[55dvh] w-full rounded-xl border border-white/10 bg-black/60 object-cover sm:h-56"
            />
          )}

          <input
            ref={fileInputRef}
            type="file"
            multiple
            onChange={handleSelectFiles}
            className="hidden"
          />

          {archivos.length === 0 ? (
            <div className="rounded-xl border border-dashed border-white/10 bg-white/[0.025] p-4 text-center text-sm text-white/45">
              No has adjuntado archivos todavía.
            </div>
          ) : (
            <div className="max-h-[52vh] space-y-2 overflow-auto pr-1">
              {archivos.map((file) => (
                <div
                  key={file.name}
                  className="rounded-xl border border-white/10 bg-white/[0.04] p-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="break-words text-sm font-medium leading-snug text-white">
                        {file.name}
                      </div>
                      <div className="mt-1 text-xs text-white/45">
                        {file.type || "archivo"} • {(file.size / 1024 / 1024).toFixed(2)} MB
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleRemove(file.name)}
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.06] transition hover:bg-white/15"
                      title="Quitar"
                      aria-label={`Quitar ${file.name}`}
                    >
                      <FiX className="text-white/80" />
                    </button>
                  </div>

                  {file.type.startsWith("video") && (
                    <video
                      controls
                      src={URL.createObjectURL(file)}
                      className="mt-3 w-full rounded-xl border border-white/10"
                    />
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* En móvil el envío queda al final natural del recorrido. */}
      <div className="mt-4 lg:hidden">
        <button
          type="button"
          onClick={handleUploadAll}
          disabled={subiendo}
          className={`${primaryButton} h-13 w-full text-base`}
        >
          {subiendo ? "Enviando pedido..." : "Enviar pedido"}
        </button>
        <p className="mt-2 px-1 text-center text-xs leading-relaxed text-white/40">
          Revisa la información y los archivos antes de enviar.
        </p>
      </div>
    </div>
  );
}
