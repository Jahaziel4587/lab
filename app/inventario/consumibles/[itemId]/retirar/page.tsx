"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { collection, doc, getDoc, getDocs, orderBy, query, serverTimestamp, setDoc, updateDoc, addDoc } from "firebase/firestore";
import { db } from "@/src/firebase/firebaseConfig";
import { useAuth } from "@/src/Context/AuthContext";

// ---- Lista de proyectos proporcionada ----
const proyectos = [
  { nombre: "001.Ocumetics", imagen: "/ocumetics.jpeg" },
  { nombre: "002.Labella", imagen: "/Bioana.jpeg" },
  { nombre: "003.XSONXS", imagen: "/XSONX.png" },
  { nombre: "004.Solvein", imagen: "/Bioana.jpeg" },
  { nombre: "005.XSONXS wound heads", imagen: "/XSONX.png" },
  { nombre: "006.AGMI", imagen: "/Bioana.jpeg" },
  { nombre: "007.LumeNXT", imagen: "/LumeNXT.jpg" },
  { nombre: "008.Panter", imagen: "/Bioana.jpeg" },
  { nombre: "009.Recopad", imagen: "/Bioana.jpeg" },
  { nombre: "010.Juno", imagen: "/Bioana.jpeg" },
  { nombre: "012.Neurocap", imagen: "/Bioana.jpeg" },
  { nombre: "013.T-EZ", imagen: "/Bioana.jpeg" },
  { nombre: "014.QIK Cap handle", imagen: "/Bioana.jpeg" },
  { nombre: "015.QIK Cap disponible", imagen: "/Bioana.jpeg" },
  { nombre: "016.Portacad shield", imagen: "/Bioana.jpeg" },
  { nombre: "027.XSCRUB", imagen: "/XSCRUB.jpeg" },
  { nombre: "029.Zipstich", imagen: "/Bioana.jpeg" },
  { nombre: "030.MUV", imagen: "/Bioana.jpeg" },
  { nombre: "E001.Avarie Menstrual Pads", imagen: "/Bioana.jpeg" },
  { nombre: "E002.Hero Cap", imagen: "/Bioana.jpeg" },
  { nombre: "E003.Injectable Dermis", imagen: "/Bioana.jpeg" },
  { nombre: "E004.DiViDiaper", imagen: "/Bioana.jpeg" },
  { nombre: "E006.Structural Heart", imagen: "/Bioana.jpeg" },
  { nombre: "E007.Leg wrap", imagen: "/Bioana.jpeg" },
  { nombre: "E009.InjectMate", imagen: "/Bioana.jpeg" },
  { nombre: "E010.Orthodoxo", imagen: "/Bioana.jpeg" },
  { nombre: "E011.Orthodoxo Anclas", imagen: "/Bioana.jpeg" },
  { nombre: "E012.Falcon View", imagen: "/Bioana.jpeg" },
  { nombre: "E013.Birchconcepts", imagen: "/Bioana.jpeg" },
  { nombre: "E015.Sport Care", imagen: "/Bioana.jpeg" },
  { nombre: "Otro", imagen: "/otro.jpg" },
];

type Consumible = {
  titulo: string;
  imagenURL: string;
  lugar: string;
  cantidad: number;
};

type DocConsumibles = {
  items: Consumible[];
};

type PerfilUsuario = {
  uid: string;
  nombre?: string;
  apellido?: string;
  displayName?: string; // por si lo tuvieras
  role?: string;
  codigoVerificacion?: string | null;
};

type Paso = "proyecto" | "usuario" | "pin" | "cantidad";

