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
  getDisplayNameForUid,
} from "@/lib/pushNotifications";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function cleanString(
  value: unknown,
) {
  return String(
    value || "",
  ).trim();
}

function normalizeEmail(
  value: unknown,
) {
  return cleanString(
    value,
  ).toLowerCase();
}

export async function POST(
  request: NextRequest,
) {
  try {
    const authorization =
      request.headers.get(
        "authorization",
      );

    if (
      !authorization?.startsWith(
        "Bearer ",
      )
    ) {
      return NextResponse.json(
        {
          ok: false,
          error: "No autorizado.",
        },
        {
          status: 401,
        },
      );
    }

    const idToken =
      authorization.slice(
        "Bearer ".length,
      );

    const decoded =
      await adminAuth
        .verifyIdToken(
          idToken,
        );

    const body =
      await request.json();

    const scopeKey =
      cleanString(
        body?.scopeKey,
      );

    const lotId =
      cleanString(
        body?.lotId,
      );

    if (
      !scopeKey ||
      !lotId
    ) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Falta información del lote.",
        },
        {
          status: 400,
        },
      );
    }

    const authenticatedEmail =
      normalizeEmail(
        decoded.email,
      );

    const scopeReference =
      adminDB
        .collection(
          "inspection_nonconformities",
        )
        .doc(scopeKey);

    const lotReference =
      scopeReference
        .collection("lots")
        .doc(lotId);

    const reportsReference =
      lotReference
        .collection("reports");

    const finalizedByName =
      await getDisplayNameForUid(
        decoded.uid,
        decoded.email,
      );

    const result =
      await adminDB.runTransaction(
        async (transaction) => {
          const lotSnapshot =
            await transaction.get(
              lotReference,
            );

          if (
            !lotSnapshot.exists
          ) {
            throw new Error(
              "El lote no existe.",
            );
          }

          const lot =
            lotSnapshot.data() || {};

          /*
           * La finalización solamente puede
           * realizarla el inspector que creó
           * el lote.
           */
          if (
            cleanString(
              lot.createdByUid,
            ) !== decoded.uid
          ) {
            throw new Error(
              "Solo el inspector que creó el lote puede finalizarlo.",
            );
          }

          /*
           * Si ya fue finalizado, devuelve
           * el resultado guardado sin volver
           * a modificarlo.
           */
          if (
            lot.status ===
            "finalized"
          ) {
            return {
              alreadyFinalized:
                true,

              lotName:
                cleanString(
                  lot.lotName,
                ),

              sampleQuantity:
                Number(
                  lot.sampleQuantity ||
                    0,
                ),

              rejectedSampleCount:
                Number(
                  lot
                    .rejectedSampleCount ||
                    0,
                ),
            };
          }

          const reportsSnapshot =
            await transaction.get(
              reportsReference.orderBy(
                "sequence",
                "asc",
              ),
            );

          if (
            reportsSnapshot.empty
          ) {
            throw new Error(
              "Registra al menos una muestra rechazada antes de finalizar el lote.",
            );
          }

          /*
           * Se cuentan números de muestra
           * únicos. De esta forma una misma
           * muestra nunca incrementará dos
           * veces el total rechazado.
           */
          const rejectedSamples =
            new Set<number>();

          reportsSnapshot.docs.forEach(
            (reportDocument) => {
              const report =
                reportDocument.data();

              const sampleNumber =
                Number(
                  report.sampleNumber,
                );

              if (
                Number.isInteger(
                  sampleNumber,
                ) &&
                sampleNumber > 0
              ) {
                rejectedSamples.add(
                  sampleNumber,
                );
              }
            },
          );

          const rejectedSampleCount =
            rejectedSamples.size;

          const sampleQuantity =
            Number(
              lot.sampleQuantity ||
                0,
            );

          if (
            !Number.isInteger(
              sampleQuantity,
            ) ||
            sampleQuantity < 1
          ) {
            throw new Error(
              "El lote no tiene una cantidad de muestras válida.",
            );
          }

          if (
            rejectedSampleCount < 1
          ) {
            throw new Error(
              "No se encontraron muestras rechazadas válidas.",
            );
          }

          if (
            rejectedSampleCount >
            sampleQuantity
          ) {
            throw new Error(
              "La cantidad de muestras rechazadas supera el total del lote.",
            );
          }

          transaction.update(
            lotReference,
            {
              status:
                "finalized",

              rejectedSampleCount,

              finalizedByUid:
                decoded.uid,

              finalizedByEmail:
                authenticatedEmail,

              finalizedByName,

              finalizedAt:
                FieldValue
                  .serverTimestamp(),

              updatedAt:
                FieldValue
                  .serverTimestamp(),
            },
          );

          return {
            alreadyFinalized:
              false,

            lotName:
              cleanString(
                lot.lotName,
              ),

            sampleQuantity,

            rejectedSampleCount,
          };
        },
      );

    return NextResponse.json({
      ok: true,

      lotId,

      lotName:
        result.lotName,

      sampleQuantity:
        result.sampleQuantity,

      rejectedSampleCount:
        result
          .rejectedSampleCount,

      alreadyFinalized:
        result.alreadyFinalized,
    });
  } catch (error) {
    console.error(
      "[finalize nonconformity lot]",
      error,
    );

    const message =
      error instanceof Error
        ? error.message
        : "No fue posible finalizar el lote.";

    const forbidden =
      message.includes(
        "Solo el inspector",
      );

    const notFound =
      message ===
      "El lote no existe.";

    return NextResponse.json(
      {
        ok: false,
        error: message,
      },
      {
        status:
          forbidden
            ? 403
            : notFound
              ? 404
              : 400,
      },
    );
  }
}