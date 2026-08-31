import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { adminAuth, adminDB } from "@/lib/firebaseAdmin";
import {
  getAdminEmails,
  getDisplayNameForUid,
  sendPushToEmails,
} from "@/lib/pushNotifications";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CHAT_ADMIN_EMAIL = "jahaziel4587@gmail.com";

function normalizeEmail(value: unknown) {
  return String(value || "").trim().toLowerCase();
}

export async function POST(request: NextRequest) {
  try {
    const authorization = request.headers.get("authorization");

    if (!authorization?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const decoded = await adminAuth.verifyIdToken(
      authorization.slice("Bearer ".length),
    );

    const body = await request.json();
    const type = String(body?.type || "").trim();
    const pedidoId = String(body?.pedidoId || "").trim();

    if (!pedidoId || !["chat_message", "order_created"].includes(type)) {
      return NextResponse.json({ error: "Solicitud inválida" }, { status: 400 });
    }

    const pedidoRef = adminDB.collection("pedidos").doc(pedidoId);
    const pedidoSnap = await pedidoRef.get();

    if (!pedidoSnap.exists) {
      return NextResponse.json({ error: "El pedido no existe" }, { status: 404 });
    }

    const pedido = pedidoSnap.data() as any;
    const ownerEmail = normalizeEmail(
      pedido?.correoUsuario ||
        pedido?.correoSolicitante ||
        pedido?.usuario ||
        pedido?.email,
    );
    const senderEmail = normalizeEmail(decoded.email);
    const isAdmin = decoded.admin === true;
    const titulo = String(pedido?.titulo || "Pedido").trim();
    const relativeUrl = `/solicitudes/listado/${pedidoId}`;
    const absoluteUrl = new URL(relativeUrl, request.nextUrl.origin).toString();
    const senderName = await getDisplayNameForUid(decoded.uid, decoded.email);

    if (type === "order_created") {
      if (!senderEmail || senderEmail !== ownerEmail) {
        return NextResponse.json({ error: "Sin permiso para este pedido" }, { status: 403 });
      }

      const alreadyNotified = pedido?.pushNotifications?.orderCreated === true;
      if (alreadyNotified) {
        return NextResponse.json({ ok: true, alreadyNotified: true });
      }

      const adminEmails = await getAdminEmails();
      const notificationBody = `${senderName}: ${titulo}`;

      const result = await sendPushToEmails({
        emails: adminEmails,
        title: "Nuevo pedido",
        body: notificationBody,
        url: absoluteUrl,
      });

      await Promise.all(
        adminEmails.map((email) =>
          adminDB.collection("notifications").add({
            userEmail: email,
            pedidoId,
            tipo: "pedido_nuevo_push",
            mensaje: notificationBody,
            createdAt: FieldValue.serverTimestamp(),
            leido: false,
          }),
        ),
      );

      await pedidoRef.set(
        {
          pushNotifications: {
            orderCreated: true,
            orderCreatedAt: FieldValue.serverTimestamp(),
          },
        },
        { merge: true },
      );

      return NextResponse.json({ ok: true, ...result });
    }

    const text = String(body?.message || "").trim();
    if (!text) {
      return NextResponse.json({ error: "Mensaje vacío" }, { status: 400 });
    }

    let recipientEmail = "";

    if (isAdmin) {
      recipientEmail = ownerEmail;
    } else {
      if (!senderEmail || senderEmail !== ownerEmail) {
        return NextResponse.json({ error: "Sin permiso para este chat" }, { status: 403 });
      }
      recipientEmail = CHAT_ADMIN_EMAIL;
    }

    if (!recipientEmail || recipientEmail === senderEmail) {
      return NextResponse.json({ ok: true, skipped: true });
    }

    const notificationBody = `${senderName}: ${text}`;

    const result = await sendPushToEmails({
      emails: [recipientEmail],
      title: titulo,
      body: notificationBody,
      url: absoluteUrl,
    });

    await adminDB.collection("notifications").add({
      userEmail: recipientEmail,
      pedidoId,
      tipo: "chat_push",
      mensaje: notificationBody,
      createdAt: FieldValue.serverTimestamp(),
      leido: false,
    });

    return NextResponse.json({ ok: true, recipientEmail, ...result });
  } catch (error) {
    console.error("[notifications/send] Error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "No se pudo enviar la notificación",
      },
      { status: 500 },
    );
  }
}
