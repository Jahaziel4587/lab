import {
  NextRequest,
  NextResponse,
} from "next/server";
import {
  FieldValue,
} from "firebase-admin/firestore";
import {
  adminAuth,
  adminDB,
} from "@/lib/firebaseAdmin";
import {
  completeConceptApprovalSubitem,
  createConceptApprovalSubitem,
  updateConceptPhaseStatus,
} from "@/lib/monday/syncFixturingConcept";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function normalizeEmail(value: unknown) {
  return String(value || "")
    .trim()
    .toLowerCase();
}

export async function POST(
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

    const idToken =
      authorization.slice(
        "Bearer ".length
      );

    const decodedToken =
      await adminAuth.verifyIdToken(
        idToken
      );

    const body = await request.json();

    const pedidoId = String(
      body.pedidoId || ""
    ).trim();

    const versionId = String(
      body.versionId || ""
    ).trim();

    const action = String(
      body.action || ""
    ).trim();

    if (!pedidoId || !versionId) {
      return NextResponse.json(
        {
          error:
            "Faltan pedidoId o versionId",
        },
        {
          status: 400,
        }
      );
    }

    if (
      action !== "version_created" &&
      action !== "decision_recorded"
    ) {
      return NextResponse.json(
        {
          error:
            "La acción de sincronización no es válida",
        },
        {
          status: 400,
        }
      );
    }

    const pedidoRef = adminDB
      .collection("pedidos")
      .doc(pedidoId);

    const versionRef = pedidoRef
      .collection("fixture_conceptos")
      .doc(versionId);

    const [
      pedidoSnapshot,
      versionSnapshot,
    ] = await Promise.all([
      pedidoRef.get(),
      versionRef.get(),
    ]);

    if (!pedidoSnapshot.exists) {
      return NextResponse.json(
        {
          error:
            "El fixture no existe",
        },
        {
          status: 404,
        }
      );
    }

    if (!versionSnapshot.exists) {
      return NextResponse.json(
        {
          error:
            "La versión de concepto no existe",
        },
        {
          status: 404,
        }
      );
    }

    const pedido =
      pedidoSnapshot.data();

    const version =
      versionSnapshot.data();

    if (!pedido || !version) {
      return NextResponse.json(
        {
          error:
            "No fue posible leer la información del concepto",
        },
        {
          status: 500,
        }
      );
    }

    const boardId = String(
      pedido.mondayFixturing?.boardId ||
        ""
    ).trim();

    const phaseItemId = String(
      pedido.mondayFixturing
        ?.phases
        ?.conceptoDiseno
        ?.itemId || ""
    ).trim();

    const mondayUserId = String(
      pedido.mondayFixturing
        ?.mondayUserId || ""
    ).trim();

    if (!boardId || !phaseItemId) {
      return NextResponse.json(
        {
          error:
            "El fixture no tiene vinculada la fase Concepto de Diseño en Monday",
        },
        {
          status: 409,
        }
      );
    }

    if (action === "version_created") {
      const existingSubitemId = String(
        version.monday
          ?.approvalSubitems
          ?.pm || ""
      ).trim();

      /*
       * Si ya existe, respondemos correctamente
       * y evitamos crear una copia.
       */
      if (existingSubitemId) {
        return NextResponse.json({
          ok: true,
          alreadySynced: true,
          subitemId: existingSubitemId,
        });
      }

      if (!mondayUserId) {
        return NextResponse.json(
          {
            error:
              "No se encontró la cuenta de Monday del PM solicitante",
          },
          {
            status: 409,
          }
        );
      }

      const subitem =
        await createConceptApprovalSubitem({
          phaseItemId,
          versionLabel: String(
            version.versionLabel ||
              "sin nombre"
          ),
          mondayUserId,
        });

      await versionRef.set(
        {
          monday: {
            approvalSubitems: {
              pm: subitem.id,
            },
            approvalSubitemNames: {
              pm: subitem.name,
            },
            syncStatus: "synced",
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
        subitemId: subitem.id,
        subitemName: subitem.name,
      });
    }
const generalSubitemIds = Array.isArray(
  pedido.mondayFixturing
    ?.phases
    ?.conceptoDiseno
    ?.generalSubitems
)
  ? pedido.mondayFixturing
      .phases
      .conceptoDiseno
      .generalSubitems
      .map(
        (subitem: { id?: unknown }) =>
          String(subitem?.id || "").trim()
      )
      .filter(Boolean)
  : [];
    /*
     * A partir de aquí procesamos una decisión
     * que ya fue registrada en Firebase.
     */
    const firmaPM =
      version.firmas?.pm;

    const decision = String(
      firmaPM?.decision || ""
    )
      .trim()
      .toLowerCase();

    if (
      decision !== "aprobado" &&
      decision !== "rechazado"
    ) {
      return NextResponse.json(
        {
          error:
            "La versión todavía no contiene una decisión válida del PM",
        },
        {
          status: 409,
        }
      );
    }

    /*
     * Confirmamos que la decisión registrada
     * pertenece a la sesión que está llamando.
     */
    const correoFirma =
      normalizeEmail(
        firmaPM?.correo ||
          firmaPM?.email
      );

    const correoSesion =
      normalizeEmail(
        decodedToken.email
      );

    if (
      correoFirma &&
      correoFirma !== correoSesion
    ) {
      return NextResponse.json(
        {
          error:
            "La firma registrada no pertenece a la sesión actual",
        },
        {
          status: 403,
        }
      );
    }

    const approvalSubitemId = String(
      version.monday
        ?.approvalSubitems
        ?.pm || ""
    ).trim();

    if (!approvalSubitemId) {
      return NextResponse.json(
        {
          error:
            "La versión no tiene una subactividad de firma vinculada",
        },
        {
          status: 409,
        }
      );
    }

    await Promise.all([
      completeConceptApprovalSubitem(
        approvalSubitemId
      ),
      updateConceptPhaseStatus({
  boardId,
  phaseItemId,
  generalSubitemIds,
  approved:
    decision === "aprobado",
}),
    ]);

    await versionRef.set(
      {
        monday: {
          approvalCompleted: {
            pm: true,
          },
          approvalDecision: {
            pm: decision,
          },
          decisionSyncStatus:
            "synced",
          decisionSyncedAt:
            FieldValue.serverTimestamp(),
          decisionSyncError:
            FieldValue.delete(),
        },
      },
      {
        merge: true,
      }
    );

    return NextResponse.json({
      ok: true,
      decision,
      subitemId:
        approvalSubitemId,
      phaseStatus:
        decision === "aprobado"
          ? "Done"
          : "Working on it",
    });
  } catch (error) {
    console.error(
      "Error sincronizando concepto con Monday:",
      error
    );

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "No se pudo sincronizar el concepto con Monday",
      },
      {
        status: 500,
      }
    );
  }
}