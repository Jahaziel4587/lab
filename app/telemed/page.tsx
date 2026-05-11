"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  addDoc,
  collection,
  doc,
  getDocs,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { db, storage } from "@/src/firebase/firebaseConfig";

type Rol = "paciente" | "centro" | "doctor";

type Persona = {
  nombre: string;
  matricula: string;
};

type Centro = {
  id: string;
  nombre: string;
  nombreKey: string;
  claveAcceso: string;
  encargados: Persona[];
  doctores: Persona[];
};

type Paciente = {
  id: string;
  nombre: string;
  matricula: string;
  centroId: string;
  centroNombre: string;
};

type Estudio = {
  id: string;
  pacienteId: string;
  pacienteNombre: string;
  pacienteMatricula: string;
  centroId: string;
  centroNombre: string;
  doctorNombre: string;
  doctorMatricula: string;
  nombreEstudio: string;
  archivoURL: string;
  archivoNombre: string;
  diagnostico?: string;
  fechaLimiteDiagnostico: string;
  citaSolicitada?: boolean;
  citaHorario?: string;
};

function normalizarClave(texto: string) {
  return texto
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, "")
    .toUpperCase();
}

export default function TelemedPage() {
  const [rol, setRol] = useState<Rol>("paciente");
  const [pantalla, setPantalla] = useState<"login" | "registro" | "panel">(
    "login"
  );

  const [centros, setCentros] = useState<Centro[]>([]);
  const [pacientes, setPacientes] = useState<Paciente[]>([]);
  const [estudios, setEstudios] = useState<Estudio[]>([]);

  const [sesion, setSesion] = useState<any>(null);

  const [centroId, setCentroId] = useState("");
  const [nombre, setNombre] = useState("");
  const [matricula, setMatricula] = useState("");
  const [clave, setClave] = useState("");

  const [centroNombreRegistro, setCentroNombreRegistro] = useState("");

  const [encargadosRegistro, setEncargadosRegistro] = useState<Persona[]>([
    { nombre: "", matricula: "" },
  ]);

  const [doctoresRegistro, setDoctoresRegistro] = useState<Persona[]>([
    { nombre: "", matricula: "" },
  ]);

  const [mostrarAdminPersonal, setMostrarAdminPersonal] = useState(false);

  const [busquedaPaciente, setBusquedaPaciente] = useState("");
  const [pacienteSeleccionado, setPacienteSeleccionado] =
    useState<Paciente | null>(null);

  const [nombreEstudio, setNombreEstudio] = useState("");
  const [doctorAsignado, setDoctorAsignado] = useState("");
  const [fechaLimite, setFechaLimite] = useState("");
  const [archivo, setArchivo] = useState<File | null>(null);
  const [subiendo, setSubiendo] = useState(false);

  const [estudioAbierto, setEstudioAbierto] = useState<Estudio | null>(null);
  const [diagnostico, setDiagnostico] = useState("");
  const [horarioCita, setHorarioCita] = useState("");

  const cargarDatos = async () => {
    const centrosSnap = await getDocs(collection(db, "telemed_centros"));
    const pacientesSnap = await getDocs(collection(db, "telemed_pacientes"));
    const estudiosSnap = await getDocs(collection(db, "telemed_estudios"));

    setCentros(
      centrosSnap.docs.map((d) => ({
        id: d.id,
        ...(d.data() as Omit<Centro, "id">),
      }))
    );

    setPacientes(
      pacientesSnap.docs.map((d) => ({
        id: d.id,
        ...(d.data() as Omit<Paciente, "id">),
      }))
    );

    setEstudios(
      estudiosSnap.docs.map((d) => ({
        id: d.id,
        ...(d.data() as Omit<Estudio, "id">),
      }))
    );
  };

  useEffect(() => {
    cargarDatos();
  }, []);

  const centroSeleccionado = centros.find((c) => c.id === centroId);

  const cerrarSesion = () => {
    setSesion(null);
    setPantalla("login");
    setEstudioAbierto(null);
    setPacienteSeleccionado(null);
    setNombre("");
    setMatricula("");
    setClave("");
    setMostrarAdminPersonal(false);
  };

  const iniciarSesion = async () => {
    if (!centroId) {
      alert("Selecciona un hospital o clínica.");
      return;
    }

    if (rol === "paciente") {
      const paciente = pacientes.find(
        (p) =>
          p.centroId === centroId &&
          p.nombre.trim().toLowerCase() === nombre.trim().toLowerCase() &&
          p.matricula.trim() === matricula.trim()
      );

      if (!paciente) {
        alert("Paciente no registrado. Completa el registro.");
        setPantalla("registro");
        return;
      }

      setSesion({ rol, ...paciente });
      setPantalla("panel");
      return;
    }

    if (rol === "centro") {
      const centro = centros.find((c) => c.id === centroId);

      if (!centro) {
        alert("La clínica/hospital no está registrada.");
        setPantalla("registro");
        return;
      }

      const encargadoValido = centro.encargados?.some(
        (e) =>
          e.nombre.trim().toLowerCase() === nombre.trim().toLowerCase() &&
          e.matricula.trim() === matricula.trim()
      );

      if (!encargadoValido || clave !== centro.claveAcceso) {
        alert("Datos incorrectos o encargado no registrado.");
        return;
      }

      setSesion({
        rol,
        centroId: centro.id,
        centroNombre: centro.nombre,
      });

      setPantalla("panel");
      return;
    }

    if (rol === "doctor") {
      const centro = centros.find((c) => c.id === centroId);

      const doctorValido = centro?.doctores?.some(
        (d) =>
          d.nombre.trim().toLowerCase() === nombre.trim().toLowerCase() &&
          d.matricula.trim() === matricula.trim()
      );

      if (!doctorValido) {
        alert("Doctor no registrado por esta clínica/hospital.");
        return;
      }

      setSesion({
        rol,
        nombre,
        matricula,
        centroId: centro?.id,
        centroNombre: centro?.nombre,
      });

      setPantalla("panel");
    }
  };

  const registrarPaciente = async () => {
    if (!nombre || !matricula || !centroId) {
      alert("Completa todos los campos.");
      return;
    }

    await addDoc(collection(db, "telemed_pacientes"), {
      nombre,
      matricula,
      centroId,
      centroNombre: centroSeleccionado?.nombre || "",
      createdAt: serverTimestamp(),
    });

    alert("Paciente registrado. Ahora puedes iniciar sesión.");
    setPantalla("login");
    await cargarDatos();
  };

  const actualizarPersonaRegistro = (
    tipo: "encargado" | "doctor",
    index: number,
    campo: "nombre" | "matricula",
    valor: string
  ) => {
    if (tipo === "encargado") {
      const copia = [...encargadosRegistro];
      copia[index][campo] = valor;
      setEncargadosRegistro(copia);
    } else {
      const copia = [...doctoresRegistro];
      copia[index][campo] = valor;
      setDoctoresRegistro(copia);
    }
  };

  const agregarPersonaRegistro = (tipo: "encargado" | "doctor") => {
    if (tipo === "encargado") {
      setEncargadosRegistro([
        ...encargadosRegistro,
        { nombre: "", matricula: "" },
      ]);
    } else {
      setDoctoresRegistro([
        ...doctoresRegistro,
        { nombre: "", matricula: "" },
      ]);
    }
  };

  const eliminarPersonaRegistro = (
    tipo: "encargado" | "doctor",
    index: number
  ) => {
    if (tipo === "encargado") {
      if (encargadosRegistro.length === 1) return;
      setEncargadosRegistro(encargadosRegistro.filter((_, i) => i !== index));
    } else {
      if (doctoresRegistro.length === 1) return;
      setDoctoresRegistro(doctoresRegistro.filter((_, i) => i !== index));
    }
  };

  const registrarCentro = async () => {
    const encargadosValidos = encargadosRegistro.filter(
      (e) => e.nombre.trim() && e.matricula.trim()
    );

    const doctoresValidos = doctoresRegistro.filter(
      (d) => d.nombre.trim() && d.matricula.trim()
    );

    if (
      !centroNombreRegistro ||
      encargadosValidos.length === 0 ||
      doctoresValidos.length === 0
    ) {
      alert(
        "Agrega el nombre del centro, al menos un encargado y al menos un doctor."
      );
      return;
    }

    const key = normalizarClave(centroNombreRegistro);

    await addDoc(collection(db, "telemed_centros"), {
      nombre: centroNombreRegistro,
      nombreKey: key,
      claveAcceso: key,
      encargados: encargadosValidos,
      doctores: doctoresValidos,
      createdAt: serverTimestamp(),
    });

    alert(`Centro registrado. Clave de acceso: ${key}`);

    setCentroNombreRegistro("");
    setEncargadosRegistro([{ nombre: "", matricula: "" }]);
    setDoctoresRegistro([{ nombre: "", matricula: "" }]);

    setPantalla("login");
    await cargarDatos();
  };

  const actualizarPersonalCentro = async (
    tipo: "encargados" | "doctores",
    nuevaLista: Persona[]
  ) => {
    if (!sesion?.centroId) return;

    await updateDoc(doc(db, "telemed_centros", sesion.centroId), {
      [tipo]: nuevaLista,
    });

    await cargarDatos();
    alert("Personal actualizado correctamente.");
  };
const fileInputRef = useRef<HTMLInputElement | null>(null);
  const pacientesFiltrados = useMemo(() => {
    if (!sesion || sesion.rol !== "centro") return [];

    return pacientes
      .filter((p) => p.centroId === sesion.centroId)
      .filter((p) => {
        const term = busquedaPaciente.toLowerCase();
        return (
          p.nombre.toLowerCase().includes(term) ||
          p.matricula.toLowerCase().includes(term)
        );
      })
      .sort((a, b) => a.nombre.localeCompare(b.nombre));
  }, [pacientes, sesion, busquedaPaciente]);

  const estudiosPaciente = estudios.filter((e) => {
    if (sesion?.rol === "paciente") return e.pacienteId === sesion.id;
    if (pacienteSeleccionado) return e.pacienteId === pacienteSeleccionado.id;
    return false;
  });

  const estudiosDoctor = estudios.filter(
    (e) =>
      e.centroId === sesion?.centroId &&
      e.doctorMatricula === sesion?.matricula
  );

const subirEstudio = async () => {
  if (!pacienteSeleccionado || !archivo || !nombreEstudio || !doctorAsignado || !fechaLimite) {
    alert("Completa todos los campos y selecciona un archivo.");
    return;
  }

  const [doctorNombre, doctorMatricula] = doctorAsignado.split("|||");

  try {
    setSubiendo(true);

    const nombreSeguro = archivo.name.replace(/\s+/g, "_");
    const nombreStorage = `${Date.now()}-${nombreSeguro}`;
    const storageRef = ref(storage, `telemed/${nombreStorage}`);

    await uploadBytes(storageRef, archivo);
    const url = await getDownloadURL(storageRef);

    await addDoc(collection(db, "telemed_estudios"), {
      pacienteId: pacienteSeleccionado.id,
      pacienteNombre: pacienteSeleccionado.nombre,
      pacienteMatricula: pacienteSeleccionado.matricula,
      centroId: sesion.centroId,
      centroNombre: sesion.centroNombre,
      doctorNombre,
      doctorMatricula,
      nombreEstudio,
      archivoURL: url,
      archivoNombre: archivo.name,
      diagnostico: "",
      fechaLimiteDiagnostico: fechaLimite,
      citaSolicitada: false,
      citaHorario: "",
      createdAt: serverTimestamp(),
    });

    alert("Estudio agregado correctamente.");

    setNombreEstudio("");
    setDoctorAsignado("");
    setFechaLimite("");
    setArchivo(null);

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }

    await cargarDatos();
  } catch (error: any) {
    console.error("Error al subir estudio:", error);
    alert(`Error al subir el estudio: ${error?.message || "Revisa permisos de Firebase Storage"}`);
  } finally {
    setSubiendo(false);
  }
};

  const guardarDiagnostico = async () => {
    if (!estudioAbierto) return;

    await updateDoc(doc(db, "telemed_estudios", estudioAbierto.id), {
      diagnostico,
    });

    alert("Diagnóstico guardado.");
    setEstudioAbierto(null);
    setDiagnostico("");
    await cargarDatos();
  };

  const solicitarCita = async () => {
    if (!estudioAbierto || !horarioCita) {
      alert("Selecciona un horario.");
      return;
    }

    await updateDoc(doc(db, "telemed_estudios", estudioAbierto.id), {
      citaSolicitada: true,
      citaHorario: horarioCita,
    });

    alert("Cita solicitada correctamente.");
    setEstudioAbierto(null);
    setHorarioCita("");
    await cargarDatos();
  };

  return (
    <div className="min-h-screen bg-black px-5 py-10 text-white">
      <div className="mx-auto max-w-6xl">
        <div className="rounded-3xl border border-cyan-400/20 bg-white/[0.03] p-8">
          <p className="text-xs uppercase tracking-[0.3em] text-cyan-300">
            Plataforma Web DICOM
          </p>

          <h1 className="mt-3 text-3xl font-bold sm:text-4xl">
            Telemedicina y diagnóstico remoto
          </h1>

          <p className="mt-3 max-w-3xl text-white/60">
            Acceso por rol para pacientes, clínicas/hospitales y médicos
            especialistas.
          </p>

          {sesion && (
            <button
              onClick={cerrarSesion}
              className="mt-5 rounded-xl border border-white/10 px-4 py-2 text-sm hover:bg-white/[0.06]"
            >
              Cerrar sesión
            </button>
          )}
        </div>

        {pantalla !== "panel" && (
          <div className="mt-8 rounded-3xl border border-white/10 bg-white/[0.03] p-8">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              {[
                ["paciente", "Paciente"],
                ["centro", "Clínica / Hospital"],
                ["doctor", "Doctor"],
              ].map(([value, label]) => (
                <button
                  key={value}
                  onClick={() => {
                    setRol(value as Rol);
                    setPantalla("login");
                  }}
                  className={`rounded-2xl px-4 py-4 font-semibold transition ${
                    rol === value
                      ? "bg-cyan-400 text-black"
                      : "border border-white/10 bg-white/[0.03] text-white"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            {pantalla === "login" && (
              <div className="mt-8 space-y-5">
                <h2 className="text-2xl font-semibold">Inicio de sesión</h2>

                <select
                  value={centroId}
                  onChange={(e) => setCentroId(e.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-black px-4 py-3"
                >
                  <option value="">Selecciona hospital o clínica</option>
                  {centros.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nombre}
                    </option>
                  ))}
                </select>

                <input
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                  placeholder={
                    rol === "centro"
                      ? "Nombre completo del encargado"
                      : "Nombre completo"
                  }
                  className="w-full rounded-xl border border-white/10 bg-black px-4 py-3"
                />

                <input
                  value={matricula}
                  onChange={(e) => setMatricula(e.target.value)}
                  placeholder="Matrícula"
                  className="w-full rounded-xl border border-white/10 bg-black px-4 py-3"
                />

                {rol === "centro" && (
                  <input
                    value={clave}
                    onChange={(e) => setClave(e.target.value)}
                    placeholder="Clave de acceso única"
                    className="w-full rounded-xl border border-white/10 bg-black px-4 py-3"
                  />
                )}

                <button
                  onClick={iniciarSesion}
                  className="w-full rounded-2xl bg-cyan-400 py-4 font-semibold text-black"
                >
                  Entrar
                </button>

                {(rol === "paciente" || rol === "centro") && (
                  <button
                    onClick={() => setPantalla("registro")}
                    className="w-full rounded-2xl border border-white/10 py-4 font-semibold hover:bg-white/[0.06]"
                  >
                    Registrarse
                  </button>
                )}
              </div>
            )}

            {pantalla === "registro" && rol === "paciente" && (
              <div className="mt-8 space-y-5">
                <h2 className="text-2xl font-semibold">Registro de paciente</h2>

                <input
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                  placeholder="Nombre completo"
                  className="w-full rounded-xl border border-white/10 bg-black px-4 py-3"
                />

                <input
                  value={matricula}
                  onChange={(e) => setMatricula(e.target.value)}
                  placeholder="Matrícula"
                  className="w-full rounded-xl border border-white/10 bg-black px-4 py-3"
                />

                <select
                  value={centroId}
                  onChange={(e) => setCentroId(e.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-black px-4 py-3"
                >
                  <option value="">Hospital o clínica</option>
                  {centros.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nombre}
                    </option>
                  ))}
                </select>

                <button
                  onClick={registrarPaciente}
                  className="w-full rounded-2xl bg-cyan-400 py-4 font-semibold text-black"
                >
                  Registrar paciente
                </button>
              </div>
            )}

            {pantalla === "registro" && rol === "centro" && (
              <div className="mt-8 space-y-6">
                <h2 className="text-2xl font-semibold">
                  Registro de clínica / hospital
                </h2>

                <input
                  value={centroNombreRegistro}
                  onChange={(e) => setCentroNombreRegistro(e.target.value)}
                  placeholder="Nombre de la clínica u hospital"
                  className="w-full rounded-xl border border-white/10 bg-black px-4 py-3"
                />

                <div>
                  <div className="flex items-center justify-between gap-4">
                    <h3 className="text-lg font-semibold">
                      Encargados autorizados
                    </h3>

                    <button
                      type="button"
                      onClick={() => agregarPersonaRegistro("encargado")}
                      className="rounded-xl border border-cyan-400/30 px-4 py-2 text-sm text-cyan-200 hover:bg-cyan-400/10"
                    >
                      + Agregar encargado
                    </button>
                  </div>

                  <div className="mt-4 space-y-3">
                    {encargadosRegistro.map((e, index) => (
                      <div
                        key={index}
                        className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_1fr_auto]"
                      >
                        <input
                          value={e.nombre}
                          onChange={(ev) =>
                            actualizarPersonaRegistro(
                              "encargado",
                              index,
                              "nombre",
                              ev.target.value
                            )
                          }
                          placeholder="Nombre completo del encargado"
                          className="w-full rounded-xl border border-white/10 bg-black px-4 py-3"
                        />

                        <input
                          value={e.matricula}
                          onChange={(ev) =>
                            actualizarPersonaRegistro(
                              "encargado",
                              index,
                              "matricula",
                              ev.target.value
                            )
                          }
                          placeholder="Matrícula del encargado"
                          className="w-full rounded-xl border border-white/10 bg-black px-4 py-3"
                        />

                        <button
                          type="button"
                          onClick={() =>
                            eliminarPersonaRegistro("encargado", index)
                          }
                          className="rounded-xl border border-red-400/30 px-4 py-3 text-red-300 hover:bg-red-400/10"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between gap-4">
                    <h3 className="text-lg font-semibold">
                      Doctores autorizados
                    </h3>

                    <button
                      type="button"
                      onClick={() => agregarPersonaRegistro("doctor")}
                      className="rounded-xl border border-cyan-400/30 px-4 py-2 text-sm text-cyan-200 hover:bg-cyan-400/10"
                    >
                      + Agregar doctor
                    </button>
                  </div>

                  <div className="mt-4 space-y-3">
                    {doctoresRegistro.map((d, index) => (
                      <div
                        key={index}
                        className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_1fr_auto]"
                      >
                        <input
                          value={d.nombre}
                          onChange={(ev) =>
                            actualizarPersonaRegistro(
                              "doctor",
                              index,
                              "nombre",
                              ev.target.value
                            )
                          }
                          placeholder="Nombre completo del doctor"
                          className="w-full rounded-xl border border-white/10 bg-black px-4 py-3"
                        />

                        <input
                          value={d.matricula}
                          onChange={(ev) =>
                            actualizarPersonaRegistro(
                              "doctor",
                              index,
                              "matricula",
                              ev.target.value
                            )
                          }
                          placeholder="Matrícula del doctor"
                          className="w-full rounded-xl border border-white/10 bg-black px-4 py-3"
                        />

                        <button
                          type="button"
                          onClick={() =>
                            eliminarPersonaRegistro("doctor", index)
                          }
                          className="rounded-xl border border-red-400/30 px-4 py-3 text-red-300 hover:bg-red-400/10"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                <p className="text-sm text-white/50">
                  La clave se generará automáticamente con el nombre del centro
                  en mayúsculas, sin espacios ni acentos.
                </p>

                <button
                  onClick={registrarCentro}
                  className="w-full rounded-2xl bg-cyan-400 py-4 font-semibold text-black"
                >
                  Registrar clínica / hospital
                </button>
              </div>
            )}
          </div>
        )}

        {pantalla === "panel" && sesion?.rol === "paciente" && (
          <PanelPaciente
            estudios={estudiosPaciente}
            abrir={(e) => {
              setEstudioAbierto(e);
              setHorarioCita(e.citaHorario || "");
            }}
          />
        )}

        {pantalla === "panel" && sesion?.rol === "centro" && (
          <div className="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-2">
            <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-8">
              <h2 className="text-2xl font-semibold">Pacientes</h2>

              <button
                onClick={() => setMostrarAdminPersonal(!mostrarAdminPersonal)}
                className="mt-5 w-full rounded-2xl border border-cyan-400/30 bg-cyan-400/[0.06] px-4 py-3 text-sm font-semibold text-cyan-100 hover:bg-cyan-400/10"
              >
                Administrar encargados y doctores
              </button>

              {mostrarAdminPersonal && (
                <AdministrarPersonalCentro
                  centro={centros.find((c) => c.id === sesion.centroId)}
                  onGuardar={actualizarPersonalCentro}
                />
              )}

              <input
                value={busquedaPaciente}
                onChange={(e) => setBusquedaPaciente(e.target.value)}
                placeholder="Buscar por nombre o matrícula"
                className="mt-5 w-full rounded-xl border border-white/10 bg-black px-4 py-3"
              />

              <div className="mt-5 space-y-3">
                {pacientesFiltrados.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => setPacienteSeleccionado(p)}
                    className="w-full rounded-2xl border border-white/10 bg-black/40 p-4 text-left hover:bg-white/[0.06]"
                  >
                    <p className="font-semibold">{p.nombre}</p>
                    <p className="text-sm text-white/50">{p.matricula}</p>
                  </button>
                ))}
              </div>
            </div>

            <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-8">
              <h2 className="text-2xl font-semibold">
                {pacienteSeleccionado
                  ? pacienteSeleccionado.nombre
                  : "Selecciona un paciente"}
              </h2>

              {pacienteSeleccionado && (
                <>
                  <div className="mt-5 space-y-3">
                    {estudiosPaciente.map((e) => (
                      <button
                        key={e.id}
                        onClick={() => setEstudioAbierto(e)}
                        className="w-full rounded-2xl border border-white/10 bg-black/40 p-4 text-left hover:bg-white/[0.06]"
                      >
                        <p className="font-semibold">{e.nombreEstudio}</p>
                        <p className="text-sm text-white/50">
                          Doctor: {e.doctorNombre}
                        </p>
                      </button>
                    ))}
                  </div>

                  <div className="mt-8 border-t border-white/10 pt-6">
                    <h3 className="text-xl font-semibold">+ Agregar estudio</h3>

                    <div className="mt-4 space-y-4">
                      <input
                        value={nombreEstudio}
                        onChange={(e) => setNombreEstudio(e.target.value)}
                        placeholder="Nombre del estudio"
                        className="w-full rounded-xl border border-white/10 bg-black px-4 py-3"
                      />

                      <select
                        value={doctorAsignado}
                        onChange={(e) => setDoctorAsignado(e.target.value)}
                        className="w-full rounded-xl border border-white/10 bg-black px-4 py-3"
                      >
                        <option value="">Doctor asignado</option>
                        {centros
                          .find((c) => c.id === sesion.centroId)
                          ?.doctores?.map((d) => (
                            <option
                              key={d.matricula}
                              value={`${d.nombre}|||${d.matricula}`}
                            >
                              {d.nombre} - {d.matricula}
                            </option>
                          ))}
                      </select>

                      <input
                        type="date"
                        value={fechaLimite}
                        onChange={(e) => setFechaLimite(e.target.value)}
                        className="w-full rounded-xl border border-white/10 bg-black px-4 py-3"
                      />

                     <label className="group flex cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-cyan-400/40 bg-cyan-400/[0.04] px-5 py-8 text-center transition hover:bg-cyan-400/[0.08]">
  <span className="text-sm font-semibold text-cyan-200">
    {archivo ? archivo.name : "Seleccionar archivo DICOM o ZIP"}
  </span>

  <span className="mt-2 text-xs text-white/45">
    Formatos permitidos: .dcm o .zip
  </span>

  <input
    ref={fileInputRef}
    type="file"
    accept=".dcm,.zip"
    onChange={(e) => setArchivo(e.target.files?.[0] || null)}
    className="hidden"
  />
</label>

                      <button
                        onClick={subirEstudio}
                        disabled={subiendo}
                        className="w-full rounded-2xl bg-cyan-400 py-4 font-semibold text-black"
                      >
                        {subiendo ? "Subiendo..." : "Agregar estudio"}
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {pantalla === "panel" && sesion?.rol === "doctor" && (
          <div className="mt-8 rounded-3xl border border-white/10 bg-white/[0.03] p-8">
            <h2 className="text-2xl font-semibold">
              Estudios asignados - {sesion.centroNombre}
            </h2>

            <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
              {estudiosDoctor.length === 0 ? (
                <p className="text-white/50">
                  No tienes estudios asignados en este hospital/clínica.
                </p>
              ) : (
                estudiosDoctor.map((e) => (
                  <button
                    key={e.id}
                    onClick={() => {
                      setEstudioAbierto(e);
                      setDiagnostico(e.diagnostico || "");
                    }}
                    className="rounded-2xl border border-white/10 bg-black/40 p-5 text-left hover:bg-white/[0.06]"
                  >
                    <p className="font-semibold">{e.nombreEstudio}</p>
                    <p className="text-sm text-white/50">{e.pacienteNombre}</p>
                    <p className="mt-2 text-xs text-cyan-300">
                      Límite: {e.fechaLimiteDiagnostico || "Sin fecha"}
                    </p>
                  </button>
                ))
              )}
            </div>
          </div>
        )}

        {estudioAbierto && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 px-5">
            <div className="w-full max-w-2xl rounded-3xl border border-white/10 bg-zinc-950 p-8">
              <h2 className="text-2xl font-semibold">
                {estudioAbierto.nombreEstudio}
              </h2>

              <p className="mt-2 text-white/50">
                Paciente: {estudioAbierto.pacienteNombre}
              </p>

              <a
                href={estudioAbierto.archivoURL}
                target="_blank"
                className="mt-5 inline-flex rounded-xl border border-cyan-400/30 px-4 py-3 text-cyan-200 hover:bg-cyan-400/10"
              >
                Descargar archivo DICOM / ZIP
              </a>

              {sesion?.rol === "doctor" ? (
                <div className="mt-6">
                  <p className="mb-2 text-sm text-white/60">Diagnóstico</p>

                  <textarea
                    value={diagnostico}
                    onChange={(e) => setDiagnostico(e.target.value)}
                    rows={6}
                    className="w-full rounded-xl border border-white/10 bg-black px-4 py-3"
                    placeholder="Escribe el diagnóstico del estudio..."
                  />

                  <button
                    onClick={guardarDiagnostico}
                    className="mt-4 w-full rounded-2xl bg-cyan-400 py-4 font-semibold text-black"
                  >
                    Guardar diagnóstico
                  </button>
                </div>
              ) : (
                <div className="mt-6">
                  <p className="mb-2 text-sm text-white/60">Diagnóstico</p>

                  <div className="rounded-2xl border border-white/10 bg-black/40 p-4 text-white/80">
                    {estudioAbierto.diagnostico ||
                      "El diagnóstico aún no ha sido agregado por el doctor."}
                  </div>

                  {sesion?.rol === "paciente" && (
                    <div className="mt-5">
                      <p className="mb-2 text-sm text-white/60">
                        Agendar videollamada
                      </p>

                      <select
                        value={horarioCita}
                        onChange={(e) => setHorarioCita(e.target.value)}
                        className="w-full rounded-xl border border-white/10 bg-black px-4 py-3"
                      >
                        <option value="">Selecciona horario disponible</option>
                        <option>Lunes 10:00 AM</option>
                        <option>Miércoles 4:00 PM</option>
                        <option>Viernes 12:00 PM</option>
                      </select>

                      <button
                        onClick={solicitarCita}
                        className="mt-4 w-full rounded-2xl bg-emerald-400 py-4 font-semibold text-black"
                      >
                        Solicitar cita
                      </button>
                    </div>
                  )}
                </div>
              )}

              <button
                onClick={() => setEstudioAbierto(null)}
                className="mt-5 w-full rounded-2xl border border-white/10 py-3 hover:bg-white/[0.06]"
              >
                Cerrar
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function PanelPaciente({
  estudios,
  abrir,
}: {
  estudios: Estudio[];
  abrir: (e: Estudio) => void;
}) {
  return (
    <div className="mt-8 rounded-3xl border border-white/10 bg-white/[0.03] p-8">
      <h2 className="text-2xl font-semibold">Mis estudios médicos</h2>

      <p className="mt-2 text-white/60">
        Selecciona un estudio para descargar el archivo y consultar el
        diagnóstico.
      </p>

      <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {estudios.length === 0 ? (
          <p className="text-white/50">No tienes estudios registrados.</p>
        ) : (
          estudios.map((e) => (
            <button
              key={e.id}
              onClick={() => abrir(e)}
              className="rounded-2xl border border-white/10 bg-black/40 p-5 text-left hover:bg-white/[0.06]"
            >
              <p className="font-semibold">{e.nombreEstudio}</p>
              <p className="mt-1 text-sm text-white/50">{e.centroNombre}</p>
              <p className="mt-3 text-xs text-cyan-300">
                Doctor: {e.doctorNombre}
              </p>
            </button>
          ))
        )}
      </div>
    </div>
  );
}

function AdministrarPersonalCentro({
  centro,
  onGuardar,
}: {
  centro?: Centro;
  onGuardar: (tipo: "encargados" | "doctores", nuevaLista: Persona[]) => void;
}) {
  const [encargados, setEncargados] = useState<Persona[]>(
    centro?.encargados || []
  );
  const [doctores, setDoctores] = useState<Persona[]>(centro?.doctores || []);

  useEffect(() => {
    setEncargados(centro?.encargados || []);
    setDoctores(centro?.doctores || []);
  }, [centro]);

  const actualizar = (
    tipo: "encargados" | "doctores",
    index: number,
    campo: "nombre" | "matricula",
    valor: string
  ) => {
    if (tipo === "encargados") {
      const copia = [...encargados];
      copia[index][campo] = valor;
      setEncargados(copia);
    } else {
      const copia = [...doctores];
      copia[index][campo] = valor;
      setDoctores(copia);
    }
  };

  return (
    <div className="mt-5 rounded-3xl border border-white/10 bg-black/40 p-5">
      <h3 className="text-xl font-semibold">Administrar personal autorizado</h3>

      <div className="mt-6 space-y-8">
        <div>
          <div className="flex items-center justify-between gap-4">
            <h4 className="font-semibold text-white/90">Encargados</h4>

            <button
              onClick={() =>
                setEncargados([...encargados, { nombre: "", matricula: "" }])
              }
              className="rounded-xl border border-cyan-400/30 px-3 py-2 text-sm text-cyan-200 hover:bg-cyan-400/10"
            >
              + Agregar
            </button>
          </div>

          <div className="mt-4 space-y-3">
            {encargados.map((e, index) => (
              <div
                key={index}
                className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_1fr_auto]"
              >
                <input
                  value={e.nombre}
                  onChange={(ev) =>
                    actualizar(
                      "encargados",
                      index,
                      "nombre",
                      ev.target.value
                    )
                  }
                  placeholder="Nombre completo"
                  className="rounded-xl border border-white/10 bg-black px-4 py-3"
                />

                <input
                  value={e.matricula}
                  onChange={(ev) =>
                    actualizar(
                      "encargados",
                      index,
                      "matricula",
                      ev.target.value
                    )
                  }
                  placeholder="Matrícula"
                  className="rounded-xl border border-white/10 bg-black px-4 py-3"
                />

                <button
                  onClick={() =>
                    setEncargados(encargados.filter((_, i) => i !== index))
                  }
                  className="rounded-xl border border-red-400/30 px-4 py-3 text-red-300 hover:bg-red-400/10"
                >
                  ×
                </button>
              </div>
            ))}
          </div>

          <button
            onClick={() =>
              onGuardar(
                "encargados",
                encargados.filter((e) => e.nombre.trim() && e.matricula.trim())
              )
            }
            className="mt-4 w-full rounded-xl bg-cyan-400 py-3 font-semibold text-black"
          >
            Guardar encargados
          </button>
        </div>

        <div>
          <div className="flex items-center justify-between gap-4">
            <h4 className="font-semibold text-white/90">Doctores</h4>

            <button
              onClick={() =>
                setDoctores([...doctores, { nombre: "", matricula: "" }])
              }
              className="rounded-xl border border-cyan-400/30 px-3 py-2 text-sm text-cyan-200 hover:bg-cyan-400/10"
            >
              + Agregar
            </button>
          </div>

          <div className="mt-4 space-y-3">
            {doctores.map((d, index) => (
              <div
                key={index}
                className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_1fr_auto]"
              >
                <input
                  value={d.nombre}
                  onChange={(ev) =>
                    actualizar("doctores", index, "nombre", ev.target.value)
                  }
                  placeholder="Nombre completo"
                  className="rounded-xl border border-white/10 bg-black px-4 py-3"
                />

                <input
                  value={d.matricula}
                  onChange={(ev) =>
                    actualizar("doctores", index, "matricula", ev.target.value)
                  }
                  placeholder="Matrícula"
                  className="rounded-xl border border-white/10 bg-black px-4 py-3"
                />

                <button
                  onClick={() =>
                    setDoctores(doctores.filter((_, i) => i !== index))
                  }
                  className="rounded-xl border border-red-400/30 px-4 py-3 text-red-300 hover:bg-red-400/10"
                >
                  ×
                </button>
              </div>
            ))}
          </div>

          <button
            onClick={() =>
              onGuardar(
                "doctores",
                doctores.filter((d) => d.nombre.trim() && d.matricula.trim())
              )
            }
            className="mt-4 w-full rounded-xl bg-cyan-400 py-3 font-semibold text-black"
          >
            Guardar doctores
          </button>
        </div>
      </div>
    </div>
  );
}