"use client";

import { useState, useRef, useEffect } from "react";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { auth, db, storage } from "@/src/firebase/firebaseConfig";
import { useRouter } from "next/navigation";
import { FiX, FiUpload, FiVideo } from "react-icons/fi";

export default function EspecificacionesPage() {
  // Sufijo editable por el usuario (lo que va DESPUÉS del prefijo no editable)
  const [titulo, setTitulo] = useState("");
  const [prefijoTitulo, setPrefijoTitulo] = useState<string>(""); // p. ej. "FL3B_AB12_"

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

  // ---------- Helpers: normalizar texto y resolver abreviación ----------
  const normalize = (s: string) =>
    (s || "")
      .toString()
      .trim()
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, ""); // quita acentos

  const ABBR_MAP: Record<string, string> = {
    "pla 2.85mm": "UMKR",
    "pla 1.75mm": "BML",
    "Nylon retardante de fuego 1.75 (Bambu Lab)": "BML",
    "resina formlabs 3b": "FL3B",
    "resina formlabs 2b": "FL2B",
    "laser co2": "Láser",
    "fresadora cnc": "CNC",
    "necesidad": "Need",
    "libre": "FXT",
  };

  function resolveAbbrFromValue(value: string | null): string | null {
    if (!value) return null;
    const key = normalize(value);
    // claves tal cual
    if (ABBR_MAP[key]) return ABBR_MAP[key];

    // intentos suaves con "incluye"
    if (key.includes("2.85") && key.includes("pla")) return "UMKR";
    if (key.includes("1.75") && key.includes("pla")) return "BML";
    if (key.includes("1.75") && key.includes("Nylon")) return "BML";
    if (key.includes("formlabs") && key.includes("3b")) return "FL3B";
    if (key.includes("formlabs") && key.includes("2b")) return "FL2B";
    if (key.includes("laser") || key.includes("lazer") || key.includes("láser")) return "Láser";
    if (key.includes("cnc")) return "CNC";
    if (key.includes("necesidad") || key === "need") return "Need";
    if (key.includes("libre") || key.includes("fixture") || key === "fxt") return "FXT";

    return null;
  }

  function getProyectoCode(raw: string | null): string {
    const clean = (raw || "")
      .toString()
      .replace(/[^A-Za-z0-9]/g, "") // solo alfanumérico
      .toUpperCase()
      .slice(0, 4);
    return clean || "PRJ0";
  }

  function computePrefijo(): string {
    // Leemos posibles selecciones guardadas en pasos previos
     const servicio = localStorage.getItem("servicio");
    const tecnica = localStorage.getItem("tecnica");
    const material = localStorage.getItem("material");
    const maquina = localStorage.getItem("maquina"); // por si acaso existiera

const sNorm = normalize(servicio || "");
if (sNorm.includes("necesidad") || sNorm === "need") {
  const proyecto = localStorage.getItem("proyecto");
  const code = getProyectoCode(proyecto);
  return `Need_${code}_`; // retorna aquí dentro de computePrefijo()
}

    // Prioridad: técnica > material > servicio > máquina
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

  // Calcular el prefijo al montar (y cuando cambien dependencias observables)
  useEffect(() => {
    setPrefijoTitulo(computePrefijo());
    // Nota: si en esta misma página cambiases tecnica/material/servicio en localStorage
    // y quisieras recomputar dinámicamente, podrías escuchar a "storage" o agregar controles aquí.
  }, []);

  // -------------------- Archivos y video --------------------
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

  // -------------------- Upload / Guardado --------------------
 const handleUploadAll = async () => {
  if (!titulo) return alert("Agrega la parte final del título del pedido.");
  if (!fecha) return alert("Selecciona una fecha de entrega.");

  // 🔁 Recalcular el prefijo para evitar usar uno viejo
  const prefijo = computePrefijo();
  setPrefijoTitulo(prefijo); // opcional: refleja el cambio en la UI

  const tituloFinal = `${prefijo}${titulo}`;

  // 🧹 Sanitizar para usarlo como carpeta en Storage
  const carpetaTitulo = tituloFinal.replace(/[\/\\#?]/g, "-");

  setSubiendo(true);


    try {
      const proyecto = localStorage.getItem("proyecto") || "Sin proyecto";
      const servicio = localStorage.getItem("servicio") || "Sin servicio";
      const maquina = localStorage.getItem("maquina") || "Sin máquina";
      const material = localStorage.getItem("material") || "Sin material";
      const usuario = auth.currentUser?.email || "desconocido";

      const archivosSubidos: string[] = [];

      for (const archivo of archivos) {
        const archivoRef = ref(storage, `pedidos/${carpetaTitulo}/${archivo.name}`);
        await uploadBytes(archivoRef, archivo);
        const url = await getDownloadURL(archivoRef);
        archivosSubidos.push(url);
      }

      let urlDelVideo = "";
      if (videoFile) {
        const videoStorageRef = ref(storage, `pedidos/${carpetaTitulo}/${videoFile.name}`);
        await uploadBytes(videoStorageRef, videoFile);
        urlDelVideo = await getDownloadURL(videoStorageRef);
        if (!archivos.includes(videoFile)) archivosSubidos.push(urlDelVideo);
      }

      await addDoc(collection(db, "pedidos"), {
        titulo: tituloFinal, // Prefijo + Sufijo
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
    const mediaStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    const recorder = new MediaRecorder(mediaStream);
    const chunks: Blob[] = [];

    recorder.ondataavailable = (e) => chunks.push(e.data);
    recorder.onstop = () => {
      const blob = new Blob(chunks, { type: "video/mp4" });
      const archivo = new File([blob], `grabacion-${Date.now()}.mp4`, { type: "video/mp4" });
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
      videoRef.current.play().catch((err) => console.warn("Video no pudo reproducirse:", err));
    }
  }, [stream]);

  return (
    <div className="max-w-2xl mx-auto p-4 space-y-4">
      <button className="bg-white text-black px-4 py-2 rounded" onClick={() => router.back()}>
        ← Regresar
      </button>

      <h1 className="text-xl font-bold text-center text-white">Especificaciones del pedido</h1>

      <div className="bg-white p-4 rounded-xl shadow space-y-4">
        {/* TÍTULO COMPUESTO: Prefijo fijo + Sufijo editable */}
        <div>
          <label className="block font-medium text-black mb-1">Título del pedido</label>
          <div className="flex items-stretch w-full border border-gray-300 rounded overflow-hidden">
            <span
              className="px-3 py-2 bg-gray-100 text-gray-700 border-r border-gray-300 select-none whitespace-nowrap"
              title="Prefijo automático (no editable)"
            >
              {prefijoTitulo || "GEN_PRJ0_"}
            </span>
            <input
              type="text"
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              className="flex-1 px-3 py-2 text-black outline-none"
              placeholder="Escribe aquí la parte final del título. Evita usar diagonales (/)"
            />
          </div>
          <p className="text-xs text-gray-500 mt-1">
            Se guardará como: <strong>{(prefijoTitulo || "GEN_PRJ0_") + (titulo || "…")}</strong>
          </p>
        </div>

        <div>
          <label className="block font-medium text-black mb-1">Explicación del pedido</label>
          <textarea
            rows={4}
            value={explicacion}
            onChange={(e) => setExplicacion(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded text-black"
            placeholder="Describe el pedido, su función, puntos críticos..."
          />
        </div>

        <div>
          <label className="block font-medium text-black mb-1">Fecha Propuesta</label>
          <input
            type="date"
            value={fecha}
            onChange={(e) => setFecha(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded text-black"
          />
        </div>

        <div>
          <label className="block font-medium text-black mb-1">Adjuntar archivos</label>

          <div className="flex gap-2 mb-2">
            <button
              onClick={handleClickBoton}
              className="bg-black text-white px-4 py-2 rounded hover:bg-gray-800 flex items-center gap-2"
            >
              <FiUpload /> Seleccionar archivos
            </button>

            <button
              onClick={grabando ? detenerGrabacion : iniciarGrabacion}
              className="bg-black text-white px-4 py-2 rounded hover:bg-gray-800 flex items-center gap-2"
            >
              <FiVideo /> {grabando ? "Detener grabación" : "Grabarme"}
            </button>

            {grabando && (
              <button
                onClick={togglePausa}
                className="bg-yellow-500 text-white px-4 py-2 rounded hover:bg-yellow-600"
              >
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
              className="w-full h-64 bg-black mb-4 rounded"
            />
          )}

          {archivos.length > 0 && (
            <ul className="space-y-2">
              {archivos.map((file) => (
                <li
                  key={file.name}
                  className="flex flex-col bg-gray-100 px-3 py-2 rounded text-black"
                >
                  <div className="flex justify-between items-center">
                    <span className="truncate">{file.name}</span>
                    <button
                      onClick={() => handleRemove(file.name)}
                      className="text-red-600 hover:text-red-800"
                    >
                      <FiX />
                    </button>
                  </div>
                  {file.type.startsWith("video") && (
                    <video controls src={URL.createObjectURL(file)} className="mt-2 rounded" />
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>

        <input
          ref={fileInputRef}
          type="file"
          multiple
          onChange={handleSelectFiles}
          className="hidden"
        />

        <button
          onClick={handleUploadAll}
          disabled={subiendo}
          className="w-full bg-green-600 text-white py-3 rounded hover:bg-green-700 transition"
        >
          {subiendo ? "Subiendo..." : "Enviar pedido"}
        </button>
      </div>
    </div>
  );
}