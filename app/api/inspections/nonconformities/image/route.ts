import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  adminAuth,
  adminStorage,
} from "@/lib/firebaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function createResponseBuffer(
  source: Uint8Array,
) {
  const arrayBuffer =
    new ArrayBuffer(
      source.byteLength,
    );

  new Uint8Array(
    arrayBuffer,
  ).set(source);

  return arrayBuffer;
}

export async function GET(
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

    await adminAuth.verifyIdToken(
      idToken,
    );

    const storagePath =
      request.nextUrl.searchParams
        .get("path")
        ?.trim();

    if (!storagePath) {
      return NextResponse.json(
        {
          error:
            "No se recibió la ruta de la fotografía.",
        },
        {
          status: 400,
        },
      );
    }

    /*
     * El endpoint solamente permite
     * descargar evidencia de las
     * no conformidades.
     */
    if (
      !storagePath.startsWith(
        "inspection-nonconformities/",
      ) ||
      storagePath.includes("..")
    ) {
      return NextResponse.json(
        {
          error:
            "Ruta de fotografía no válida.",
        },
        {
          status: 403,
        },
      );
    }

    const file =
      adminStorage
        .bucket()
        .file(storagePath);

    const [
      exists,
    ] = await file.exists();

    if (!exists) {
      return NextResponse.json(
        {
          error:
            "La fotografía ya no existe.",
        },
        {
          status: 404,
        },
      );
    }

    const [
      fileBuffer,
      metadata,
    ] = await Promise.all([
      file.download().then(
        ([buffer]) =>
          buffer,
      ),

      file.getMetadata().then(
        ([result]) =>
          result,
      ),
    ]);

    const responseBody =
      createResponseBuffer(
        fileBuffer,
      );

    return new NextResponse(
      responseBody,
      {
        status: 200,

        headers: {
          "Content-Type":
            metadata.contentType ||
            "application/octet-stream",

          "Cache-Control":
            "private, max-age=300",
        },
      },
    );
  } catch (error) {
    console.error(
      "Error descargando fotografía de no conformidad:",
      error,
    );

    return NextResponse.json(
      {
        error:
          "No fue posible descargar la fotografía.",
      },
      {
        status: 500,
      },
    );
  }
}