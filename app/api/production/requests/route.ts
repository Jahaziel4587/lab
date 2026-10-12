import { NextRequest, NextResponse } from "next/server";
import { identify } from "@/lib/operacional/server";
import { adminDB } from "@/lib/firebaseAdmin";
import { inventorySite, inventoryCollections } from "@/lib/inventario/sites";
export const dynamic="force-dynamic";
export async function GET(req:NextRequest){const user=await identify(req);if(!user)return NextResponse.json({error:"Inicia sesión."},{status:401});try{const site=inventorySite(req.nextUrl.searchParams.get("site"));const [orders,profile]=await Promise.all([adminDB.collection("production_orders").where("site","==",site).get(),adminDB.collection("users").doc(user.uid).get()]);const ops=orders.empty?[]:await adminDB.getAll(...orders.docs.map(d=>adminDB.collection(inventoryCollections(site).operations).doc(d.id)));return NextResponse.json({canFulfill:(profile.data()?.warehouseSites||[]).includes(site),orders:orders.docs.map((d,i)=>({...d.data(),id:d.id,voucherIds:ops[i]?.data()?.voucherIds||[]})).sort((a,b)=>String((b as {createdAt?:string}).createdAt).localeCompare(String((a as {createdAt?:string}).createdAt)))});}catch(e){return NextResponse.json({error:(e as Error).message},{status:400});}}
