"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  FiArrowLeft,
  FiUpload,
  FiCheck,
  FiSend,
  FiPlus,
  FiTrash2,
} from "react-icons/fi";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { db, storage } from "@/src/firebase/firebaseConfig";
import { useAuth } from "@/src/Context/AuthContext";

type UploadedFile = {
  nombre: string;
  url: string;
  tipo: string;
};

export default function FixturingPage() {
  const router = useRouter();
  const { user } = useAuth();

  const [proyecto, setProyecto] = useState("");
  const [servicio, setServicio] = useState("Fixture");

  const [titulo, setTitulo] = useState("");
  const [io, setIo] = useState("");

  const [problematica, setProblematica] = useState("");
  const [piezasProducto, setPiezasProducto] = useState("");

  const [alcance, setAlcance] = useState("");
  const [procesos, setProcesos] = useState<string[]>([]);

  const [cuartoLimpio, setCuartoLimpio] = useState(false);
  const [horno, setHorno] = useState(false);
  const [temperaturaMax, setTemperaturaMax] = useState("");
  const [rigidezDureza, setRigidezDureza] = useState(false);
  const [rigidezDetalle, setRigidezDetalle] = useState("");
  const [esterilizable, setEsterilizable] = useState(false);

  const [requiereEquipo, setRequiereEquipo] = useState(false);
  const [equipos, setEquipos] = useState<string[]>([""]);

  const [dimensionesCriticas, setDimensionesCriticas] = useState(false);
  const [referenciaDWG, setReferenciaDWG] = useState("");
  const [noTieneDimensiones, setNoTieneDimensiones] = useState(false);

  const [presupuestoPM, setPresupuestoPM] = useState(false);

  const [tiempoTrabajo, setTiempoTrabajo] = useState("");
  const [extra, setExtra] = useState("");
  const [criteriosExito, setCriteriosExito] = useState("");

  const [archivosVisuales, setArchivosVisuales] = useState<File[]>([]);
  const [archivosTecnicos, setArchivosTecnicos] = useState<File[]>([]);

  const [firmaPM, setFirmaPM] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setProyecto(localStorage.getItem("proyecto") || "");
    setServicio(localStorage.getItem("servicio") || "Fixture");
  }, []);

  const procesosOptions = [
    "Prueba",
    "Producción",
    "Inspección / Calidad",
    "Capacitación",
    "R&D",
    "Validación",
  ];

  const tiempoOptions = [
    "Menos de 1 semana",
    "Entre 1 y 2 semanas",
    "Menos de 1 mes",
    "Más de 1 mes",
  ];

  const tituloFinal = useMemo(() => {
    if (!io.trim()) return "";
    return `FXT. ${proyecto || "SIN PROYECTO"}. ${io.trim()}`;
  }, [io, proyecto]);

  const updateEquipo = (index: number, value: string) => {
    setEquipos((prev) =>
      prev.map((item, i) => (i === index ? value : item))
    );
  };

  const addEquipo = () => {
    setEquipos((prev) => [...prev, ""]);
  };

  const removeEquipo = (index: number) => {
    setEquipos((prev) => prev.filter((_, i) => i !== index));
  };

  const addFiles = (
    files: FileList | null,
    setter: React.Dispatch<React.SetStateAction<File[]>>
  ) => {
    if (!files) return;

    const incoming = Array.from(files);

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
  };

  const removeFile = (
    index: number,
    setter: React.Dispatch<React.SetStateAction<File[]>>
  ) => {
    setter((prev) => prev.filter((_, i) => i !== index));
  };


  const uploadFiles = async (
    files: File[],
    pedidoId: string,
    folder: string
  ): Promise<UploadedFile[]> => {
    const uploaded: UploadedFile[] = [];

    for (const file of files) {
      const safeName = file.name.replaceAll("/", "-");
      const fileRef = ref(
        storage,
        `pedidos/${pedidoId}/fixturing/${folder}/${Date.now()}-${safeName}`
      );

      await uploadBytes(fileRef, file);
      const url = await getDownloadURL(fileRef);

      uploaded.push({
        nombre: file.name,
        url,
        tipo: file.type,
      });
    }

    return uploaded;
  };

  const handleSubmit = async () => {
    if (!user) {
      alert("Debes iniciar sesión para enviar la solicitud.");
      return;
    }

    if (!io.trim()) {
      alert("Agrega el ID / referencia del fixture.");
      return;
    }

    if (!problematica.trim()) {
      alert("Describe la problemática que se quiere resolver.");
      return;
    }

    if (!piezasProducto.trim()) {
      alert("Completa las piezas o producto involucrado.");
      return;
    }

    if (!alcance.trim()) {
      alert("Describe el alcance del fixture.");
      return;
    }

    if (procesos.length === 0) {
      alert("Selecciona el proceso donde se usará.");
      return;
    }

    if (!tiempoTrabajo) {
      alert("Selecciona el tiempo para trabajar.");
      return;
    }

    if (!criteriosExito.trim()) {
      alert("Agrega los criterios de éxito.");
      return;
    }

    if (!firmaPM) {
      alert("Debes confirmar la firma del PM para enviar la solicitud.");
      return;
    }

    try {
      setLoading(true);

      const pedidoRef = await addDoc(collection(db, "pedidos"), {
        tipoPedido: "fixture",
        faseFixture: "proof_of_concept_solicitud",

        titulo: tituloFinal,
        tituloOriginal: titulo,
        io,

        proyecto,
        servicio,
        status: "en proceso",

        correoUsuario: user.email || "",
        uidUsuario: user.uid,
        nombreUsuario: user.displayName || "",

        timestamp: serverTimestamp(),
        fechaCreacion: serverTimestamp(),

        fixtureSolicitud: {
          necesidad: {
            problematica,
            piezasProducto,
          },
          alcance: {
            descripcion: alcance,
            procesos,
          },
          inputs: {
            cuartoLimpio,
            horno,
            temperaturaMax: horno ? temperaturaMax : "",
            rigidezDureza,
            rigidezDetalle: rigidezDureza ? rigidezDetalle : "",
            esterilizable,
            requiereEquipo,
            equipos: requiereEquipo
              ? equipos.map((e) => e.trim()).filter(Boolean)
              : [],
            dimensionesCriticas,
            referenciaDWG: dimensionesCriticas ? referenciaDWG : "",
            noTieneDimensiones,
            presupuestoPM,
            tiempoTrabajo,
            extra,
          },
          criteriosExito,
          firmaPM: {
            firmado: true,
            nombre: user.displayName || "",
            correo: user.email || "",
            fecha: new Date().toISOString(),
          },
        },
      });

      const visuales = await uploadFiles(
        archivosVisuales,
        pedidoRef.id,
        "explicacion-visual"
      );

      const tecnicos = await uploadFiles(
        archivosTecnicos,
        pedidoRef.id,
        "archivos-tecnicos"
      );

      await addDoc(collection(db, "pedidos", pedidoRef.id, "historialFixture"), {
        tipo: "solicitud_formal_creada",
        descripcion: "Se creó la solicitud formal de Proof of Concept.",
        creadoPor: user.email || "",
        createdAt: serverTimestamp(),
      });

      await addDoc(collection(db, "pedidos", pedidoRef.id, "archivosFixture"), {
        visuales,
        tecnicos,
        createdAt: serverTimestamp(),
      });

      localStorage.removeItem("servicio");
      localStorage.removeItem("maquina");
      localStorage.removeItem("material");
      localStorage.removeItem("tecnica");

      router.push("/solicitudes");
    } catch (error) {
      console.error(error);
      alert("Ocurrió un error al enviar la solicitud.");
    } finally {
      setLoading(false);
    }
  };

  const inputClass =
    "w-full rounded-xl border border-white/10 bg-white/10 px-4 py-3 text-white placeholder:text-white/35 outline-none focus:border-emerald-300/60";

  const labelClass = "text-sm font-medium text-white/80";
  const sectionClass =
    "rounded-3xl border border-white/10 bg-white/[0.06] p-5 md:p-6 shadow-[0_15px_45px_rgba(0,0,0,0.25)]";

  return (
    <div className="relative text-white">
      <div className="mx-auto w-full max-w-7xl px-4 py-8 md:px-8 lg:px-10">
        <button
          onClick={() => router.push("/hacer-pedido/servicios")}
          className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-4 py-2 text-white backdrop-blur transition hover:bg-white/20"
        >
          <FiArrowLeft /> Regresar
        </button>

        <div className="mb-8">
          <p className="text-sm uppercase tracking-[0.3em] text-emerald-300/80">
            Fixturing & Jigs
          </p>

          <h1 className="mt-2 text-3xl font-semibold md:text-4xl">
            Solicitud formal · Proof of Concept
          </h1>

          <p className="mt-3 max-w-3xl text-sm text-white/60">
            Completa la información mínima necesaria para documentar la necesidad,
            alcance e inputs técnicos del fixture antes de iniciar el concepto de
            diseño.
          </p>
        </div>

        <div className="mx-auto w-full max-w-6xl rounded-[2rem] border border-white/10 bg-white/[0.035] p-4 shadow-[0_25px_80px_rgba(0,0,0,0.35)] backdrop-blur md:p-6">
          <div className="grid gap-6">
            <section className={sectionClass}>
              <h2 className="mb-4 text-xl font-semibold text-white">
                Información general
              </h2>

              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className={labelClass}>Título del fixture</label>
                  <input
                    className={inputClass}
                    value={titulo}
                    onChange={(e) => setTitulo(e.target.value)}
                    placeholder="Fixture ensamble A..."
                  />
                </div>

                <div>
                  <label className={labelClass}>ID / Referencia</label>
                  <input
                    className={inputClass}
                    value={io}
                    onChange={(e) => setIo(e.target.value)}
                    placeholder="TS.006.01 Rev 1"
                  />
                </div>
              </div>

              {tituloFinal && (
                <div className="mt-4 rounded-2xl border border-emerald-300/20 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-100">
                  Se guardará como:{" "}
                  <span className="font-semibold">{tituloFinal}</span>
                </div>
              )}
            </section>

            <section className={sectionClass}>
              <h2 className="mb-4 text-xl font-semibold text-white">
                1. Necesidad
              </h2>

              <div className="grid gap-4">
                <div>
                  <label className={labelClass}>
                    Problemática que se quiere resolver
                  </label>
                  <textarea
                    className={`${inputClass} min-h-[120px]`}
                    value={problematica}
                    onChange={(e) => setProblematica(e.target.value)}
                    placeholder="¿Qué pasa actualmente sin el fixture?"
                  />
                </div>

                <div>
                  <label className={labelClass}>
                    Piezas o producto que se necesitan sujetar, alinear, cortar,
                    sellar, ensamblar, medir, etc.
                  </label>
                  <textarea
                    className={`${inputClass} min-h-[90px]`}
                    value={piezasProducto}
                    onChange={(e) => setPiezasProducto(e.target.value)}
                    placeholder="006.305 Foil pouch..."
                  />
                </div>
              </div>
            </section>

            <section className={sectionClass}>
              <h2 className="mb-4 text-xl font-semibold text-white">
                2. Alcance
              </h2>

              <div className="grid gap-4">
                <div>
                  <label className={labelClass}>Para qué sí se usará</label>
                  <textarea
                    className={`${inputClass} min-h-[100px]`}
                    value={alcance}
                    onChange={(e) => setAlcance(e.target.value)}
                    placeholder="Describe el uso esperado y los límites del fixture."
                  />
                </div>

                <div>
                  <label className={labelClass}>Proceso donde se usará</label>

                  <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {procesosOptions.map((p) => (
                      <button
                        key={p}
                        type="button"
                        onClick={() => setProcesos([p])}
                        className={`rounded-2xl border px-4 py-3 text-left text-sm transition ${
                          procesos.includes(p)
                            ? "border-emerald-300/50 bg-emerald-400/15 text-emerald-100"
                            : "border-white/10 bg-white/5 text-white/70 hover:bg-white/10"
                        }`}
                      >
                        {p}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </section>

            <section className={sectionClass}>
              <h2 className="mb-4 text-xl font-semibold text-white">
                3. Explicación visual
              </h2>

              <label className="flex cursor-pointer flex-col items-center justify-center rounded-3xl border border-dashed border-white/20 bg-white/5 px-6 py-8 text-center transition hover:bg-white/10">
                <FiUpload className="mb-3 text-2xl text-emerald-300" />
                <span className="font-medium">Adjuntar fotos o videos</span>
                <span className="mt-1 text-sm text-white/50">
                  Puedes seleccionar varios archivos
                </span>
                <input
                  type="file"
                  multiple
                  accept="image/*,video/*"
                  className="hidden"
                  onChange={(e) => {
                    addFiles(e.target.files, setArchivosVisuales);
                    e.target.value = "";
                        }}
                />
              </label>

             {archivosVisuales.length > 0 && (
  <div className="mt-4 space-y-2 text-sm text-white/70">
    {archivosVisuales.map((file, index) => (
      <div
        key={`${file.name}-${file.size}-${file.lastModified}`}
        className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/5 px-4 py-2"
      >
        <span className="min-w-0 truncate">{file.name}</span>

        <button
          type="button"
          onClick={() => removeFile(index, setArchivosVisuales)}
          className="shrink-0 rounded-lg border border-red-300/20 bg-red-400/10 px-3 py-2 text-red-200 transition hover:bg-red-400/20"
        >
          <FiTrash2 />
        </button>
      </div>
    ))}
  </div>
)}
            </section>

            <section className={sectionClass}>
              <h2 className="mb-4 text-xl font-semibold text-white">4. Inputs</h2>

              <div className="grid gap-4">
                <Checkbox
                  checked={cuartoLimpio}
                  onChange={setCuartoLimpio}
                  label="Cuarto limpio"
                />

                <Checkbox checked={horno} onChange={setHorno} label="Horno" />

                {horno && (
                  <input
                    className={inputClass}
                    value={temperaturaMax}
                    onChange={(e) => setTemperaturaMax(e.target.value)}
                    placeholder="Especifica temperatura máxima"
                  />
                )}

                <Checkbox
                  checked={rigidezDureza}
                  onChange={setRigidezDureza}
                  label="Rigidez / dureza"
                />

                {rigidezDureza && (
                  <input
                    className={inputClass}
                    value={rigidezDetalle}
                    onChange={(e) => setRigidezDetalle(e.target.value)}
                    placeholder="Especifica rigidez, dureza o comportamiento esperado"
                  />
                )}

                <Checkbox
                  checked={esterilizable}
                  onChange={setEsterilizable}
                  label="Esterilizable"
                />

                <Checkbox
                  checked={requiereEquipo}
                  onChange={setRequiereEquipo}
                  label="Especificar ID de equipos involucrados en el proceso"
                />

                {requiereEquipo && (
                  <div className="space-y-3">
                    {equipos.map((equipo, index) => (
                      <div key={index} className="flex gap-3">
                        <input
                          className={inputClass}
                          value={equipo}
                          onChange={(e) => updateEquipo(index, e.target.value)}
                          placeholder="B1-001 Lasermex"
                        />

                        {equipos.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeEquipo(index)}
                            className="shrink-0 rounded-xl border border-red-300/20 bg-red-400/10 px-4 text-red-200 transition hover:bg-red-400/20"
                          >
                            <FiTrash2 />
                          </button>
                        )}
                      </div>
                    ))}

                    <button
                      type="button"
                      onClick={addEquipo}
                      className="inline-flex items-center gap-2 rounded-full border border-emerald-300/20 bg-emerald-400/10 px-4 py-2 text-sm text-emerald-100 transition hover:bg-emerald-400/20"
                    >
                      <FiPlus /> Agregar otro equipo
                    </button>
                  </div>
                )}

                <Checkbox
                  checked={dimensionesCriticas}
                  onChange={setDimensionesCriticas}
                  label="Especificar dimensiones críticas"
                />

                {dimensionesCriticas && (
                  <input
                    className={inputClass}
                    value={referenciaDWG}
                    onChange={(e) => setReferenciaDWG(e.target.value)}
                    placeholder="Puedes hacer referencia a tus DWG"
                  />
                )}

                <Checkbox
                  checked={noTieneDimensiones}
                  onChange={setNoTieneDimensiones}
                  label="No tengo las dimensiones críticas"
                />

                <Checkbox
                  checked={presupuestoPM}
                  onChange={setPresupuestoPM}
                  label="Trabajar reportando presupuestos al PM"
                />

                <div>
                  <label className={labelClass}>Tiempo para trabajar</label>
                  <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    {tiempoOptions.map((t) => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setTiempoTrabajo(t)}
                        className={`rounded-2xl border px-4 py-3 text-sm transition ${
                          tiempoTrabajo === t
                            ? "border-emerald-300/50 bg-emerald-400/15 text-emerald-100"
                            : "border-white/10 bg-white/5 text-white/70 hover:bg-white/10"
                        }`}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                </div>

                <textarea
                  className={`${inputClass} min-h-[100px]`}
                  value={extra}
                  onChange={(e) => setExtra(e.target.value)}
                  placeholder="Especificar algo más..."
                />

                <label className="flex cursor-pointer flex-col items-center justify-center rounded-3xl border border-dashed border-white/20 bg-white/5 px-6 py-8 text-center transition hover:bg-white/10">
                  <FiUpload className="mb-3 text-2xl text-emerald-300" />
                  <span className="font-medium">Adjuntar CAD, DWG, PDF, etc.</span>
                  <span className="mt-1 text-sm text-white/50">
                    Archivos técnicos de referencia
                  </span>
                  <input
                    type="file"
                    multiple
                    className="hidden"
                    onChange={(e) => {
  addFiles(e.target.files, setArchivosTecnicos);
  e.target.value = "";
}}
                  />
                </label>

                {archivosTecnicos.length > 0 && (
  <div className="space-y-2 text-sm text-white/70">
    {archivosTecnicos.map((file, index) => (
      <div
        key={`${file.name}-${file.size}-${file.lastModified}`}
        className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/5 px-4 py-2"
      >
        <span className="min-w-0 truncate">{file.name}</span>

        <button
          type="button"
          onClick={() => removeFile(index, setArchivosTecnicos)}
          className="shrink-0 rounded-lg border border-red-300/20 bg-red-400/10 px-3 py-2 text-red-200 transition hover:bg-red-400/20"
        >
          <FiTrash2 />
        </button>
      </div>
    ))}
  </div>
)}
              </div>
            </section>

            <section className={sectionClass}>
              <h2 className="mb-4 text-xl font-semibold text-white">
                5. Criterios de éxito
              </h2>

              <textarea
                className={`${inputClass} min-h-[130px]`}
                value={criteriosExito}
                onChange={(e) => setCriteriosExito(e.target.value)}
                placeholder='Ejemplo: "La pieza no se mueve", "reduce el tiempo de ensamble", "mantiene la alineación"...'
              />
            </section>

            <section className={sectionClass}>
              <h2 className="mb-4 text-xl font-semibold text-white">
                Firma del PM
              </h2>

              <Checkbox
                checked={firmaPM}
                onChange={setFirmaPM}
                label="Confirmo que esta solicitud fue revisada y aprobada para iniciar concepto de diseño."
              />

              {firmaPM && (
                <div className="mt-4 rounded-2xl border border-emerald-300/20 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-100">
                  Firma asociada a la cuenta: {user?.email}
                </div>
              )}
            </section>

            <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
              <button
                onClick={() => router.push("/hacer-pedido/servicios")}
                className="rounded-full border border-white/10 bg-white/10 px-6 py-3 text-white transition hover:bg-white/20"
              >
                Regresar
              </button>

              <button
                onClick={handleSubmit}
                disabled={loading}
                className="inline-flex items-center justify-center gap-2 rounded-full bg-emerald-400 px-6 py-3 font-semibold text-black transition hover:bg-emerald-300 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? (
                  "Enviando..."
                ) : (
                  <>
                    <FiSend /> Solicitar diseño
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Checkbox({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className="flex items-center gap-3 text-left"
    >
      <span
        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition ${
          checked
            ? "border-emerald-300 bg-emerald-400 text-black"
            : "border-white/20 bg-white/5 text-transparent"
        }`}
      >
        <FiCheck size={14} />
      </span>
      <span className="text-sm text-white/75">{label}</span>
    </button>
  );
}