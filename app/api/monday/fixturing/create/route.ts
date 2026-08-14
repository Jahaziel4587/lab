import {
  NextRequest,
  NextResponse,
} from "next/server";
import {
  FieldValue,
  Timestamp,
} from "firebase-admin/firestore";
import {
  adminAuth,
  adminDB,
} from "@/lib/firebaseAdmin";
import {
  createFixturingStructure,
} from "@/lib/monday/createFixturingStructure";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function normalizeEmail(value: unknown) {
  return String(value || "")
    .trim()
    .toLowerCase();
}

function getDate(
  value: unknown
): string | null {
  if (!value) {
    return null;
  }

  if (value instanceof Timestamp) {
    return value
      .toDate()
      .toISOString()
      .slice(0, 10);
  }

  if (
    typeof value === "object" &&
    value !== null &&
    "seconds" in value
  ) {
    const seconds = Number(
      (
        value as {
          seconds: unknown;
        }
      ).seconds
    );

    if (Number.isFinite(seconds)) {
      return new Date(seconds * 1000)
        .toISOString()
        .slice(0, 10);
    }
  }

  const text = String(value).trim();

  const match = text.match(
    /^\d{4}-\d{2}-\d{2}/
  );

  return match ? match[0] : null;
}

export async function POST(
  request: NextRequest
) {
  let pedidoId = "";

  try {
    /*
     * 1. Validar la sesión de Firebase.
     */
    const authorization =
      request.headers.get("authorization");

    if (
      !authorization?.startsWith("Bearer ")
    ) {
      return NextResponse.json(
        {
          error:
            "No autorizado: falta el token de Firebase",
        },
        {
          status: 401,
        }
      );
    }

    const idToken =
      authorization.slice(
        "Bearer ".length
      );

    const decodedToken =
      await adminAuth.verifyIdToken(
        idToken
      );

    /*
     * 2. Leer el ID enviado por el formulario.
     */
    const body = await request.json();

    pedidoId = String(
      body.pedidoId || ""
    ).trim();

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
     * 3. Buscar el fixture.
     */
    const pedidoRef = adminDB
      .collection("pedidos")
      .doc(pedidoId);

    const pedidoSnapshot =
      await pedidoRef.get();

    if (!pedidoSnapshot.exists) {
      return NextResponse.json(
        {
          error:
            "El pedido de fixture no existe",
        },
        {
          status: 404,
        }
      );
    }

    const pedido =
      pedidoSnapshot.data();

    if (!pedido) {
      return NextResponse.json(
        {
          error:
            "No fue posible leer el fixture",
        },
        {
          status: 500,
        }
      );
    }

    if (
      pedido.tipoPedido !== "fixture"
    ) {
      return NextResponse.json(
        {
          error:
            "El pedido no es de tipo fixture",
        },
        {
          status: 400,
        }
      );
    }

    /*
     * 4. Evitar crear dos veces la estructura.
     */
    if (
      pedido.mondayFixturing?.groupId
    ) {
      return NextResponse.json({
        ok: true,
        alreadySynced: true,
        groupId:
          pedido.mondayFixturing.groupId,
        phases:
          pedido.mondayFixturing.phases ||
          {},
      });
    }

    if (
      pedido.mondayFixturing
        ?.syncStatus === "syncing"
    ) {
      return NextResponse.json(
        {
          error:
            "La estructura de Monday ya se está creando",
        },
        {
          status: 409,
        }
      );
    }

    /*
     * 5. Verificar que quien llama sea
     * el solicitante del fixture.
     */
    const correoPedido =
      normalizeEmail(
        pedido.correoUsuario ||
          pedido.correoSolicitante ||
          pedido.usuario ||
          pedido.email
      );

    const correoToken =
      normalizeEmail(
        decodedToken.email
      );

    if (!correoToken) {
      return NextResponse.json(
        {
          error:
            "La sesión no contiene un correo electrónico",
        },
        {
          status: 403,
        }
      );
    }

    if (!correoPedido) {
      return NextResponse.json(
        {
          error:
            "El fixture no contiene el correo del solicitante",
        },
        {
          status: 400,
        }
      );
    }

    if (
      correoPedido !== correoToken
    ) {
      return NextResponse.json(
        {
          error:
            "No tienes permiso para sincronizar este fixture",
        },
        {
          status: 403,
        }
      );
    }

    /*
     * 6. Marcar la sincronización como iniciada.
     */
    await pedidoRef.set(
      {
        mondayFixturing: {
          syncStatus: "syncing",
          syncStartedAt:
            FieldValue.serverTimestamp(),
        },
      },
      {
        merge: true,
      }
    );

    /*
     * 7. Preparar la información.
     */
    const titulo = String(
      pedido.titulo ||
        `Fixture ${pedidoId}`
    ).trim();

    const fechaLimite =
      getDate(
        pedido.fixtureSolicitud
          ?.inputs
          ?.fechaLimiteEntrega
      ) ||
      getDate(
        pedido.fechaLimite
      );

    const urlProtolab = new URL(
      `/solicitudes/listado/${pedidoId}`,
      request.nextUrl.origin
    ).toString();

    /*
     * 8. Crear grupo, actividades
     * y subactividades en Monday.
     */
    const result =
      await createFixturingStructure({
        pedidoId,
        titulo,
        correoSolicitante:
          correoPedido,
        fechaLimite,
        urlProtolab,
      });

    /*
     * 9. Guardar todos los IDs.
     */
    await pedidoRef.set(
      {
        mondayFixturing: {
          boardId: result.boardId,
          groupId: result.groupId,
          groupTitle:
            result.groupTitle,

          mondayUserId:
            result.mondayUser?.id ||
            null,
          mondayUserFound:
            Boolean(
              result.mondayUser
            ),

          phases: result.phases,

          syncStatus:
            result.mondayUser
              ? "synced"
              : "synced_without_stakeholder",

          syncError:
            FieldValue.delete(),

          syncedAt:
            FieldValue.serverTimestamp(),
        },
      },
      {
        merge: true,
      }
    );

    return NextResponse.json({
      ok: true,
      alreadySynced: false,
      boardId: result.boardId,
      groupId: result.groupId,
      groupTitle:
        result.groupTitle,
      phases: result.phases,
      mondayUserFound:
        Boolean(result.mondayUser),
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "No se pudo crear la estructura del fixture en Monday";

    console.error(
      "Error creando fixture en Monday:",
      error
    );

    /*
     * Si ya conocemos el pedido,
     * registramos el error para diagnóstico.
     */
    if (pedidoId) {
      try {
        await adminDB
          .collection("pedidos")
          .doc(pedidoId)
          .set(
            {
              mondayFixturing: {
                syncStatus: "error",
                syncError: message,
                syncFailedAt:
                  FieldValue.serverTimestamp(),
              },
            },
            {
              merge: true,
            }
          );
      } catch (firebaseError) {
        console.error(
          "No se pudo guardar el error de Monday:",
          firebaseError
        );
      }
    }

    return NextResponse.json(
      {
        error: message,
      },
      {
        status: 500,
      }
    );
  }
}