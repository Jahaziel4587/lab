"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "../../src/firebase/firebaseConfig";

export default function Login() {
  const router = useRouter();
  const [modo, setModo] = useState<"login" | "register">("login");
  const [correo, setCorreo] = useState("");
  const [contrasena, setContrasena] = useState("");
  const [codigo, setCodigo] = useState("");
  const [error, setError] = useState("");
  const [cargando, setCargando] = useState(false);
  const [nombre, setNombre] = useState("");
  const [apellido, setApellido] = useState("");

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setCargando(true);
    try {
      await signInWithEmailAndPassword(auth, correo, contrasena);
      router.push("/");
    } catch {
      setError("Correo o contraseña incorrectos");
    } finally {
      setCargando(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setCargando(true);
    try {
      const res = await fetch("/api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: correo, password: contrasena, accessCode: codigo,nombre,
  apellido, }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Error de registro");

      await signInWithEmailAndPassword(auth, correo, contrasena);
      await auth.currentUser?.getIdToken(true);

      router.push("/");
    } catch (e: any) {
      setError(e.message || "No se pudo registrar");
    } finally {
      setCargando(false);
    }
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center px-6"
      style={{
        backgroundImage: "url('/fondo-bioana.jpg')",
        backgroundSize: "cover",
        backgroundPosition: "center",
      }}
    >
      <div className="bg-black bg-opacity-70 p-8 rounded shadow-md w-full max-w-sm">
        <h2 className="text-2xl mb-4 font-bold text-center text-white">
          {modo === "login" ? "Iniciar sesión" : "Crear cuenta"}
        </h2>

        <form onSubmit={modo === "login" ? handleLogin : handleRegister}>
          <input
            type="email"
            placeholder="Correo"
            value={correo}
            onChange={(e) => setCorreo(e.target.value)}
            className="w-full p-2 mb-4 border rounded bg-gray-100 text-black"
            required
          />
          <input
            type="password"
            placeholder="Contraseña"
            value={contrasena}
            onChange={(e) => setContrasena(e.target.value)}
            className="w-full p-2 mb-4 border rounded bg-gray-100 text-black"
            required
          />
          {modo === "register" && (
  <>
    <input
      type="text"
      placeholder="Nombre"
      value={nombre}
      onChange={(e) => setNombre(e.target.value)}
      className="w-full p-2 mb-4 border rounded bg-gray-100 text-black"
      required
    />
    <input
      type="text"
      placeholder="Apellido"
      value={apellido}
      onChange={(e) => setApellido(e.target.value)}
      className="w-full p-2 mb-4 border rounded bg-gray-100 text-black"
      required
    />
    <input
      type="text"
      placeholder="Código de registro"
      value={codigo}
      onChange={(e) => setCodigo(e.target.value)}
      className="w-full p-2 mb-4 border rounded bg-gray-100 text-black"
      required
    />
  </>
)}
          <button
            type="submit"
            disabled={cargando}
            className="bg-white text-black px-4 py-2 rounded w-full hover:bg-gray-200"
          >
            {cargando
              ? modo === "login"
                ? "Entrando..."
                : "Creando..."
              : modo === "login"
              ? "Entrar"
              : "Crear cuenta"}
          </button>
        </form>

        {error && <p className="text-red-500 mt-2">{error}</p>}

        {/* Link para cambiar de modo */}
        <p
          onClick={() => setModo(modo === "login" ? "register" : "login")}
          className="mt-4 text-center text-white underline cursor-pointer"
        >
          {modo === "login"
            ? "Crear cuenta nueva"
            : "¿Ya tienes cuenta? Inicia sesión"}
        </p>
      </div>
    </div>
  );
}
