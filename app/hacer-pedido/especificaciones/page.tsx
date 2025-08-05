"use client";

import { useState, useRef, useEffect } from "react";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { auth, db, storage } from "@/src/firebase/firebaseConfig";
import { useRouter } from "next/navigation";
import { FiX, FiUpload, FiVideo } from "react-icons/fi";

export default function EspecificacionesPage() {
  const [titulo, setTitulo] = useState("");
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

  const handleUploadAll = async () => {
    if (!titulo) return alert("Agrega un título para el pedido.");
    if (!fecha) return alert("Selecciona una fecha de entrega.");
    setSubiendo(true);

    try {
      const proyecto = localStorage.getItem("proyecto") || "Sin proyecto";
      const servicio = localStorage.getItem("servicio") || "Sin servicio";
      const maquina = localStorage.getItem("maquina") || "Sin máquina";
      const material = localStorage.getItem("material") || "Sin material";
      const usuario = auth.currentUser?.email || "desconocido";

      const archivosSubidos: string[] = [];

      for (const archivo of archivos) {
        const archivoRef = ref(storage, `pedidos/${titulo}/${archivo.name}`);
        await uploadBytes(archivoRef, archivo);
        const url = await getDownloadURL(archivoRef);
        archivosSubidos.push(url);
      }

      let urlDelVideo = "";
      if (videoFile) {
        const videoStorageRef = ref(storage, `pedidos/${titulo}/${videoFile.name}`);
        await uploadBytes(videoStorageRef, videoFile);
        urlDelVideo = await getDownloadURL(videoStorageRef);
        if (!archivos.includes(videoFile)) archivosSubidos.push(urlDelVideo);
      }

      await addDoc(collection(db, "pedidos"), {
        titulo,
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
      });

      alert("✅ Pedido enviado con éxito");
      router.push("/");
    } catch (err: any) {
      console.error(err);
      alert(`Error: ${err.message || err}`);
    }

    setSubiendo(false);
  };

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
        <div>
          <label className="block font-medium text-black mb-1">Título del pedido</label>
          <input
            type="text"
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded text-black"
          />
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
          <label className="block font-medium text-black mb-1">Fecha límite de entrega</label>
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
                    <video
                      controls
                      src={URL.createObjectURL(file)}
                      className="mt-2 rounded"
                    />
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
