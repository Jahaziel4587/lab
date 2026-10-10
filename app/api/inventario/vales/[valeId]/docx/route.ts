import { NextRequest,NextResponse } from "next/server";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { adminDB } from "@/lib/firebaseAdmin";
import { identify } from "@/lib/operacional/server";
import { inventorySite,inventoryCollections } from "@/lib/inventario/sites";
import { renderVoucher } from "@/lib/inventario/voucher-docx";
import type { Voucher } from "@/lib/inventario/types";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export async function GET(req:NextRequest,{params}:{params:Promise<{valeId:string}>}){
 if(!await identify(req))return NextResponse.json({error:"Inicia sesión."},{status:401});
 try{const {valeId}=await params;const site=inventorySite(req.nextUrl.searchParams.get("site"));if(!/^[a-zA-Z0-9]{10,100}$/.test(valeId))return NextResponse.json({error:"Folio inválido."},{status:400});const snap=await adminDB.collection(inventoryCollections(site).vouchers).doc(valeId).get();if(!snap.exists)return NextResponse.json({error:"Vale no encontrado en este almacén."},{status:404});const voucher={...snap.data(),id:snap.id,site} as Voucher;const template=await readFile(path.join(process.cwd(),"public/templates/vale-material.docx"));const result=renderVoucher(template,voucher);return new NextResponse(new Uint8Array(result),{headers:{"Content-Type":"application/vnd.openxmlformats-officedocument.wordprocessingml.document","Content-Disposition":`attachment; filename="Vale-${site}-${valeId}.docx"`,"Cache-Control":"private, no-store"}});}catch(e){console.error("Vale oficial",e);return NextResponse.json({error:"No se pudo generar el vale oficial. Revisa el formato y sus etiquetas."},{status:500});}
}
