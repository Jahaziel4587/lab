import { NextRequest, NextResponse } from "next/server";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { adminAuth, adminDB } from "@/lib/firebaseAdmin";
import { createPedidoItem } from "@/lib/monday/createPedidoItem";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function normalizeEmail(value: unknown) {
  return String(value || "")
    .trim()
    .toLowerCase();
}

function getDeadline(value: unknown): string | null {
  if (!value) {
    return null;
  }

  /*
   * Si Firebase guardó la fecha como Timestamp.
   */
  if (value instanceof Timestamp) {
    return value.toDate().toISOString().slice(0, 10);
  }

  /*
   * También acepta objetos Timestamp recuperados
   * con una estructura similar a { seconds }.
   */
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

  /*
   * Si ya está guardada como YYYY-MM-DD,
   * conservamos solamente esa parte.
   */
  const dateText = String(value).trim();

  if (!dateText) {
    return null;
  }

  const match = dateText.match(/^\d{4}-\d{2}-\d{2}/);

  return match ? match[0] : null;
}

export async function POST(request: NextRequest) {
  try {
    /*
     * 1. Verificar que la petición provenga
     * de una sesión válida de Firebase.
     */
    const authorization =
      request.headers.get("authorization");

    if (!authorization?.startsWith("Bearer ")) {
      return NextResponse.json(
        {
          error:
            "No autorizado: falta el token de Firebase",
        },
        { status: 401 },
      );
    }

    const idToken = authorization.slice(
      "Bearer ".length,
    );

    const decodedToken =
      await adminAuth.verifyIdToken(idToken);

    /*
     * 2. Obtener el ID del pedido enviado por el formulario.
     */
    const body = await request.json();

    const pedidoId = String(
      body.pedidoId || "",
    ).trim();

    if (!pedidoId) {
      return NextResponse.json(
        { error: "Falta pedidoId" },
        { status: 400 },
      );
    }

    /*
     * 3. Buscar el pedido en Firebase.
     */
    const pedidoRef = adminDB
      .collection("pedidos")
      .doc(pedidoId);

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
        {
          error:
            "No fue posible leer la información del pedido",
        },
        { status: 500 },
      );
    }

    /*
     * 4. Evitar duplicar un pedido que ya fue
     * enviado anteriormente a Monday.
     */
    if (pedido.monday?.itemId) {
      return NextResponse.json({
        ok: true,
        alreadySynced: true,
        itemId: pedido.monday.itemId,
        groupId: pedido.monday.groupId || null,
        mondayUserFound:
          pedido.monday.mondayUserFound ?? false,
      });
    }

    /*
     * 5. Obtener y comparar el correo del solicitante.
     */
    const correoPedido = normalizeEmail(
      pedido.correoUsuario ||
        pedido.correoSolicitante ||
        pedido.usuario ||
        pedido.email,
    );

    const correoToken = normalizeEmail(
      decodedToken.email,
    );

    if (!correoToken) {
      return NextResponse.json(
        {
          error:
            "La sesión actual no contiene un correo electrónico",
        },
        { status: 403 },
      );
    }

    if (!correoPedido) {
      return NextResponse.json(
        {
          error:
            "El pedido no contiene el correo del solicitante",
        },
        { status: 400 },
      );
    }

    if (correoPedido !== correoToken) {
      return NextResponse.json(
        {
          error:
            "No tienes permiso para sincronizar este pedido",
        },
        { status: 403 },
      );
    }

    /*
     * 6. Construir el enlace directo al detalle
     * del pedido en Protolab.
     */
    const urlProtolab = new URL(
      `/solicitudes/listado/${pedidoId}`,
      request.nextUrl.origin,
    ).toString();

    /*
     * 7. Crear el elemento en Monday.
     *
     * El grupo se identifica con el título.
     * El solicitante se coloca solo en Stakeholder.
     */
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
        pedido.fechaLimite ||
          pedido.fechaEntrega ||
          pedido.deadline,
          
      ),
      urlProtolab,
    });

    /*
     * 8. Guardar en Firebase el resultado
     * de la sincronización.
     */
    await pedidoRef.set(
      {
        monday: {
          itemId: result.item.id,
          itemName: result.item.name,
          boardId:
            process.env.MONDAY_SERVICIOS_BOARD_ID,
          groupId: result.groupId,
          mondayUserId:
            result.mondayUser?.id || null,
          mondayUserFound: Boolean(
            result.mondayUser,
          ),
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
      mondayUserFound: Boolean(
        result.mondayUser,
      ),
    });
  } catch (error) {
    console.error(
      "Error sincronizando el pedido con Monday:",
      error,
    );

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