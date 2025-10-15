"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  addDoc,
  where,
} from "firebase/firestore";
import { db } from "@/src/firebase/firebaseConfig";
import { useAuth } from "@/src/Context/AuthContext";

/* ---------- Proyectos ---------- */
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

/* ---------- Tipos ---------- */
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
  displayName?: string;
  role?: string;
  codigoVerificacion?: string | null;
};

type Paso = "proyecto" | "usuario" | "pin" | "cantidad";

/* ---------- Page ---------- */
export default function RetirarConsumiblePage() {
  const router = useRouter();
  const params = useParams<{ itemId: string }>();
  const searchParams = useSearchParams();
  const modo = (searchParams.get("modo") || "retiro") as "retiro" | "ajuste";

  const index = useMemo(() => Number(params.itemId), [params.itemId]);
  const { isAdmin } = useAuth();

  const [consumible, setConsumible] = useState<Consumible | null>(null);
  const [loading, setLoading] = useState(true);

  // Paso actual (AJUSTE arranca en "cantidad" para permitir editar primero)
  const [paso, setPaso] = useState<Paso>(modo === "ajuste" ? "cantidad" : "proyecto");

  // Selecciones
  const [proyectoSel, setProyectoSel] = useState<{ nombre: string; imagen: string } | null>(null);
  const [usuarioSel, setUsuarioSel] = useState<PerfilUsuario | null>(null);

  // Usuarios
  const [usuarios, setUsuarios] = useState<PerfilUsuario[]>([]);

  // PIN
  const [pin, setPin] = useState<string>("");
  const [creandoPin, setCreandoPin] = useState(false);
  const [pinNuevo, setPinNuevo] = useState<string>("");
  const [pinNuevo2, setPinNuevo2] = useState<string>("");

  // Cantidad (en retiro: cantidad a retirar; en ajuste: nueva cantidad absoluta)
  const [cant, setCant] = useState<string>("");

  // Flag para aplicar ajuste tras seleccionar usuario/PIN
  const [pendingAjuste, setPendingAjuste] = useState<boolean>(false);

  // >>> CAMBIO: estados para modal de autenticación en AJUSTE
  const [authOpen, setAuthOpen] = useState(false);
  const [pendingCantidadAjuste, setPendingCantidadAjuste] = useState<number | null>(null);
  // (El admin seleccionado en el modal lo guardaremos en usuarioSel vía callback)

  /* ---------- Cargar consumible + usuarios ---------- */
  useEffect(() => {
    const load = async () => {
      try {
        if (!isAdmin) {
          setLoading(false);
          return;
        }

        // Consumible por índice
        const ref = doc(db, "inventario", "consumibles");
        const snap = await getDoc(ref);
        const data = snap.data() as DocConsumibles | undefined;
        const item = data?.items?.[index] ?? null;
        setConsumible(item || null);

        // Usuarios:
        // - En "retiro": TODOS (ordenados por nombre).
        // - En "ajuste": SOLO admins (role === "admin").
        if (modo === "ajuste") {
          // === SOLO ADMINS ===
          const qAdmins = query(collection(db, "users"), where("role", "==", "admin"));
          const sAdmins = await getDocs(qAdmins);
          const admins = sAdmins.docs
            .map((d) => {
              const raw = d.data() as any;
              const display =
                (raw.displayName as string) ||
                [raw?.nombre, raw?.apellido].filter(Boolean).join(" ") ||
                "Admin";
              return {
                uid: d.id,
                nombre: raw?.nombre,
                apellido: raw?.apellido,
                displayName: display,
                role: raw?.role,
                codigoVerificacion: raw?.codigoVerificacion ?? null,
              } as PerfilUsuario;
            })
            .sort((a, b) => (a.displayName || "").localeCompare(b.displayName || ""));
          setUsuarios(admins);

          // Prellenar cantidad con la actual para editarla
          if (item) setCant(String(item.cantidad ?? 0));
        } else {
          // === TODOS LOS USUARIOS ===
          const qUsers = query(collection(db, "users"), orderBy("nombre"));
          const usSnap = await getDocs(qUsers);
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
        }
      } catch (e) {
        console.error(e);
        alert("No se pudo cargar la información.");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [index, isAdmin, modo]);

  /* ---------- Navegación de pasos ---------- */
  const handleSelectProyecto = (p: { nombre: string; imagen: string }) => {
    setProyectoSel(p);
    setPaso("usuario");
  };

  const handleSelectUsuario = (u: PerfilUsuario) => {
    setUsuarioSel(u);
    setCreandoPin(!u.codigoVerificacion);
    resetPinInputs();
    setPaso("pin");
  };

  const resetPinInputs = () => {
    setPin("");
    setPinNuevo("");
    setPinNuevo2("");
  };

  /* ---------- APLICAR AJUSTE (reutilizable) ---------- */
  const applyAjuste = async () => {
    if (!consumible || !usuarioSel) return;

    const n = Number(cant);
    if (Number.isNaN(n) || n < 0) {
      alert("Cantidad nueva inválida.");
      return;
    }

    try {
      // 1) Setear stock absoluto
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
      const cantidadAntes = prev.cantidad ?? 0;
      const cantidadDespues = n;
      arr[index] = { ...prev, cantidad: cantidadDespues };
      await updateDoc(ref, { items: arr });

      // 2) Movimiento: ajuste (autorizado por el admin seleccionado)
      const mov = {
        tipo: "ajuste",
        consumibleTitulo: prev.titulo,
        consumibleIndex: index,
        userId: usuarioSel.uid,
        userName:
          usuarioSel.displayName ||
          [usuarioSel.nombre, usuarioSel.apellido].filter(Boolean).join(" ") ||
          "Admin",
        cantidadAntes,
        cantidadDespues,
        fecha: serverTimestamp(),
      };
      await addDoc(collection(db, "inventory_movements"), mov);

      alert("Cantidad actualizada.");
      router.push("/inventario/consumibles");
    } catch (e) {
      console.error(e);
      alert("No se pudo actualizar la cantidad.");
    }
  };

  /* ---------- Validación/creación de PIN ---------- */
  const handleValidarPin = async () => {
    if (!usuarioSel) return;

    // Crear PIN
    if (creandoPin) {
      if (pinNuevo.length !== 3 || pinNuevo2.length !== 3) {
        alert("El PIN debe tener 3 dígitos.");
        return;
      }
      if (pinNuevo !== pinNuevo2) {
        alert("Los PIN no coinciden, vuelve a intentarlo.");
        resetPinInputs();
        return;
      }
      try {
        await updateDoc(doc(db, "users", usuarioSel.uid), {
          codigoVerificacion: pinNuevo,
        });
        setUsuarioSel({ ...usuarioSel, codigoVerificacion: pinNuevo });
        resetPinInputs();
        setCreandoPin(false);

        // Si venimos de "Guardar" en ajuste, aplica de inmediato
        if (modo === "ajuste" && pendingAjuste) {
          setPendingAjuste(false);
          await applyAjuste();
          return;
        }

        // Si no, volver a cantidad
        setPaso("cantidad");
      } catch (e) {
        console.error(e);
        alert("No se pudo guardar el PIN. Intenta de nuevo.");
      }
      return;
    }

    // Validar PIN existente
    if ((usuarioSel.codigoVerificacion || "") !== pin) {
      alert("PIN incorrecto.");
      setPin("");
      return;
    }

    // PIN correcto
    if (modo === "ajuste" && pendingAjuste) {
      setPendingAjuste(false);
      await applyAjuste();
      return;
    }

    // Flujo normal
    setPaso("cantidad");
  };

  /* ---------- Confirmar acción ---------- */
  const handleConfirmar = async () => {
    if (!consumible) return;

    const n = Number(cant);

    if (modo === "retiro") {
      if (!proyectoSel || !usuarioSel) return;
      if (Number.isNaN(n) || n <= 0) {
        alert("Cantidad inválida.");
        return;
      }
      if (typeof consumible.cantidad === "number" && n > consumible.cantidad) {
        alert("No hay suficiente stock.");
        return;
      }

      try {
        // 1) Restar stock
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

        // 2) Movimiento: retiro
        const mov = {
          tipo: "retiro",
          consumibleTitulo: prev.titulo,
          consumibleIndex: index,
          proyecto: proyectoSel.nombre,
          userId: usuarioSel.uid,
          userName:
            usuarioSel.displayName ||
            [usuarioSel.nombre, usuarioSel.apellido].filter(Boolean).join(" ") ||
            "Usuario",
          cantidadTomada: n,
          cantidadAntes: prev.cantidad ?? null,
          cantidadDespues: nuevaCantidad,
          fecha: serverTimestamp(),
        };
        await addDoc(collection(db, "inventory_movements"), mov);

        alert("Retiro registrado.");
        router.push("/inventario/consumibles");
      } catch (e) {
        console.error(e);
        alert("No se pudo registrar el retiro.");
      }
    } else {
      // === AJUSTE ===
      // >>> CAMBIO: ya NO navegamos a seleccionar usuario/PIN por pasos.
      // Mostramos el modal de autenticación admin al guardar.
      if (Number.isNaN(n) || n < 0) {
        alert("Cantidad nueva inválida.");
        return;
      }
      setPendingCantidadAjuste(n);
      setAuthOpen(true);
    }
  };

  /* ---------- Handlers numpad para CANTIDAD ---------- */
  const handleCantidadDigit = (digit: string) => {
    if (digit === "." && !cant.includes(".")) {
      setCant(cant + ".");
    } else if (/^\d$/.test(digit)) {
      setCant(cant + digit);
    }
  };
  const handleCantidadBackspace = () => {
    if (cant.length > 0) setCant(cant.slice(0, -1));
  };

  /* ---------- UI ---------- */
  if (!isAdmin) {
    return (
      <div className="min-h-screen px-6 py-10 bg-gray-600">
        <div className="max-w-7xl mx-auto bg-white text-black rounded-2xl p-6">
          <div className="mb-6 flex items-center justify-between">
            <h1 className="text-xl font-bold">
              {modo === "ajuste" ? "Ajuste de inventario" : "Retirar consumible"}
            </h1>
            <button
              onClick={() => router.back()}
              className="bg-black text-white px-4 py-2 rounded hover:opacity-90"
            >
              ← Regresar
            </button>
          </div>
          <p className="text-sm text-gray-700">No tienes permisos para realizar esta acción.</p>
        </div>
      </div>
    );
  }

  if (loading || !consumible) {
    return (
      <div className="min-h-screen px-6 py-10 bg-gray-600">
        <div className="max-w-7xl mx-auto bg-white text-black rounded-2xl p-6">
          <div className="mb-6 flex items-center justify-between">
            <h1 className="text-xl font-bold">
              {modo === "ajuste" ? "Ajuste de inventario" : "Retirar consumible"}
            </h1>
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
          <h1 className="text-xl font-bold">
            {modo === "ajuste" ? "Ajuste de inventario" : "Retirar consumible"}
          </h1>
          <button
            onClick={() => router.back()}
            className="bg-black text-white px-4 py-2 rounded hover:opacity-90"
          >
            ← Regresar
          </button>
        </div>

        {/* Pasos */}
        {modo === "retiro" && paso === "proyecto" && (
          <PasoProyecto onSelect={handleSelectProyecto} />
        )}

        {/* Usuario (en retiro: todos; en ajuste: solo admins) */}
        {paso === "usuario" && modo === "retiro" && (
          <PasoUsuario usuarios={usuarios} onSelect={handleSelectUsuario} />
        )}

        {/* PIN (solo se usa en retiro; en ajuste ahora usamos modal) */}
        {paso === "pin" && modo === "retiro" && (
          <PasoPin
            creando={creandoPin}
            pin={pin}
            setPin={setPin}
            pinNuevo={pinNuevo}
            setPinNuevo={setPinNuevo}
            pinNuevo2={pinNuevo2}
            setPinNuevo2={setPinNuevo2}
            onBack={() => {
              resetPinInputs();
              setPaso("usuario");
            }}
            onNext={handleValidarPin}
          />
        )}

        {/* Cantidad */}
        {paso === "cantidad" && (
          <PasoCantidad
            modo={modo}
            consumible={consumible}
            proyecto={proyectoSel || null}
            usuario={
              usuarioSel || {
                uid: "",
                displayName:
                  modo === "ajuste" ? "(Se validará admin al guardar)" : "Usuario",
              }
            }
            cant={cant}
            setCant={setCant}
            onDigit={handleCantidadDigit}
            onBackspace={handleCantidadBackspace}
            onBack={() => {
              setCant("");
              if (modo === "retiro") {
                setPaso("pin");
              } else {
                // En ajuste ya no navegamos; permanecemos en cantidad
                router.back();
              }
            }}
            onConfirm={handleConfirmar}
          />
        )}
      </div>

      {/* >>> CAMBIO: Modal de autenticación admin para AJUSTE */}
      {authOpen && modo === "ajuste" && (
        <AdminAuthModal
          onClose={() => {
            setAuthOpen(false);
            setPendingCantidadAjuste(null);
          }}
          onSuccess={(adminConfirmado) => {
            // Guardamos admin seleccionado, fijamos cantidad y aplicamos
            setUsuarioSel(adminConfirmado);
            if (pendingCantidadAjuste != null) {
              setCant(String(pendingCantidadAjuste));
            }
            setAuthOpen(false);
            setPendingCantidadAjuste(null);
            // Aplica el ajuste con el admin validado
            applyAjuste();
          }}
        />
      )}
    </div>
  );
}

/* ---------------- Subcomponentes ---------------- */

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
      <h2 className="text-lg font-semibold mb-4">Selecciona la persona</h2>
      <div className="flex flex-wrap gap-4">
        {usuarios.map((u) => {
          const nombre =
            u.displayName || [u.nombre, u.apellido].filter(Boolean).join(" ") || "Usuario";
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

/* ----- PIN ----- */
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
  const [faseCreacion, setFaseCreacion] = useState<"pin1" | "pin2">("pin1");

  useEffect(() => {
    if (!creando) return;
    if (pinNuevo.length === 3 && faseCreacion === "pin1") {
      setFaseCreacion("pin2");
    }
  }, [creando, pinNuevo, faseCreacion]);

  const handleDigit = (d: string) => {
    if (creando) {
      if (faseCreacion === "pin1" && pinNuevo.length < 3) setPinNuevo(pinNuevo + d);
      if (faseCreacion === "pin2" && pinNuevo2.length < 3) setPinNuevo2(pinNuevo2 + d);
    } else {
      if (pin.length < 3) setPin(pin + d);
    }
  };

  const handleBackspace = () => {
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

  const display = creando ? (faseCreacion === "pin1" ? pinNuevo : pinNuevo2) : pin;

  return (
    <div>
      <h2 className="text-lg font-semibold mb-2">{label}</h2>

      <div className="flex gap-3 my-4">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className={`w-6 h-6 rounded-full border-2 ${
              display.length > i ? "bg-black border-black" : "border-gray-400"
            }`}
          />
        ))}
      </div>

      <Keypad onDigit={handleDigit} onBackspace={handleBackspace} />

      <div className="mt-6 flex justify-between">
        <button onClick={onBack} className="px-4 py-2 rounded border hover:bg-gray-50">
          ← Atrás
        </button>
        <button onClick={onNext} className="px-4 py-2 rounded bg-black text-white hover:opacity-90">
          Continuar
        </button>
      </div>
    </div>
  );
}

/* ----- Cantidad ----- */
function PasoCantidad({
  modo,
  consumible,
  proyecto,
  usuario,
  cant,
  setCant,
  onDigit,
  onBackspace,
  onBack,
  onConfirm,
}: {
  modo: "retiro" | "ajuste";
  consumible: Consumible;
  proyecto: { nombre: string; imagen: string } | null;
  usuario: PerfilUsuario;
  cant: string;
  setCant: (v: string) => void;
  onDigit: (d: string) => void;
  onBackspace: () => void;
  onBack: () => void;
  onConfirm: () => void;
}) {
  const nombreUsuario =
    usuario.displayName || [usuario.nombre, usuario.apellido].filter(Boolean).join(" ") || "Usuario";

  return (
    <div>
      <h2 className="text-lg font-semibold mb-4">
        {modo === "ajuste" ? "Indica la nueva cantidad" : "Indica la cantidad a retirar"}
      </h2>

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
              <div>
                <span className="font-semibold">Lugar:</span> {consumible.lugar || "—"}
              </div>
              <div>
                <span className="font-semibold">Cantidad actual:</span>{" "}
                {consumible.cantidad ?? "—"}
              </div>
            </div>

            {modo === "retiro" && proyecto && (
              <div className="mt-3 text-sm text-gray-700">
                Proyecto: <span className="font-medium">{proyecto.nombre}</span>
              </div>
            )}
            <div className="mt-1 text-sm text-gray-700">
              Usuario: <span className="font-medium">{nombreUsuario}</span>
            </div>
          </div>
        </div>

        {/* Derecha: input + keypad */}
        <div className="flex flex-col">
          <div className="mb-4">
            <label className="block text-sm text-gray-600 mb-1">
              {modo === "ajuste" ? "Nueva cantidad" : "Cantidad a retirar"}
            </label>
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
              placeholder={modo === "ajuste" ? String(consumible.cantidad ?? 0) : "0"}
            />
          </div>

          <Keypad onDigit={onDigit} onBackspace={onBackspace} />

          <div className="mt-6 flex justify-between">
            <button onClick={onBack} className="px-4 py-2 rounded border hover:bg-gray-50">
              ← Atrás
            </button>
            <button onClick={onConfirm} className="px-4 py-2 rounded bg-black text-white hover:opacity-90">
              {modo === "ajuste" ? "Guardar cantidad" : "Confirmar retiro"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------- Keypad genérico ---------- */
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

/* ========= Modal de autenticación admin (para AJUSTE) ========= */
// >>> CAMBIO: modal inspirado en tu referencia; devuelve el admin validado
function AdminAuthModal({
  onClose,
  onSuccess,
}: {
  onClose: () => void;
  onSuccess: (adminConfirmado: PerfilUsuario) => void;
}) {
  const [admins, setAdmins] = useState<PerfilUsuario[]>([]);
  const [loading, setLoading] = useState(true);
  const [adminSel, setAdminSel] = useState<PerfilUsuario | null>(null);
  const [creandoPin, setCreandoPin] = useState(false);
  const [pin, setPin] = useState("");
  const [pinNuevo, setPinNuevo] = useState("");
  const [pinNuevo2, setPinNuevo2] = useState("");

  useEffect(() => {
    const loadAdmins = async () => {
      try {
        const qAdmins = query(collection(db, "users"), where("role", "==", "admin"));
        const snap = await getDocs(qAdmins);
        const list = snap.docs
          .map((d) => {
            const raw = d.data() as any;
            const display =
              (raw.displayName as string) ||
              [raw?.nombre, raw?.apellido].filter(Boolean).join(" ") ||
              "Admin";
            return {
              uid: d.id,
              nombre: raw?.nombre,
              apellido: raw?.apellido,
              displayName: display,
              role: raw?.role,
              codigoVerificacion: raw?.codigoVerificacion ?? null,
            } as PerfilUsuario;
          })
          .sort((a, b) => (a.displayName || "").localeCompare(b.displayName || ""));
        setAdmins(list);
      } catch (e) {
        console.error(e);
        alert("No se pudieron cargar administradores.");
      } finally {
        setLoading(false);
      }
    };
    loadAdmins();
  }, []);

  const nombreAdmin = useMemo(() => {
    if (!adminSel) return "";
    return (
      adminSel.displayName ||
      [adminSel.nombre, adminSel.apellido].filter(Boolean).join(" ") ||
      "Admin"
    );
  }, [adminSel]);

  const onDigit = (d: string) => {
    if (creandoPin) {
      if (pinNuevo.length < 3) setPinNuevo(pinNuevo + d);
      else if (pinNuevo2.length < 3) setPinNuevo2(pinNuevo2 + d);
    } else {
      if (pin.length < 3) setPin(pin + d);
    }
  };
  const onBackspace = () => {
    if (creandoPin) {
      if (pinNuevo2.length > 0) setPinNuevo2(pinNuevo2.slice(0, -1));
      else if (pinNuevo.length > 0) setPinNuevo(pinNuevo.slice(0, -1));
    } else {
      if (pin.length > 0) setPin(pin.slice(0, -1));
    }
  };
  const resetPins = () => {
    setPin("");
    setPinNuevo("");
    setPinNuevo2("");
  };
  const handleSelectAdmin = (a: PerfilUsuario) => {
    setAdminSel(a);
    setCreandoPin(!a.codigoVerificacion);
    resetPins();
  };

  const handleConfirm = async () => {
    if (!adminSel) {
      alert("Selecciona un administrador.");
      return;
    }
    // Crear PIN si no tiene
    if (creandoPin) {
      if (pinNuevo.length !== 3 || pinNuevo2.length !== 3) {
        alert("El PIN debe tener 3 dígitos.");
        return;
      }
      if (pinNuevo !== pinNuevo2) {
        alert("Los PIN no coinciden.");
        resetPins();
        return;
      }
      try {
        await updateDoc(doc(db, "users", adminSel.uid), { codigoVerificacion: pinNuevo });
        const actualizado = { ...adminSel, codigoVerificacion: pinNuevo };
        setAdminSel(actualizado);
        setCreandoPin(false);
        resetPins();
        alert("PIN creado. Vuelve a ingresar para confirmar.");
        return;
      } catch (e) {
        console.error(e);
        alert("No se pudo guardar el PIN.");
        return;
      }
    }
    // Validar PIN existente
    if ((adminSel.codigoVerificacion || "") !== pin) {
      alert("PIN incorrecto.");
      setPin("");
      return;
    }
    // Éxito
    onSuccess(adminSel);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-white text-black rounded-2xl w-full max-w-2xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">Confirmar cambio de cantidad</h3>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full border flex items-center justify-center"
            title="Cerrar"
          >
            ×
          </button>
        </div>

        {loading ? (
          <p className="text-sm text-gray-600">Cargando administradores…</p>
        ) : (
          <>
            {/* Selección de admin */}
            <div>
              <p className="text-sm text-gray-700 mb-2">
                Selecciona el administrador que autoriza el cambio:
              </p>
              <div className="flex flex-wrap gap-4 mb-4">
                {admins.map((a) => {
                  const nombre =
                    a.displayName || [a.nombre, a.apellido].filter(Boolean).join(" ") || "Admin";
                  const active = adminSel?.uid === a.uid;
                  return (
                    <button
                      key={a.uid}
                      onClick={() => handleSelectAdmin(a)}
                      className={`flex flex-col items-center ${active ? "opacity-100" : "opacity-80"}`}
                      aria-label={nombre}
                      title={nombre}
                    >
                      <div
                        className={`w-16 h-16 rounded-full border flex items-center justify-center text-sm font-medium ${
                          active ? "bg-black text-white" : "bg-gray-200 text-black"
                        }`}
                      >
                        {nombre.slice(0, 2).toUpperCase()}
                      </div>
                      <div className="mt-2 text-xs text-center max-w-[6rem] truncate">{nombre}</div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* PIN */}
            {adminSel && (
              <div className="mt-2">
                <p className="text-sm font-medium mb-1">
                  {creandoPin
                    ? pinNuevo.length < 3
                      ? "Crea tu PIN (3 dígitos)"
                      : "Confirma tu PIN"
                    : `Ingresa el PIN de ${nombreAdmin}`}
                </p>
                {/* Indicador de dígitos */}
                <div className="flex gap-3 my-3">
                  {[0, 1, 2].map((i) => {
                    const display = creandoPin
                      ? pinNuevo.length < 3
                        ? pinNuevo
                        : pinNuevo2
                      : pin;
                    return (
                      <div
                        key={i}
                        className={`w-5 h-5 rounded-full border-2 ${
                          display.length > i ? "bg-black border-black" : "border-gray-400"
                        }`}
                      />
                    );
                  })}
                </div>
                <Keypad onDigit={onDigit} onBackspace={onBackspace} />
              </div>
            )}

            <div className="mt-6 flex justify-end gap-2">
              <button onClick={onClose} className="px-4 py-2 rounded border hover:bg-gray-50">
                Cancelar
              </button>
              <button
                onClick={handleConfirm}
                className="px-4 py-2 rounded bg-black text-white hover:opacity-90"
              >
                Confirmar
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
