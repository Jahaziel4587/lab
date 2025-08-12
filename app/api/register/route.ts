// /app/api/register/route.ts
import { NextResponse } from "next/server";
import { adminAuth, adminDB } from "../../../lib/firebaseAdmin";

export async function POST(req: Request) {
  try {
    const { email, password, accessCode, nombre, apellido } = await req.json();

    if (!email || !password || !accessCode) {
      return NextResponse.json({ error: "Faltan campos" }, { status: 400 });
    }

    const isUserCode = accessCode === process.env.REGISTRATION_CODE_USER;
    const isAdminCode = accessCode === process.env.REGISTRATION_CODE_ADMIN;

    if (!isUserCode && !isAdminCode) {
      return NextResponse.json({ error: "Código inválido" }, { status: 403 });
    }

    // Crea el usuario en Firebase Authentication (lado servidor)
    const user = await adminAuth.createUser({ email, password });

    // Asigna el claim admin (true/false)
    await adminAuth.setCustomUserClaims(user.uid, { admin: !!isAdminCode });

    // (Opcional) Guarda perfil en Firestore para consultas simples
    await adminDB.collection("users").doc(user.uid).set({
      email,
      nombre,
  apellido,
      role: isAdminCode ? "admin" : "user",
      createdAt: new Date(),
    });

    return NextResponse.json({
      ok: true,
      uid: user.uid,
      role: isAdminCode ? "admin" : "user",
    });
  } catch (err: any) {
    // Si el correo ya existe, devolvemos un mensaje claro
    if (err?.errorInfo?.code === "auth/email-already-exists") {
      return NextResponse.json(
        { error: "El correo ya está registrado" },
        { status: 409 }
      );
    }
    console.error("[/api/register] error:", err);
    return NextResponse.json({ error: "Error creando usuario" }, { status: 500 });
  }
}
