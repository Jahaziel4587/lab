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
import { useRouter } from "next/navigation";
import { FiX, FiUpload, FiVideo, FiArrowLeft } from "react-icons/fi";

export default function EspecificacionesPage() {
  // Sufijo editable por el usuario
  const [titulo, setTitulo] = useState("");
  const [prefijoTitulo, setPrefijoTitulo] = useState<string>("");

  // Título final garantizado único
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

  // ---------- UI helpers ----------
  const baseButton =
    "inline-flex items-center gap-2 px-4 py-2 rounded-full " +
    "bg-white/10 text-white backdrop-blur " +
    "border border-white/10 " +
    "hover:bg-white/20 transition disabled:opacity-60 disabled:cursor-not-allowed";

  const primaryButton =
    "inline-flex items-center justify-center gap-2 px-4 py-2 rounded-full " +
    "bg-emerald-500/90 text-black font-semibold " +
    "hover:bg-emerald-400 transition disabled:opacity-60 disabled:cursor-not-allowed";

  const darkButton =
    "inline-flex items-center justify-center gap-2 px-4 py-2 rounded-full " +
    "bg-white/10 text-white border border-white/10 backdrop-blur " +
    "hover:bg-white/20 transition disabled:opacity-60 disabled:cursor-not-allowed";

  const warnButton =
    "inline-flex items-center justify-center gap-2 px-4 py-2 rounded-full " +
    "bg-yellow-500/90 text-black font-semibold " +
    "hover:bg-yellow-400 transition disabled:opacity-60 disabled:cursor-not-allowed";

  const card =
    "rounded-2xl bg-white/5 backdrop-blur border border-white/10 " +
    "shadow-[0_10px_35px_rgba(0,0,0,0.35)]";

  const input =
    "w-full px-3 py-2 rounded-xl bg-white/5 text-white " +
    "border border-white/10 outline-none " +
    "focus:ring-2 focus:ring-emerald-400/40 focus:border-emerald-300/30";

  const label = "block text-sm font-medium text-white/80 mb-1";

  // ---------- Helpers ----------
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

  // ---------- Generar título único ----------
  async function generarTituloUnico(tituloBase: string): Promise<string> {
    let tituloTest = tituloBase;
    let i = 1;

    while (true) {
      const q = query(
        collection(db, "pedidos"),
        where("titulo", "==", tituloTest)
      );
      const snap = await getDocs(q);
      if (snap.empty) return tituloTest;

      tituloTest = `${tituloBase}_${String(i).padStart(2, "0")}`;
      i++;
    }
  }

  // Calcular prefijo al montar
  useEffect(() => {
    setPrefijoTitulo(computePrefijo());
  }, []);

  // Debounce para no spamear Firestore en cada tecla
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

  // -------------------- Archivos --------------------
  const handleSelectFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    const nuevosArchivos = Array.from(e.target.files || []);
    setArchivos((prev) => [...prev, ...nuevosArchivos]);
    e.target.value = "";
  };

  const handleRemove = (nombre: string) => {
    setArchivos((prev) => prev.filter((file) => file.name !== nombre));
    if (videoFile?.name === nombre) setVideoFile(null);
  };

  const handleClickBoton = () => {
    fileInputRef.current?.click();
  };

  const totalArchivos = useMemo(() => archivos.length, [archivos]);

  // -------------------- Upload / Guardado --------------------
  const handleUploadAll = async () => {
    if (!tituloFinalUnico) return alert("Agrega el título del pedido.");
    if (!fecha) return alert("Selecciona una fecha de entrega.");

    const prefijo = computePrefijo();
    setPrefijoTitulo(prefijo);

    setSubiendo(true);

    try {
      const proyecto = localStorage.getItem("proyecto") || "Sin proyecto";
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
          `pedidos/${carpetaId}/${videoFile.name}`
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
      });

      alert("✅ Pedido enviado con éxito");
      router.push("/");
    } catch (err: any) {
      console.error(err);
      alert(`Error: ${err.message || err}`);
    }

    setSubiendo(false);
  };

  // -------------------- Grabación de video --------------------
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
    <div className="relative max-w-5xl mx-auto px-4 py-6 space-y-5">
      {/* Top bar */}
      <div className="flex items-center justify-between gap-3">
        <button className={baseButton} onClick={() => router.back()}>
          <FiArrowLeft className="opacity-80" /> Regresar
        </button>

        <div className="text-right text-xs text-white/60">
          {totalArchivos > 0 ? (
            <span>{totalArchivos} archivo(s) listo(s)</span>
          ) : (
            <span>Sin archivos aún</span>
          )}
        </div>
      </div>

      <div>
        <h1 className="text-2xl md:text-3xl font-semibold text-white">
          Especificaciones del pedido
        </h1>
        <p className="text-sm text-white/60 mt-1">
          Completa la información final y adjunta archivos si aplica.
        </p>
      </div>

      {/* Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-[1.2fr_0.8fr] gap-5">
        {/* Form */}
        <div className={`${card} p-5 space-y-5`}>
          {/* Título */}
          <div>
            <label className={label}>Título del pedido</label>

            <div className="flex items-stretch w-full rounded-xl overflow-hidden border border-white/10 bg-white/5">
              <span className="px-3 py-2 text-white/70 border-r border-white/10 select-none whitespace-nowrap">
                {prefijoTitulo || "GEN_PRJ0_"}
              </span>

              <input
                type="text"
                value={titulo}
                onChange={(e) => setTitulo(e.target.value)}
                className="flex-1 px-3 py-2 bg-transparent text-white outline-none"
                placeholder="Escribe la parte final. Evita usar /"
              />
            </div>

            <p className="text-xs text-white/50 mt-2">
              Se guardará como:{" "}
              <span className="text-white/80 font-semibold">
                {tituloFinalUnico || "..."}
              </span>
            </p>
          </div>

          {/* Explicación */}
          <div>
            <label className={label}>Explicación del pedido</label>
            <textarea
              rows={5}
              value={explicacion}
              onChange={(e) => setExplicacion(e.target.value)}
              className={input}
              placeholder="Describe el pedido (medidas, tolerancias, objetivo, etc.)"
            />
          </div>

          {/* Fecha */}
          <div>
            <label className={label}>Fecha propuesta</label>
            <input
              type="date"
              value={fecha}
              onChange={(e) => setFecha(e.target.value)}
              className={input}
            />
          </div>

          {/* Submit */}
          <button
            onClick={handleUploadAll}
            disabled={subiendo}
            className="w-full h-12 rounded-full bg-emerald-500/90 hover:bg-emerald-400 text-black font-semibold transition disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {subiendo ? "Subiendo..." : "Enviar pedido"}
          </button>

          <p className="text-xs text-white/40">
            Al enviar, se guardan los archivos en Storage dentro de una carpeta con el ID del pedido.
          </p>
        </div>

        {/* Attachments */}
        <div className={`${card} p-5 space-y-4`}>
          <div className="flex items-center justify-between">
            <h2 className="text-white font-semibold">Archivos y video</h2>
            <span className="text-xs text-white/50">
              {archivos.length} adjunto(s)
            </span>
          </div>

          <div className="flex flex-wrap gap-2">
            <button onClick={handleClickBoton} className={darkButton}>
              <FiUpload /> Seleccionar archivos
            </button>

            <button
              onClick={grabando ? detenerGrabacion : iniciarGrabacion}
              className={darkButton}
            >
              <FiVideo /> {grabando ? "Detener" : "Grabarme"}
            </button>

            {grabando && (
              <button onClick={togglePausa} className={warnButton}>
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
              className="w-full h-56 bg-black/60 rounded-xl border border-white/10"
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
            <div className="text-sm text-white/50 bg-white/5 border border-white/10 rounded-xl p-4">
              No has adjuntado archivos todavía.
            </div>
          ) : (
            <div className="space-y-2 max-h-[52vh] overflow-auto pr-1">
              {archivos.map((file) => (
                <div
                  key={file.name}
                  className="rounded-xl bg-white/5 border border-white/10 p-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-sm text-white font-medium truncate">
                        {file.name}
                      </div>
                      <div className="text-xs text-white/50">
                        {file.type || "archivo"} • {(file.size / 1024 / 1024).toFixed(2)} MB
                      </div>
                    </div>

                    <button
                      onClick={() => handleRemove(file.name)}
                      className="h-9 w-9 rounded-full bg-white/10 border border-white/10 hover:bg-white/20 transition flex items-center justify-center"
                      title="Quitar"
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
    </div>
  );
}