export default function RetirarConsumiblePage() {
  const router = useRouter();
  const params = useParams<{ itemId: string }>();
  const index = useMemo(() => Number(params.itemId), [params.itemId]);

  const { isAdmin } = useAuth();

  const [consumible, setConsumible] = useState<Consumible | null>(null);
  const [loading, setLoading] = useState(true);

  // Paso actual
  const [paso, setPaso] = useState<Paso>("proyecto");

  // Selecciones
  const [proyectoSel, setProyectoSel] = useState<{ nombre: string; imagen: string } | null>(null);
  const [usuarioSel, setUsuarioSel] = useState<PerfilUsuario | null>(null);

  // Usuarios (para burbujas)
  const [usuarios, setUsuarios] = useState<PerfilUsuario[]>([]);

  // PIN
  const [pin, setPin] = useState<string>("");
  const [creandoPin, setCreandoPin] = useState(false);
  const [pinNuevo, setPinNuevo] = useState<string>("");
  const [pinNuevo2, setPinNuevo2] = useState<string>("");

  // Cantidad a retirar
  const [cant, setCant] = useState<string>("");

  // Cargar consumible + usuarios
  useEffect(() => {
    const load = async () => {
      try {
        // Solo admins
        if (!isAdmin) {
          setLoading(false);
          return;
        }

        // Consumible por index
        const ref = doc(db, "inventario", "consumibles");
        const snap = await getDoc(ref);
        const data = snap.data() as DocConsumibles | undefined;
        const item = data?.items?.[index] ?? null;
        setConsumible(item || null);

        // Usuarios (sin correos, mostramos nombre)
        const q = query(collection(db, "users"), orderBy("nombre"));
        const usSnap = await getDocs(q);
        const us = usSnap.docs.map((d) => {
          const raw = d.data() as any;
          const display =
            (raw.displayName as string) ||
            [raw.nombre, raw.apellido].filter(Boolean).join(" ") ||
            "Usuario";
          return {
            uid: d.id,
            nombre: raw.nombre,
            apellido: raw.apellido,
            displayName: display,
            role: raw.role,
            codigoVerificacion: raw.codigoVerificacion ?? null,
          } as PerfilUsuario;
        });
        setUsuarios(us);
      } catch (e) {
        console.error(e);
        alert("No se pudo cargar la información.");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [index, isAdmin]);

  // Handlers de selección
  const handleSelectProyecto = (p: { nombre: string; imagen: string }) => {
    setProyectoSel(p);
    setPaso("usuario");
  };

  const handleSelectUsuario = (u: PerfilUsuario) => {
    setUsuarioSel(u);
    // Si no tiene PIN, vamos directo a crear
    if (!u.codigoVerificacion) {
      setCreandoPin(true);
    } else {
      setCreandoPin(false);
    }
    setPaso("pin");
  };

  // Keypad numérico (para PIN y Cantidad)
  const handleKeypad = (digit: string) => {
    if (paso === "pin") {
      if (creandoPin) {
        // para crear: llenamos pinNuevo y pinNuevo2
        if (pinNuevo.length < 3) setPinNuevo(pinNuevo + digit);
      } else {
        if (pin.length < 3) setPin(pin + digit);
      }
    } else if (paso === "cantidad") {
      // cantidad
      // permitir backspace lo manejamos con "←"
      if (digit === "." && !cant.includes(".")) setCant(cant + ".");
      else if (/^\d$/.test(digit)) setCant(cant + digit);
    }
  };

  const handleBackspace = () => {
    if (paso === "pin") {
      if (creandoPin) {
        if (pinNuevo2.length > 0) setPinNuevo2(pinNuevo2.slice(0, -1));
        else if (pinNuevo.length > 0) setPinNuevo(pinNuevo.slice(0, -1));
      } else {
        setPin(pin.slice(0, -1));
      }
    } else if (paso === "cantidad") {
      if (cant.length > 0) setCant(cant.slice(0, -1));
    }
  };

  const resetPinInputs = () => {
    setPin("");
    setPinNuevo("");
    setPinNuevo2("");
  };

  // Validar PIN o crearlo
  const handleValidarPin = async () => {
    if (!usuarioSel) return;

    if (creandoPin) {
      // Pedimos 2 veces: primero pinNuevo y luego pinNuevo2
      if (pinNuevo.length < 3) {
        alert("El PIN debe tener 3 dígitos.");
        return;
      }
      if (pinNuevo2.length === 0) {
        // pasamos a confirmar
        setPinNuevo2("");
        // cambias el enfoque visual, pero aquí solo mostramos el mismo keypad
        // el usuario debe volver a teclear los 3 dígitos para confirmar
        // (indicamos con el texto que está confirmando)
        // En esta implementación, usamos el mismo estado `pinNuevo2`, el usuario lo llenará con el keypad
        // Para UX clara: si `pinNuevo2.length < 3`, mostramos "Confirma tu PIN".
        if (pinNuevo2.length < 3) {
          alert("Teclea de nuevo el PIN para confirmar (3 dígitos).");
        }
        return;
      }
      // si ya escribió los 3 dígitos de confirmación:
      if (pinNuevo !== pinNuevo2) {
        alert("Los PIN no coinciden, vuelve a intentarlo.");
        resetPinInputs();
        return;
      }

      // Guardar en el doc del usuario
      try {
        await updateDoc(doc(db, "users", usuarioSel.uid), {
          codigoVerificacion: pinNuevo,
        });
        setUsuarioSel({ ...usuarioSel, codigoVerificacion: pinNuevo });
        resetPinInputs();
        setPaso("cantidad");
      } catch (e) {
        console.error(e);
        alert("No se pudo guardar el PIN. Intenta de nuevo.");
      }
      return;
    }

    // Validación de PIN existente
    if ((usuarioSel.codigoVerificacion || "") !== pin) {
      alert("PIN incorrecto.");
      setPin("");
      return;
    }
    setPaso("cantidad");
  };

  const handleConfirmar = async () => {
    if (!consumible || !proyectoSel || !usuarioSel) return;

    const n = Number(cant);
    if (Number.isNaN(n) || n <= 0) {
      alert("Cantidad inválida.");
      return;
    }
    if (typeof consumible.cantidad === "number" && n > consumible.cantidad) {
      alert("No hay suficiente stock.");
      return;
    }

    try {
      // 1) Actualizar stock del consumible (array por índice)
      const ref = doc(db, "inventario", "consumibles");
      const snap = await getDoc(ref);
      if (!snap.exists()) {
        alert("Documento de consumibles no encontrado.");
        return;
      }
      const data = snap.data() as DocConsumibles;
      const arr = [...(data.items || [])];
      if (!arr[index]) {
        alert("Consumible no encontrado.");
        return;
      }
      const prev = arr[index];
      const nuevaCantidad = Math.max(0, (prev.cantidad ?? 0) - n);
      arr[index] = { ...prev, cantidad: nuevaCantidad };
      await updateDoc(ref, { items: arr });

      // 2) Registrar movimiento
      const mov = {
        consumibleTitulo: prev.titulo,
        consumibleIndex: index,
        proyecto: proyectoSel.nombre,
        userId: usuarioSel.uid,
        userName:
          usuarioSel.displayName ||
          [usuarioSel.nombre, usuarioSel.apellido].filter(Boolean).join(" ") ||
          "Usuario",
        cantidadTomada: n,
        fecha: serverTimestamp(),
      };
      await addDoc(collection(db, "inventory_movements"), mov);

      // 3) Feedback y salir
      alert("Retiro registrado.");
      router.push("/inventario/consumibles");
    } catch (e) {
      console.error(e);
      alert("No se pudo registrar el retiro.");
    }
  };

  // ---- UI ----

  if (!isAdmin) {
    return (
      <div className="min-h-screen px-6 py-10 bg-gray-600">
        <div className="max-w-7xl mx-auto bg-white text-black rounded-2xl p-6">
          <div className="mb-6 flex items-center justify-between">
            <h1 className="text-xl font-bold">Retirar consumible</h1>
            <button
              onClick={() => router.back()}
              className="bg-black text-white px-4 py-2 rounded hover:opacity-90"
            >
              ← Regresar
            </button>
          </div>
          <p className="text-sm text-gray-700">No tienes permisos para realizar retiros.</p>
        </div>
      </div>
    );
  }

  if (loading || !consumible) {
    return (
      <div className="min-h-screen px-6 py-10 bg-gray-600">
        <div className="max-w-7xl mx-auto bg-white text-black rounded-2xl p-6">
          <div className="mb-6 flex items-center justify-between">
            <h1 className="text-xl font-bold">Retirar consumible</h1>
            <button
              onClick={() => router.back()}
              className="bg-black text-white px-4 py-2 rounded hover:opacity-90"
            >
              ← Regresar
            </button>
          </div>
          <p className="text-sm text-gray-700">Cargando…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen px-6 py-10 bg-gray-600">
      <div className="max-w-7xl mx-auto bg-white text-black rounded-2xl p-6">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-xl font-bold">Retirar consumible</h1>
          <button
            onClick={() => router.back()}
            className="bg-black text-white px-4 py-2 rounded hover:opacity-90"
          >
            ← Regresar
          </button>
        </div>

        {/* Pasos */}
        {paso === "proyecto" && (
          <PasoProyecto onSelect={handleSelectProyecto} />
        )}

        {paso === "usuario" && (
          <PasoUsuario usuarios={usuarios} onSelect={handleSelectUsuario} />
        )}

        {paso === "pin" && (
          <PasoPin
            creando={creandoPin}
            pin={pin}
            setPin={setPin}
            pinNuevo={pinNuevo}
            setPinNuevo={setPinNuevo}
            pinNuevo2={pinNuevo2}
            setPinNuevo2={setPinNuevo2}
            onBack={() => {
              // regresar a elegir usuario
              resetPinInputs();
              setPaso("usuario");
            }}
            onNext={handleValidarPin}
          />
        )}

        {paso === "cantidad" && (
          <PasoCantidad
            consumible={consumible}
            proyecto={proyectoSel!}
            usuario={usuarioSel!}
            cant={cant}
            setCant={setCant}
            onKeypad={handleKeypad}
            onBack={() => {
              setCant("");
              setPaso("pin");
            }}
            onConfirm={handleConfirmar}
          />
        )}
      </div>
    </div>
  );
}

/* ---------------- Subcomponentes de pasos ---------------- */

function PasoProyecto({
  onSelect,
}: {
  onSelect: (p: { nombre: string; imagen: string }) => void;
}) {
  return (
    <div>
      <h2 className="text-lg font-semibold mb-4">¿Para qué proyecto es el consumible?</h2>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
        {proyectos.map((p, i) => (
          <button
            key={i}
            onClick={() => onSelect(p)}
            className="bg-white text-black border rounded-xl overflow-hidden shadow hover:shadow-md transition"
            title={p.nombre}
          >
            <div className="h-28 w-full bg-gray-100">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={p.imagen}
                alt={p.nombre}
                className="h-full w-full object-cover"
                onError={(e) => ((e.currentTarget.style.display = "none"))}
              />
            </div>
            <div className="px-3 py-2 text-xs text-center">
              <div className="truncate font-medium">{p.nombre}</div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

function PasoUsuario({
  usuarios,
  onSelect,
}: {
  usuarios: PerfilUsuario[];
  onSelect: (u: PerfilUsuario) => void;
}) {
  return (
    <div>
      <h2 className="text-lg font-semibold mb-4">¿Quién toma el consumible?</h2>
      <div className="flex flex-wrap gap-4">
        {usuarios.map((u) => {
          const nombre =
            u.displayName ||
            [u.nombre, u.apellido].filter(Boolean).join(" ") ||
            "Usuario";
        return (
          <button
            key={u.uid}
            onClick={() => onSelect(u)}
            className="flex flex-col items-center"
            aria-label={nombre}
            title={nombre}
          >
            <div className="w-20 h-20 rounded-full bg-gray-200 border flex items-center justify-center text-sm font-medium">
              {nombre.slice(0, 2).toUpperCase()}
            </div>
            <div className="mt-2 text-xs text-center max-w-[6rem] truncate">{nombre}</div>
          </button>
        );
      })}
      </div>
    </div>
  );
}

function PasoPin({
  creando,
  pin,
  setPin,
  pinNuevo,
  setPinNuevo,
  pinNuevo2,
  setPinNuevo2,
  onBack,
  onNext,
}: {
  creando: boolean;
  pin: string;
  setPin: (v: string) => void;
  pinNuevo: string;
  setPinNuevo: (v: string) => void;
  pinNuevo2: string;
  setPinNuevo2: (v: string) => void;
  onBack: () => void;
  onNext: () => void;
}) {
  // keypad local para este paso
  const [faseCreacion, setFaseCreacion] = useState<"pin1" | "pin2">("pin1");

  useEffect(() => {
    if (!creando) return;
    // Si ya llenó 3 dígitos del primer PIN, cambiamos a confirmación
    if (pinNuevo.length === 3 && faseCreacion === "pin1") {
      setFaseCreacion("pin2");
    }
  }, [creando, pinNuevo, faseCreacion]);

  const onDigit = (d: string) => {
    if (creando) {
      if (faseCreacion === "pin1" && pinNuevo.length < 3) setPinNuevo(pinNuevo + d);
      if (faseCreacion === "pin2" && pinNuevo2.length < 3) setPinNuevo2(pinNuevo2 + d);
    } else {
      if (pin.length < 3) setPin(pin + d);
    }
  };

  const onBackspace = () => {
    if (creando) {
      if (faseCreacion === "pin2" && pinNuevo2.length > 0) setPinNuevo2(pinNuevo2.slice(0, -1));
      else if (faseCreacion === "pin1" && pinNuevo.length > 0) setPinNuevo(pinNuevo.slice(0, -1));
    } else {
      if (pin.length > 0) setPin(pin.slice(0, -1));
    }
  };

  const label = creando
    ? faseCreacion === "pin1"
      ? "Crea tu PIN (3 dígitos)"
      : "Confirma tu PIN"
    : "Ingresa tu PIN (3 dígitos)";

  const display = creando
    ? (faseCreacion === "pin1" ? pinNuevo : pinNuevo2)
    : pin;

  return (
    <div>
      <h2 className="text-lg font-semibold mb-2">{label}</h2>

      {/* Indicador de dígitos */}
      <div className="flex gap-3 my-4">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className={`w-6 h-6 rounded-full border-2 ${display.length > i ? "bg-black border-black" : "border-gray-400"}`}
          />
        ))}
      </div>

      {/* Teclado grande */}
      <Keypad onDigit={onDigit} onBackspace={onBackspace} />

      <div className="mt-6 flex justify-between">
        <button onClick={onBack} className="px-4 py-2 rounded border hover:bg-gray-50">
          ← Atrás
        </button>
        <button
          onClick={onNext}
          className="px-4 py-2 rounded bg-black text-white hover:opacity-90"
        >
          Continuar
        </button>
      </div>
    </div>
  );
}

function PasoCantidad({
  consumible,
  proyecto,
  usuario,
  cant,
  setCant,
  onKeypad,
  onBack,
  onConfirm,
}: {
  consumible: Consumible;
  proyecto: { nombre: string; imagen: string };
  usuario: PerfilUsuario;
  cant: string;
  setCant: (v: string) => void;
  onKeypad: (d: string) => void;
  onBack: () => void;
  onConfirm: () => void;
}) {
  const nombreUsuario =
    usuario.displayName ||
    [usuario.nombre, usuario.apellido].filter(Boolean).join(" ") ||
    "Usuario";

  return (
    <div>
      <h2 className="text-lg font-semibold mb-4">Indica la cantidad a retirar</h2>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Izquierda: tarjeta del consumible */}
        <div className="bg-white border rounded-xl overflow-hidden shadow-sm">
          <div className="h-40 w-full bg-gray-100">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {consumible.imagenURL ? (
              <img
                src={consumible.imagenURL}
                alt={consumible.titulo}
                className="h-full w-full object-cover"
                onError={(e) => ((e.currentTarget.style.display = "none"))}
              />
            ) : null}
          </div>
          <div className="px-4 py-3 text-sm">
            <div className="font-semibold text-base mb-1">{consumible.titulo}</div>
            <div className="text-gray-700">
              <div><span className="font-semibold">Lugar:</span> {consumible.lugar || "—"}</div>
              <div><span className="font-semibold">Cantidad actual:</span> {consumible.cantidad ?? "—"}</div>
            </div>
          </div>
        </div>

        {/* Derecha: input grande y keypad */}
        <div className="flex flex-col">
          <div className="text-sm text-gray-700 mb-2">
            Proyecto: <span className="font-medium">{proyecto.nombre}</span>
            <br />
            Usuario: <span className="font-medium">{nombreUsuario}</span>
          </div>

          <div className="mb-4">
            <label className="block text-sm text-gray-600 mb-1">Cantidad a retirar</label>
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              value={cant}
              onChange={(e) => {
                const v = e.target.value.replace(/[^\d.]/g, "");
                setCant(v);
              }}
              className="w-full border rounded px-4 py-3 text-2xl"
              placeholder="0"
            />
          </div>

          <Keypad
            onDigit={(d) => onKeypad(d)}
            onBackspace={() => onKeypad("back")}
          />

          <div className="mt-6 flex justify-between">
            <button onClick={onBack} className="px-4 py-2 rounded border hover:bg-gray-50">
              ← Atrás
            </button>
            <button
              onClick={onConfirm}
              className="px-4 py-2 rounded bg-black text-white hover:opacity-90"
            >
              Confirmar retiro
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------------- Keypad grande reutilizable ---------------- */

function Keypad({
  onDigit,
  onBackspace,
}: {
  onDigit: (d: string) => void;
  onBackspace: () => void;
}) {
  const nums = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "0"];

  return (
    <div className="grid grid-cols-3 gap-3 max-w-xs">
      {nums.slice(0, 9).map((n) => (
        <button
          key={n}
          onClick={() => onDigit(n)}
          className="h-16 rounded-full bg-white border text-xl font-semibold hover:shadow"
        >
          {n}
        </button>
      ))}
      <button
        onClick={onBackspace}
        className="h-16 rounded-full bg-white border text-xl font-semibold hover:shadow"
        title="Borrar"
      >
        ←
      </button>
      <button
        onClick={() => onDigit("0")}
        className="h-16 rounded-full bg-white border text-xl font-semibold hover:shadow"
      >
        0
      </button>
      <div />
    </div>
  );
}
