import { NextResponse } from "next/server";
import {
  getBoxCurrentUser,
  listBoxFolderItems,
} from "@/lib/box/boxClient";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const [serviceAccount, rootItems] =
      await Promise.all([
        getBoxCurrentUser(),
        listBoxFolderItems("0"),
      ]);

    return NextResponse.json({
      ok: true,

      serviceAccount: {
        id: serviceAccount.id,
        name: serviceAccount.name,
        login: serviceAccount.login,
      },

      sharedFolders:
        rootItems.entries.filter(
          (item) => item.type === "folder",
        ),
    });
  } catch (error) {
    console.error(
      "Error probando la conexión con Box:",
      error,
    );

    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Error desconocido consultando Box",
      },
      { status: 500 },
    );
  }
}