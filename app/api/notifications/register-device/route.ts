import { NextRequest, NextResponse } from "next/server";
import { createHash } from "crypto";
import { FieldValue } from "firebase-admin/firestore";
import { adminAuth, adminDB } from "@/lib/firebaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const authorization =
      request.headers.get("authorization");

    if (!authorization?.startsWith("Bearer ")) {
      return NextResponse.json(
        { error: "No autorizado" },
        { status: 401 },
      );
    }

    const idToken = authorization.slice(
      "Bearer ".length,
    );

    const decodedToken =
      await adminAuth.verifyIdToken(idToken);

    const body = await request.json();
    const token = body?.token;

    if (
      typeof token !== "string" ||
      token.length < 50 ||
      token.length > 4096
    ) {
      return NextResponse.json(
        { error: "Token inválido" },
        { status: 400 },
      );
    }

    const deviceId = createHash("sha256")
      .update(token)
      .digest("hex");

    const deviceRef = adminDB
      .collection("push_devices")
      .doc(deviceId);

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