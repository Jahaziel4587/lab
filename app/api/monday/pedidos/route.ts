import { NextRequest, NextResponse } from "next/server";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { adminAuth, adminDB } from "@/lib/firebaseAdmin";
import { createPedidoItem } from "@/lib/monday/createPedidoItem";
import {
  getAdminEmails,
  getDisplayNameForUid,
  sendPushToEmails,
} from "@/lib/pushNotifications";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function normalizeEmail(value: unknown) {
  return String(value || "")
    .trim()
    .toLowerCase();
}

function getDeadline(value: unknown): string | null {
  if (!value) return null;

  if (value instanceof Timestamp) {
    return value.toDate().toISOString().slice(0, 10);
  }

  if (
    typeof value === "object" &&
    value !== null &&
    "seconds" in value
  ) {
    const seconds = Number(
      (value as { seconds: unknown }).seconds,
    );

    if (Number.isFinite(seconds)) {
      return new Date(seconds * 1000)
        .toISOString()
        .slice(0, 10);
    }
  }

  const dateText = String(value).trim();
  if (!dateText) return null;

  const match = dateText.match(/^\d{4}-\d{2}-\d{2}/);
  return match ? match[0] : null;
}

export async function POST(request: NextRequest) {
  try {
    const authorization = request.headers.get("authorization");

    if (!authorization?.startsWith("Bearer ")) {
      return NextResponse.json(
        { error: "No autorizado: falta el token de Firebase" },
        { status: 401 },
      );
    }

    const decodedToken = await adminAuth.verifyIdToken(
      authorization.slice("Bearer ".length),
    );

    const body = await request.json();
    const pedidoId = String(body.pedidoId || "").trim();

    if (!pedidoId) {
      return NextResponse.json(
        { error: "Falta pedidoId" },
        { status: 400 },
      );
    }

    const pedidoRef = adminDB.collection("pedidos").doc(pedidoId);
    const pedidoSnapshot = await pedidoRef.get();

    if (!pedidoSnapshot.exists) {
      return NextResponse.json(
        { error: "El pedido no existe" },
        { status: 404 },
      );
    }

    const pedido = pedidoSnapshot.data();

    if (!pedido) {
      return NextResponse.json(
        { error: "No fue posible leer la información del pedido" },
        { status: 500 },
      );
    }

    if (pedido.monday?.itemId) {
      return NextResponse.json({
        ok: true,
        alreadySynced: true,
        itemId: pedido.monday.itemId,
        groupId: pedido.monday.groupId || null,
        mondayUserFound: pedido.monday.mondayUserFound ?? false,
      });
    }

    const correoPedido = normalizeEmail(
      pedido.correoUsuario ||
        pedido.correoSolicitante ||
        pedido.usuario ||
        pedido.email,
    );

    const correoToken = normalizeEmail(decodedToken.email);

    if (!correoToken) {
      return NextResponse.json(
        { error: "La sesión actual no contiene un correo electrónico" },
        { status: 403 },
      );
    }

    if (!correoPedido) {
      return NextResponse.json(
        { error: "El pedido no contiene el correo del solicitante" },
        { status: 400 },
      );
    }

    if (correoPedido !== correoToken) {
      return NextResponse.json(
        { error: "No tienes permiso para sincronizar este pedido" },
        { status: 403 },
      );
    }

    const urlProtolab = new URL(
      `/solicitudes/listado/${pedidoId}`,
      request.nextUrl.origin,
    ).toString();

    if (pedido.pushNotifications?.orderCreated !== true) {
      try {
        const adminEmails = await getAdminEmails();
        const senderName = await getDisplayNameForUid(
          decodedToken.uid,
          decodedToken.email,
        );
        const tituloPedido = String(
          pedido.titulo || `Pedido ${pedidoId}`,
        ).trim();
        const notificationBody = `${senderName}: ${tituloPedido}`;

        await sendPushToEmails({
          emails: adminEmails,
          title: "Nuevo pedido",
          body: notificationBody,
          url: urlProtolab,
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
      } catch (notificationError) {
        console.error(
          "El pedido se creó, pero no se pudo enviar la notificación push:",
          notificationError,
        );
      }
    }

    const result = await createPedidoItem({
      pedidoId,
      material: String(
        pedido.material ||
          pedido.materialSeleccionado ||
          pedido.especificaciones?.material ||
          "No especificado",
      ).trim(),
      titulo: String(
        pedido.titulo || `Pedido ${pedidoId}`,
      ).trim(),
      proyecto: String(
        pedido.proyecto || "Sin proyecto",
      ).trim(),
      correoSolicitante: correoPedido,
      fechaEntrega: getDeadline(
        pedido.fechaLimite || pedido.fechaEntrega || pedido.deadline,
      ),
      urlProtolab,
    });

    await pedidoRef.set(
      {
        monday: {
          itemId: result.item.id,
          itemName: result.item.name,
          boardId: process.env.MONDAY_SERVICIOS_BOARD_ID,
          groupId: result.groupId,
          mondayUserId: result.mondayUser?.id || null,
          mondayUserFound: Boolean(result.mondayUser),
          syncStatus: result.mondayUser
            ? "synced"
            : "synced_without_stakeholder",
          syncedAt: FieldValue.serverTimestamp(),
        },
      },
      { merge: true },
    );

    return NextResponse.json({
      ok: true,
      alreadySynced: false,
      itemId: result.item.id,
      itemName: result.item.name,
      groupId: result.groupId,
      mondayUserFound: Boolean(result.mondayUser),
    });
  } catch (error) {
    console.error("Error sincronizando el pedido con Monday:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "No se pudo sincronizar el pedido con Monday",
      },
      { status: 500 },
    );
  }
}
