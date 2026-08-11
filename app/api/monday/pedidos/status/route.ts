import {
  NextRequest,
  NextResponse,
} from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import {
  adminAuth,
  adminDB,
} from "@/lib/firebaseAdmin";
import {
  updatePedidoAndSubitemsToListo,
} from "@/lib/monday/updatePedidoStatus";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(
  request: NextRequest
) {
  try {
    const authorization =
      request.headers.get("authorization");

    if (
      !authorization?.startsWith("Bearer ")
    ) {
      return NextResponse.json(
        {
          error: "No autorizado",
        },
        {
          status: 401,
        }
      );
    }

    const idToken = authorization.slice(
      "Bearer ".length
    );

    const decodedToken =
      await adminAuth.verifyIdToken(idToken);

    if (decodedToken.admin !== true) {
      return NextResponse.json(
        {
          error:
            "Solo un administrador puede modificar el estado del pedido",
        },
        {
          status: 403,
        }
      );
    }

    const body = await request.json();

    const pedidoId = String(
      body.pedidoId || ""
    ).trim();

    const status = String(
      body.status || ""
    )
      .trim()
      .toLowerCase();

    if (!pedidoId) {
      return NextResponse.json(
        {
          error: "Falta pedidoId",
        },
        {
          status: 400,
        }
      );
    }

    /*
     * Por ahora este endpoint está dedicado
     * únicamente al cierre completo en Monday.
     */
    if (status !== "listo") {
      return NextResponse.json(
        {
          error:
            'Este endpoint solamente admite status: "listo"',
        },
        {
          status: 400,
        }
      );
    }

    const pedidoRef = adminDB
      .collection("pedidos")
      .doc(pedidoId);

    const pedidoSnapshot =
      await pedidoRef.get();

    if (!pedidoSnapshot.exists) {
      return NextResponse.json(
        {
          error: "El pedido no existe",
        },
        {
          status: 404,
        }
      );
    }

    const pedido =
      pedidoSnapshot.data();

    const mondayItemId = String(
      pedido?.monday?.itemId || ""
    ).trim();

    /*
     * Guardamos primero el estado en Firebase.
     */
    await pedidoRef.update({
      status: "listo",
      "monday.statusSyncStatus": "pending",
      "monday.statusSyncUpdatedAt":
        FieldValue.serverTimestamp(),
    });

    /*
     * Un pedido antiguo podría no tener vínculo
     * con Monday. El status queda guardado en
     * Protolab y se informa la falta de vínculo.
     */
    if (!mondayItemId) {
      await pedidoRef.update({
        "monday.statusSyncStatus": "error",
        "monday.statusSyncError":
          "El pedido no tiene una actividad vinculada en Monday",
      });

      return NextResponse.json(
        {
          error:
            "El pedido se marcó como Listo en Protolab, pero no tiene una actividad vinculada en Monday",
          savedInFirebase: true,
        },
        {
          status: 409,
        }
      );
    }

    try {
      const mondayResult =
        await updatePedidoAndSubitemsToListo(
          mondayItemId
        );

      await pedidoRef.update({
        "monday.statusSyncStatus": "synced",
        "monday.statusSyncedAt":
          FieldValue.serverTimestamp(),
        "monday.statusSyncError":
          FieldValue.delete(),
      });

      return NextResponse.json({
        ok: true,
        pedidoId,
        status: "listo",
        mondayItemId,
        updatedMainItem:
          mondayResult.updatedMainItem,
        updatedSubitems:
          mondayResult.updatedSubitems,
      });
    } catch (mondayError) {
      const message =
        mondayError instanceof Error
          ? mondayError.message
          : "Error desconocido de Monday";

      await pedidoRef.update({
        "monday.statusSyncStatus": "error",
        "monday.statusSyncError": message,
      });

      return NextResponse.json(
        {
          error:
            "El pedido se marcó como Listo en Protolab, pero no todos los estados pudieron actualizarse en Monday",
          details: message,
          savedInFirebase: true,
        },
        {
          status: 502,
        }
      );
    }
  } catch (error) {
    console.error(
      "Error actualizando el status en Monday:",
      error
    );

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "No se pudo actualizar el estado",
      },
      {
        status: 500,
      }
    );
  }
}