import { NextRequest, NextResponse } from "next/server";
import { executeRetrievalTarget } from "@/lib/retrieval-scheduler";
export const dynamic="force-dynamic";
export async function POST(request:NextRequest){try{const body=await request.json();return NextResponse.json({data:await executeRetrievalTarget(request.nextUrl.origin,{targetType:String(body.targetType||"all"),targetId:body.targetId?String(body.targetId):null,workflow:String(body.workflow||"publish"),triggerType:"manual",actor:request.headers.get("x-admin-user")||"مدير النظام"})});}catch(error){return NextResponse.json({error:error instanceof Error?error.message:"تعذر تشغيل الجلب"},{status:500});}}
