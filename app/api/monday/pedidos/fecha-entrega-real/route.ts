import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { adminAuth, adminDB } from "@/lib/firebaseAdmin";
import { updatePedidoRealDeliveryDate } from "@/lib/monday/updatePedidoRealDeliveryDate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isValidDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

export async function PATCH(request: NextRequest) {
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

    /*
     * Solo los administradores pueden asignar
     * la fecha de entrega real.
     *
     * Esto supone que tu custom claim se llama "admin",
     * igual que en tu sistema de registro actual.
     */
    if (decodedToken.admin !== true) {
      return NextResponse.json(
        {
          error:
            "Solo un administrador puede modificar la fecha de entrega real",
        },
        { status: 403 },
      );
    }

    const body = await request.json();

    const pedidoId = String(
      body.pedidoId || "",
    ).trim();

    const fechaEntregaReal = String(
      body.fechaEntregaReal || "",
    ).trim();

    if (!pedidoId) {
      return NextResponse.json(
        { error: "Falta pedidoId" },
        { status: 400 },
      );
    }

    /*
     * Se permite una cadena vacía para poder
     * retirar una fecha asignada previamente.
     */
    if (
      fechaEntregaReal &&
      !isValidDate(fechaEntregaReal)
    ) {
      return NextResponse.json(
        {
          error:
            "fechaEntregaReal debe tener el formato YYYY-MM-DD",
        },
        { status: 400 },
      );
    }

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

    const mondayItemId = String(
      pedido?.monday?.itemId || "",
    ).trim();

    if (!mondayItemId) {
      return NextResponse.json(
        {
          error:
            "Este pedido todavía no tiene una actividad vinculada en Monday",
        },
        { status: 409 },
      );
    }

    /*
     * Firebase se actualiza aquí mismo para que
     * ambas plataformas conserven el mismo valor.
     */
    await pedidoRef.update({
      fechaEntregaReal,
      "monday.realDeliveryDateSyncStatus":
        "pending",
      "monday.realDeliveryDateSyncUpdatedAt":
        FieldValue.serverTimestamp(),
    });

    try {
      await updatePedidoRealDeliveryDate(
        mondayItemId,
        fechaEntregaReal,
      );

      await pedidoRef.update({
        "monday.realDeliveryDateSyncStatus":
          "synced",
        "monday.realDeliveryDateSyncedAt":
          FieldValue.serverTimestamp(),
        "monday.realDeliveryDateSyncError":
          FieldValue.delete(),
      });
    } catch (mondayError) {
      const message =
        mondayError instanceof Error
          ? mondayError.message
          : "Error desconocido de Monday";

      await pedidoRef.update({
        "monday.realDeliveryDateSyncStatus":
          "error",
        "monday.realDeliveryDateSyncError":
          message,
      });

      /*
       * La fecha permanece guardada en Firebase,
       * pero informamos que Monday no se actualizó.
       */
      return NextResponse.json(
        {
          error:
            "La fecha se guardó en Protolab, pero no pudo actualizarse en Monday",
          details: message,
          savedInFirebase: true,
        },
        { status: 502 },
      );
    }

    return NextResponse.json({
      ok: true,
      pedidoId,
      mondayItemId,
      fechaEntregaReal,
    });
  } catch (error) {
    console.error(
      "Error actualizando la fecha real en Monday:",
      error,
    );

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "No se pudo actualizar la fecha",
      },
      { status: 500 },
    );
  }
}