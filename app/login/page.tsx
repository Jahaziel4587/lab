"use client";

import React, { useState } from "react";
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
        body: JSON.stringify({
          email: correo,
          password: contrasena,
          accessCode: codigo,
          nombre,
          apellido,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Error de registro");

      await signInWithEmailAndPassword(auth, correo, contrasena);
      await auth.currentUser?.getIdToken(true);

      router.push("/");
    } catch (e: any) {
      setError(e?.message || "No se pudo registrar");
    } finally {
      setCargando(false);
    }
  };

  const title = modo === "login" ? "Sign in" : "Create account";
  const subtitle =
    modo === "login"
      ? "Access your orders, files, and project tracking."
      : "Register using your access code to join the platform.";

  return (
    <div
      className="min-h-screen flex items-center justify-center px-6 py-12 text-white relative overflow-hidden"
      style={{
        backgroundImage: "url('/fondo-bioana.jpg')",
        backgroundSize: "cover",
        backgroundPosition: "center",
      }}
    >
      {/* Overlay oscuro + degradado sutil (estilo pro como tu Home) */}
      <div className="absolute inset-0 bg-black/70" />
      <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-black/70 to-black/90" />

      <main className="relative w-full max-w-md">
        {/* Card glass */}
        <div className="rounded-3xl border border-white/10 bg-white/[0.04] backdrop-blur-xl shadow-[0_20px_80px_-40px_rgba(0,0,0,0.85)] p-6 sm:p-7">
          <div className="text-center">
            <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight">
              {title}
            </h2>
            <p className="mt-2 text-sm text-white/70 leading-relaxed">
              {subtitle}
            </p>
          </div>

          <form
            onSubmit={modo === "login" ? handleLogin : handleRegister}
            className="mt-6 space-y-4"
          >
            {/* Email */}
            <div>
              <label className="block text-xs font-medium text-white/60 mb-2">
                Email
              </label>
              <input
                type="email"
                placeholder="name@bioana.com"
                value={correo}
                onChange={(e) => setCorreo(e.target.value)}
                className="w-full h-12 rounded-2xl px-4
                  border border-white/10 bg-white/[0.03] text-white placeholder:text-white/40
                  outline-none focus:ring-2 focus:ring-emerald-400/40 focus:border-white/20
                  transition"
                required
              />
            </div>

            {/* Password */}
            <div>
              <label className="block text-xs font-medium text-white/60 mb-2">
                Password
              </label>
              <input
                type="password"
                placeholder="••••••••"
                value={contrasena}
                onChange={(e) => setContrasena(e.target.value)}
                className="w-full h-12 rounded-2xl px-4
                  border border-white/10 bg-white/[0.03] text-white placeholder:text-white/40
                  outline-none focus:ring-2 focus:ring-emerald-400/40 focus:border-white/20
                  transition"
                required
              />
            </div>

            {/* Register-only fields */}
            {modo === "register" && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-white/60 mb-2">
                      Name
                    </label>
                    <input
                      type="text"
                      placeholder="Issac"
                      value={nombre}
                      onChange={(e) => setNombre(e.target.value)}
                      className="w-full h-12 rounded-2xl px-4
                        border border-white/10 bg-white/[0.03] text-white placeholder:text-white/40
                        outline-none focus:ring-2 focus:ring-emerald-400/40 focus:border-white/20
                        transition"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-white/60 mb-2">
                      Last name
                    </label>
                    <input
                      type="text"
                      placeholder="Newton"
                      value={apellido}
                      onChange={(e) => setApellido(e.target.value)}
                      className="w-full h-12 rounded-2xl px-4
                        border border-white/10 bg-white/[0.03] text-white placeholder:text-white/40
                        outline-none focus:ring-2 focus:ring-emerald-400/40 focus:border-white/20
                        transition"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-white/60 mb-2">
                    Access code
                  </label>
                  <input
                    type="text"
                    placeholder="Enter your registration code"
                    value={codigo}
                    onChange={(e) => setCodigo(e.target.value)}
                    className="w-full h-12 rounded-2xl px-4
                      border border-white/10 bg-white/[0.03] text-white placeholder:text-white/40
                      outline-none focus:ring-2 focus:ring-emerald-400/40 focus:border-white/20
                      transition"
                    required
                  />
                </div>
              </div>
            )}

            {/* Error */}
            {error && (
              <div className="rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                {error}
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={cargando}
              className="w-full h-14 rounded-2xl font-semibold text-lg
                bg-gradient-to-r from-emerald-400 to-teal-500 text-black
                shadow-[0_18px_50px_-20px_rgba(45,212,191,0.6)]
                hover:brightness-110 hover:-translate-y-[1px] transition
                disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:translate-y-0"
            >
              {cargando
                ? modo === "login"
                  ? "Signing in..."
                  : "Creating..."
                : modo === "login"
                ? "Sign in"
                : "Create account"}
            </button>

            {/* Switch mode */}
            <button
              type="button"
              onClick={() => {
                setError("");
                setModo(modo === "login" ? "register" : "login");
              }}
              className="w-full rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3
                text-sm text-white/80 hover:bg-white/[0.06] transition"
            >
              {modo === "login"
                ? "Create a new account"
                : "Already have an account? Sign in"}
            </button>

            {/* Hint */}
            <p className="text-center text-xs text-white/50">
              {modo === "login"
                ? "If you don’t have access, request a registration code."
                : "Use your provided access code to register."}
            </p>
          </form>
        </div>

        {/* Footer mini */}
        <p className="mt-6 text-center text-xs text-white/40">
          Bioana · Prototyping Lab Platform
        </p>
      </main>
    </div>
  );
}
