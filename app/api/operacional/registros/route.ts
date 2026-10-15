import { NextRequest, NextResponse } from "next/server";
import { FieldPath } from "firebase-admin/firestore";
import { adminDB } from "@/lib/firebaseAdmin";
import { identify, canOperate } from "@/lib/operacional/server";
import { matchesRecord, recordFields, type RecordFilter } from "@/lib/operacional/record-search";
export const dynamic = "force-dynamic";
async function denied(req: NextRequest) {
  const user = await identify(req);
  if (!user) return NextResponse.json({ error: "Inicia sesión." }, { status: 401 });
  if (!canOperate(user.email)) return NextResponse.json({ error: "Sin acceso a Operacional." }, { status: 403 });
}
export async function GET(req: NextRequest) {
  const rejection = await denied(req); if (rejection) return rejection;
  try {
    const collections = await adminDB.listCollections();
    return NextResponse.json({ collections: collections.map(c => c.id).sort() });
  } catch { return NextResponse.json({ error: "No se pudieron cargar las colecciones." }, { status: 500 }); }
}
export async function POST(req: NextRequest) {
  const rejection = await denied(req); if (rejection) return rejection;
  try {
    const body = await req.json();
    if (typeof body.collection !== "string" || !body.collection || body.collection.includes("/") || body.collection.length > 200 || !Array.isArray(body.filters) || body.filters.length > 10 || body.filters.some((f: RecordFilter) => !f || typeof f.field !== "string" || f.field.length > 200 || typeof f.value !== "string" || f.value.length > 200) || (body.cursor !== undefined && (typeof body.cursor !== "string" || body.cursor.includes("/") || body.cursor.length > 1500))) {
      return NextResponse.json({ error: "Colección o filtros inválidos." }, { status: 400 });
    }
    const filters: RecordFilter[] = body.filters.filter((f: RecordFilter) => f.value.trim());
    let query = adminDB.collection(body.collection).orderBy(FieldPath.documentId()).limit(200);
    if (body.cursor) query = query.startAfter(body.cursor);
    const snapshot = await query.get();
    const records = snapshot.docs.filter(d => matchesRecord(d.id, d.data(), filters)).map(d => ({ id: d.id, path: d.ref.path, data: d.data() }));
    return NextResponse.json({ records, fields: [...new Set(snapshot.docs.flatMap(d => recordFields(d.data())))].sort(), scanned: snapshot.size, cursor: snapshot.size === 200 ? snapshot.docs[snapshot.size - 1].id : null });
  } catch { return NextResponse.json({ error: "No se pudieron buscar los registros. Intenta de nuevo." }, { status: 500 }); }
}
