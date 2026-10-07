import { NextRequest, NextResponse } from "next/server";

export const dynamic="force-dynamic";
export const maxDuration=300;

export async function POST(request:NextRequest){
  try{
    const body=await request.json().catch(()=>({})),response=await fetch(`${request.nextUrl.origin}/api/admin/sources/refresh`,{method:"POST",headers:{"Content-Type":"application/json","x-admin-user":request.headers.get("x-admin-user")||encodeURIComponent("نظام إصلاح المواد")},body:JSON.stringify({sourceId:body.sourceId||undefined,workflow:"review",triggerType:"manual",repairExisting:true}),cache:"no-store"});
    const result=await response.json();
    return NextResponse.json(result,{status:response.status});
  }catch(error){return NextResponse.json({error:error instanceof Error?error.message:"تعذر تشغيل إصلاح المواد المستوردة"},{status:500});}
}
