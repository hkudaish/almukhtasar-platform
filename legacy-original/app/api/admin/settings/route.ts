import { NextRequest, NextResponse } from "next/server";
import { getSettings, saveSettings } from "@/lib/admin-db";
export const runtime = "nodejs";
export async function GET(request:NextRequest){return NextResponse.json({data:getSettings(request.nextUrl.searchParams.get("section")||undefined)});}
export async function PUT(request:NextRequest){try{const body=await request.json();if(typeof body.section!=="string"||!body.value||typeof body.value!=="object")return NextResponse.json({error:"VALIDATION_ERROR"},{status:400});return NextResponse.json({data:saveSettings(body.section,body.value,request.headers.get("x-admin-user")||"مدير النظام")});}catch{return NextResponse.json({error:"INVALID_BODY"},{status:400});}}
