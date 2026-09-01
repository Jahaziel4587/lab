import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminDB } from "@/lib/firebaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type NotificationOrigin = "notifications" | "notifications_admin";

type NotificationItem = {
  id?: string;
  origen?: NotificationOrigin;
};

function normalizeEmail(value: unknown) {
  return String(value || "").trim().toLowerCase();
}

export async function POST(request: NextRequest) {
  try {
    const authorization = request.headers.get("authorization");

    if (!authorization?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const decodedToken = await adminAuth.verifyIdToken(
      authorization.slice("Bearer ".length),
    );

    const userEmail = normalizeEmail(decodedToken.email);
    if (!userEmail) {
      return NextResponse.json(
        { error: "La cuenta no tiene un correo válido" },
        { status: 400 },
      );
    }

    const body = await request.json().catch(() => ({}));
    const rawItems = Array.isArray(body?.items) ? body.items : [];

    const items: Array<{ id: string; origen: NotificationOrigin }> = rawItems
      .filter(
        (item: NotificationItem) =>
          typeof item?.id === "string" &&
          item.id.trim() &&
          (item.origen === "notifications" ||
            item.origen === "notifications_admin"),
      )
      .map((item: NotificationItem) => ({
        id: item.id!.trim(),
        origen: item.origen!,
      }));

    if (items.length === 0) {
      return NextResponse.json({ ok: true, deleted: 0 });
    }

    if (items.length > 1000) {
      return NextResponse.json(
        { error: "Demasiadas notificaciones en una sola solicitud" },
        { status: 400 },
      );
    }

    const userItems = items.filter((item) => item.origen === "notifications");
    const adminItems = items.filter(
      (item) => item.origen === "notifications_admin",
    );

    if (adminItems.length > 0 && decodedToken.admin !== true) {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    const refsToDelete: FirebaseFirestore.DocumentReference[] = [];

    if (userItems.length > 0) {
      const refs = userItems.map((item) =>
        adminDB.collection("notifications").doc(item.id),
      );
      const snapshots = await adminDB.getAll(...refs);

      for (const snapshot of snapshots) {
        if (!snapshot.exists) continue;

        const recipientEmail = normalizeEmail(snapshot.data()?.userEmail);
        if (recipientEmail === userEmail) {
          refsToDelete.push(snapshot.ref);
        }
      }
    }

    if (adminItems.length > 0) {
      for (const item of adminItems) {
        refsToDelete.push(
          adminDB.collection("notifications_admin").doc(item.id),
        );
      }
    }

    for (let index = 0; index < refsToDelete.length; index += 450) {
      const batch = adminDB.batch();
      for (const ref of refsToDelete.slice(index, index + 450)) {
        batch.delete(ref);
      }
      await batch.commit();
    }

    return NextResponse.json({ ok: true, deleted: refsToDelete.length });
  } catch (error) {
    console.error("Error limpiando notificaciones:", error);
    return NextResponse.json(
      { error: "No fue posible limpiar las notificaciones" },
      { status: 500 },
    );
  }
}
