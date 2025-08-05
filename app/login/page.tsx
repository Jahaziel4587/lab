"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "../../src/firebase/firebaseConfig";

export default function Login() {
  const router = useRouter();
  const [correo, setCorreo] = useState("");
  const [contrasena, setContrasena] = useState("");
  const [error, setError] = useState("");

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await signInWithEmailAndPassword(auth, correo, contrasena);
      router.push("/");
    } catch (err) {
      setError("Correo o contraseña incorrectos");
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
      <form className="bg-black bg-opacity-70 p-8 rounded shadow-md w-full max-w-sm" onSubmit={handleLogin}>
        <h2 className="text-2xl mb-4 font-bold text-center text-white">Iniciar sesión</h2>
        <input
          type="email"
          placeholder="Correo"
          value={correo}
          onChange={(e) => setCorreo(e.target.value)}
          className="w-full p-2 mb-4 border rounded bg-gray-100 text-black"
        />
        <input
          type="password"
          placeholder="Contraseña"
          value={contrasena}
          onChange={(e) => setContrasena(e.target.value)}
          className="w-full p-2 mb-4 border rounded bg-gray-100 text-black"
        />
        <button
          type="submit"
          className="bg-white text-black px-4 py-2 rounded w-full hover:bg-gray-200"
        >
          Entrar
        </button>
        {error && <p className="text-red-500 mt-2">{error}</p>}
      </form>
    </div>
  );
}
