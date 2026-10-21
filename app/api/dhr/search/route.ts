import { NextResponse } from "next/server";
import { authenticated } from "@/lib/dhr/auth";
import { searchSection } from "@/lib/dhr/box";
export const runtime='nodejs';export const dynamic='force-dynamic';export const maxDuration=300;
export async function POST(request:Request){
 if(!await authenticated(request))return NextResponse.json({error:'Inicia sesión.'},{status:401});
 let body;try{body=await request.json();}catch{return NextResponse.json({error:'Solicitud inválida.'},{status:400});}
 if(typeof body?.section!=='string'||!Array.isArray(body.records)||!body.records.length||body.records.length>200||body.records.some((r: {id?:unknown;text?:unknown})=>!r||typeof r.id!=='string'||typeof r.text!=='string'||r.text.length>1500))return NextResponse.json({error:'Lista de registros inválida (máximo 200 por sección).'},{status:400});
 try{return NextResponse.json({files:await searchSection(body.section,body.records)},{headers:{'Cache-Control':'no-store'}});}
 catch(error){return NextResponse.json({error:error instanceof Error?error.message:'No se pudo consultar Box.'},{status:502});}
}
