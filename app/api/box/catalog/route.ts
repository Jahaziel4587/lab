import {
  NextRequest,
  NextResponse,
} from "next/server";

import { adminAuth } from
  "@/lib/firebaseAdmin";

import {
  getDmrProjects,
  getMtsWorkInstructions,
  getProjectWorkInstructions,
} from "@/lib/box/boxCatalog";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type CatalogScope =
  | "projects"
  | "mts"
  | "incoming"
  | "process";

function isCatalogScope(
  value: string | null,
): value is CatalogScope {
  return (
    value === "projects" ||
    value === "mts" ||
    value === "incoming" ||
    value === "process"
  );
}

async function verifyUser(
  request: NextRequest,
) {
  const authorization =
    request.headers.get("authorization");

  if (
    !authorization?.startsWith(
      "Bearer ",
    )
  ) {
    throw new Error("UNAUTHORIZED");
  }

  const idToken =
    authorization.slice(
      "Bearer ".length,
    );

  await adminAuth.verifyIdToken(idToken);
}

export async function GET(
  request: NextRequest,
) {
  try {
    await verifyUser(request);

    const scope =
      request.nextUrl.searchParams.get(
        "scope",
      );

    const projectId =
      request.nextUrl.searchParams.get(
        "projectId",
      );

    if (!isCatalogScope(scope)) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "El parámetro scope no es válido.",
        },
        { status: 400 },
      );
    }

    if (scope === "projects") {
      const projects =
        await getDmrProjects();

      return NextResponse.json({
        ok: true,
        scope,
        projects,
      });
    }

    if (scope === "mts") {
      const workInstructions =
        await getMtsWorkInstructions();

      return NextResponse.json({
        ok: true,
        scope,
        workInstructions,
      });
    }

    if (!projectId) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Falta el identificador del proyecto.",
        },
        { status: 400 },
      );
    }

    const result =
      await getProjectWorkInstructions({
        projectId,
        type:
          scope === "incoming"
            ? "incoming"
            : "process",
      });

    return NextResponse.json({
      ok: true,
      scope,
      projectId,
      ...result,
    });
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === "UNAUTHORIZED"
    ) {
      return NextResponse.json(
        {
          ok: false,
          error: "No autorizado.",
        },
        { status: 401 },
      );
    }

    console.error(
      "Error obteniendo catálogo de Box:",
      error,
    );

    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Error desconocido obteniendo catálogo.",
      },
      { status: 500 },
    );
  }
}