import { NextRequest, NextResponse } from "next/server";
import { createHash } from "crypto";
import { FieldValue } from "firebase-admin/firestore";
import { adminAuth, adminDB } from "@/lib/firebaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function getAuthenticatedUser(request: NextRequest) {
  const authorization = request.headers.get("authorization");

  if (!authorization?.startsWith("Bearer ")) {
    return null;
  }

  const idToken = authorization.slice("Bearer ".length);
  return adminAuth.verifyIdToken(idToken);
}

function getDeviceReference(token: string) {
  const deviceId = createHash("sha256")
    .update(token)
    .digest("hex");

  return adminDB.collection("push_devices").doc(deviceId);
}

async function readToken(request: NextRequest) {
  const body = await request.json();
  const token = body?.token;

  if (
    typeof token !== "string" ||
    token.length < 50 ||
    token.length > 4096
  ) {
    return null;
  }

  return token;
}

export async function POST(request: NextRequest) {
  try {
    const decodedToken = await getAuthenticatedUser(request);

    if (!decodedToken) {
      return NextResponse.json(
        { error: "No autorizado" },
        { status: 401 },
      );
    }

    const token = await readToken(request);

    if (!token) {
      return NextResponse.json(
        { error: "Token inválido" },
        { status: 400 },
      );
    }

    const deviceRef = getDeviceReference(token);

    const existingDevice =
      await deviceRef.get();

    const deviceData: Record<string, unknown> = {
      token,
      uid: decodedToken.uid,
      email: decodedToken.email ?? null,
      platform: "web",
      active: true,
      userAgent:
        request.headers.get("user-agent") ?? "",
      updatedAt: FieldValue.serverTimestamp(),
    };

    if (!existingDevice.exists) {
      deviceData.createdAt =
        FieldValue.serverTimestamp();
    }

    await deviceRef.set(deviceData, {
      merge: true,
    });

    return NextResponse.json({
      ok: true,
    });
  } catch (error) {
    console.error(
      "[register-device] Error:",
      error,
    );

    return NextResponse.json(
      {
        error:
          "No se pudo registrar el dispositivo",
      },
      { status: 500 },
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const decodedToken = await getAuthenticatedUser(request);

    if (!decodedToken) {
      return NextResponse.json(
        { error: "No autorizado" },
        { status: 401 },
      );
    }

    const token = await readToken(request);

    if (!token) {
      return NextResponse.json(
        { error: "Token inválido" },
        { status: 400 },
      );
    }

    const deviceRef = getDeviceReference(token);
    const existingDevice = await deviceRef.get();

    // Una sesión anterior no debe desactivar el dispositivo si ya fue
    // reasignado a otra cuenta.
    if (
      existingDevice.exists &&
      existingDevice.data()?.uid === decodedToken.uid
    ) {
      await deviceRef.set(
        {
          active: false,
          uid: FieldValue.delete(),
          email: FieldValue.delete(),
          deactivatedAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true },
      );
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[register-device] Error al desvincular:", error);

    return NextResponse.json(
      { error: "No se pudo desvincular el dispositivo" },
      { status: 500 },
    );
  }
}
