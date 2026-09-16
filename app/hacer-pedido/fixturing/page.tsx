"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  FiUpload,
  FiCheck,
  FiSend,
  FiPlus,
  FiTrash2,
} from "react-icons/fi";
import { addDoc, collection, serverTimestamp, Timestamp} from "firebase/firestore";
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
  const [fechaLimiteEntrega, setFechaLimiteEntrega] = useState("");
  const [extra, setExtra] = useState("");
  const [criteriosExito, setCriteriosExito] = useState("");

  const [archivosVisuales, setArchivosVisuales] = useState<File[]>([]);
  const [archivosTecnicos, setArchivosTecnicos] = useState<File[]>([]);

  
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setProyecto(localStorage.getItem("proyecto") || "");
    setServicio(localStorage.getItem("servicio") || "Fixture");
  }, []);

  const procesosOptions = [
    
    "Producción",
    "Inspección / Calidad",
    "Capacitación",
    "R&D",
    "V&V",
  ];

  const tiempoOptions = [
    "Menos de 1 semana",
    "Entre 1 y 2 semanas",
    "Menos de 1 mes",
    "Más de 1 mes",
  ];

  const tituloFinal = useMemo(() => {
    if (!titulo.trim()) return "";
    return `FXT. ${proyecto || "SIN PROYECTO"}. ${titulo.trim()}`;
  }, [titulo, proyecto]);

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

    if (!fechaLimiteEntrega) {
  alert("Selecciona la fecha límite de entrega.");
  return;
}

    if (!criteriosExito.trim()) {
      alert("Agrega los criterios de éxito.");
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
             fechaLimiteEntrega: Timestamp.fromDate(
    new Date(`${fechaLimiteEntrega}T12:00:00`)
  ),
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

/*
 * Crear en Monday el grupo completo
 * del fixture, sus fases y subactividades.
 *
 * El pedido ya está guardado en Firebase,
 * por lo que un fallo de Monday no elimina
 * ni invalida la solicitud.
 */
try {
  const idToken =
    await user.getIdToken();

  const mondayResponse = await fetch(
    "/api/monday/fixturing/create",
    {
      method: "POST",
      headers: {
        "Content-Type":
          "application/json",
        Authorization:
          `Bearer ${idToken}`,
      },
      body: JSON.stringify({
        pedidoId: pedidoRef.id,
      }),
    }
  );

  const mondayResult =
    await mondayResponse
      .json()
      .catch(() => null);

  if (!mondayResponse.ok) {
    console.error(
      "El fixture se guardó, pero Monday no se sincronizó:",
      mondayResult
    );

    alert(
      [
        "La solicitud de fixture se guardó correctamente, pero no se pudo crear su estructura en Monday.",
        mondayResult?.error
          ? `\n\nDetalle:\n${mondayResult.error}`
          : "",
      ].join("")
    );
  } else if (
    !mondayResult?.mondayUserFound
  ) {
    alert(
      "La estructura del fixture se creó en Monday, pero no se encontró una cuenta de Monday con el correo del solicitante. Las actividades se crearon sin Stakeholder."
    );
  }
} catch (mondayError) {
  console.error(
    "Error llamando al endpoint de Monday:",
    mondayError
  );

  alert(
    "La solicitud de fixture se guardó correctamente, pero ocurrió un error al comunicarse con Monday."
  );
}


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
    "mt-2 min-h-12 w-full rounded-xl border border-white/10 bg-white/[0.05] px-3.5 py-3 text-base text-white outline-none placeholder:text-white/35 transition focus:border-emerald-300/35 focus:ring-2 focus:ring-emerald-400/20 sm:min-h-11 sm:px-4 sm:text-sm";

  const labelClass = "block text-sm font-medium leading-snug text-white/75";
  const sectionClass =
    "rounded-2xl border border-white/10 bg-white/[0.035] p-4 shadow-[0_12px_35px_rgba(0,0,0,0.18)] backdrop-blur-sm sm:p-6";

  return (
    <div className="mx-auto w-full max-w-6xl px-3 py-4 text-white sm:px-6 sm:py-8">
      <div className="mb-5 sm:mb-7">
        <button
          type="button"
          onClick={() => router.push("/hacer-pedido/servicios")}
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.05] px-3.5 text-sm font-medium text-white/80 transition hover:bg-white/10 hover:text-white sm:min-h-10 sm:rounded-full sm:px-4"
        >
          <span aria-hidden="true">←</span>
          Regresar
        </button>

        <p className="mt-5 text-[11px] font-semibold uppercase tracking-[0.2em] text-emerald-300/75 sm:text-xs">
          Fixturing & Jigs
        </p>

        <h1 className="mt-1.5 text-2xl font-semibold leading-tight text-white sm:text-3xl">
          Solicitud formal · Proof of Concept
        </h1>

        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-white/55">
          Documenta la necesidad, el alcance y los requisitos técnicos antes de
          iniciar el concepto de diseño.
        </p>
      </div>

      <div className="grid gap-4 sm:gap-6">
            <section className={sectionClass}>
              <h2 className="mb-4 text-xl font-semibold text-white">
                Información general
              </h2>

              <div className="grid gap-4 sm:grid-cols-2">
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
                    className={`${inputClass} min-h-[120px] resize-y sm:min-h-[130px]`}
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
                    className={`${inputClass} min-h-[110px] resize-y`}
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
                    className={`${inputClass} min-h-[110px] resize-y`}
                    value={alcance}
                    onChange={(e) => setAlcance(e.target.value)}
                    placeholder="Describe el uso esperado y los límites del fixture."
                  />
                </div>

                <div>
                  <label className={labelClass}>Proceso donde se usará</label>

                  <div className="mt-3 grid grid-cols-1 gap-2.5 min-[420px]:grid-cols-2 lg:grid-cols-3">
                    {procesosOptions.map((p) => (
                      <button
                        key={p}
                        type="button"
                        onClick={() => setProcesos([p])}
                        className={`min-h-12 rounded-xl border px-4 py-3 text-left text-sm font-medium transition ${
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

              <label className="flex min-h-36 cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-white/20 bg-white/[0.035] px-4 py-6 text-center transition hover:border-emerald-300/30 hover:bg-white/[0.06] sm:px-6 sm:py-8">
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
        className="flex min-h-12 items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.04] px-3.5 py-2.5 sm:px-4"
      >
        <span className="min-w-0 truncate">{file.name}</span>

        <button
          type="button"
          onClick={() => removeFile(index, setArchivosVisuales)}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-red-300/20 bg-red-400/10 text-red-200 transition hover:bg-red-400/20"
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
                  <div className="mt-3 grid grid-cols-1 gap-2.5 min-[420px]:grid-cols-2 lg:grid-cols-4">
                    {tiempoOptions.map((t) => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setTiempoTrabajo(t)}
                        className={`min-h-12 rounded-xl border px-4 py-3 text-sm font-medium transition ${
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
                    <div>
  <label className={labelClass}>Fecha límite de entrega</label>

  <input
    type="date"
    className={`${inputClass} mt-3`}
    value={fechaLimiteEntrega}
    onChange={(e) => setFechaLimiteEntrega(e.target.value)}
    min={new Date().toISOString().split("T")[0]}
  />

  <p className="mt-2 text-xs text-white/50">
    Selecciona la fecha en la que el fixture debe estar terminado.
  </p>
</div>
                <textarea
                  className={`${inputClass} min-h-[110px] resize-y`}
                  value={extra}
                  onChange={(e) => setExtra(e.target.value)}
                  placeholder="Especificar algo más..."
                />

                <label className="flex min-h-36 cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-white/20 bg-white/[0.035] px-4 py-6 text-center transition hover:border-emerald-300/30 hover:bg-white/[0.06] sm:px-6 sm:py-8">
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
        className="flex min-h-12 items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.04] px-3.5 py-2.5 sm:px-4"
      >
        <span className="min-w-0 truncate">{file.name}</span>

        <button
          type="button"
          onClick={() => removeFile(index, setArchivosTecnicos)}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-red-300/20 bg-red-400/10 text-red-200 transition hover:bg-red-400/20"
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
                className={`${inputClass} min-h-[140px] resize-y`}
                value={criteriosExito}
                onChange={(e) => setCriteriosExito(e.target.value)}
                placeholder='Ejemplo: "La pieza no se mueve", "reduce el tiempo de ensamble", "mantiene la alineación"...'
              />
            </section>


        <div className="flex flex-col-reverse gap-3 pt-1 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={() => router.push("/hacer-pedido/servicios")}
            className="min-h-12 rounded-xl border border-white/10 bg-white/[0.05] px-6 py-3 font-medium text-white/80 transition hover:bg-white/10 hover:text-white sm:min-h-11 sm:rounded-full"
          >
            Regresar
          </button>

          <button
            type="button"
            onClick={handleSubmit}
            disabled={loading}
            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-emerald-400 px-6 py-3 font-semibold text-black transition hover:bg-emerald-300 disabled:cursor-not-allowed disabled:opacity-60 sm:min-h-11 sm:rounded-full"
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
      className="flex min-h-12 w-full items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] px-3.5 py-3 text-left transition hover:bg-white/[0.06] active:bg-white/[0.08] sm:px-4"
    >
      <span
        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition ${
          checked
            ? "border-emerald-300 bg-emerald-400 text-black"
            : "border-white/20 bg-black/10 text-transparent"
        }`}
      >
        <FiCheck size={14} />
      </span>
      <span className="text-sm font-medium leading-snug text-white/75">{label}</span>
    </button>
  );
}