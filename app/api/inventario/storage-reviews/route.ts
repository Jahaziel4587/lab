import { NextRequest, NextResponse } from "next/server";
import { identify } from "@/lib/operacional/server";
import { adminDB } from "@/lib/firebaseAdmin";
import { inventorySite, inventoryCollections } from "@/lib/inventario/sites";
export async function GET(req: NextRequest) {
  const user = await identify(req); if (!user) return NextResponse.json({error:"Inicia sesión."},{status:401});
  try {
    const site = inventorySite(req.nextUrl.searchParams.get("site")), id = req.nextUrl.searchParams.get("componentId");
    if (!id || !/^[a-zA-Z0-9]{10,100}$/.test(id)) throw new Error("Componente inválido.");
    const [snap, profile] = await Promise.all([adminDB.collection(`${inventoryCollections(site).components}_storage_reviews`).where("componentId","==",id).get(), adminDB.collection("users").doc(user.uid).get()]);
    return NextResponse.json({canReview:(profile.data()?.warehouseSites || []).includes(site), reviews:snap.docs.map(d=>({...d.data(),id:d.id})).sort((a,b)=>String((b as {createdAt?:string}).createdAt).localeCompare(String((a as {createdAt?:string}).createdAt)))});
  } catch(e) {return NextResponse.json({error:(e as Error).message},{status:400});}
}
export async function POST(req:NextRequest) {
  const user = await identify(req); if(!user)return NextResponse.json({error:"Inicia sesión."},{status:401});
  try {
    const b = await req.json(),site = inventorySite(b.site), profile = await adminDB.collection("users").doc(user.uid).get();
    if (!(profile.data()?.warehouseSites || []).includes(site)) return NextResponse.json({error:"Solo el almacenista asignado puede confirmar la revisión."},{status:403});
    if(typeof b.id !== "string" || !/^[a-zA-Z0-9]{10,100}$/.test(b.id) || typeof b.notes !== "string" || !b.notes.trim() || b.notes.length>1000)throw new Error("Indica el resultado de la revisión.");
    await adminDB.runTransaction(async t=>{const ref=adminDB.collection(`${inventoryCollections(site).components}_storage_reviews`).doc(b.id),snap=await t.get(ref);if(!snap.exists)throw new Error("Revisión inexistente.");if(snap.data()?.status === "reviewed")return;t.update(ref,{status:"reviewed",reviewedBy:user.uid,reviewedAt:new Date().toISOString(),notes:b.notes.trim()});});
    return NextResponse.json({saved:true});
  }catch(e){return NextResponse.json({error:(e as Error).message},{status:400});}
}
