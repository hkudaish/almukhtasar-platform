import { NextRequest, NextResponse } from "next/server";
import { refreshAllSocialPlatforms, refreshSocialPlatform } from "@/lib/social-retrieval";
import { socialPlatforms, type SocialPlatform } from "@/lib/social-types";
import { acquireRetrievalLock, finishRetrievalRun, releaseRetrievalLock, startRetrievalRun } from "@/lib/admin-db";

export const dynamic="force-dynamic";

export async function POST(request:NextRequest){
  let platform="",triggerType="manual",scheduleId="";
  try{const body=await request.json();platform=String(body.platform||"");triggerType=body.triggerType==="scheduled"?"scheduled":"manual";scheduleId=String(body.scheduleId||"");}catch{}
  if(platform&&!(socialPlatforms as readonly string[]).includes(platform))return NextResponse.json({error:"منصة غير صالحة"},{status:400});
  let actor="مدير النظام";try{actor=decodeURIComponent(request.headers.get("x-admin-user")||actor);}catch{}const run=startRetrievalRun({triggerType,targetType:platform?"platform":"social",targetId:platform||null,scheduleId:scheduleId||null,actor}),lockKey=`social:${platform||"all"}`;
  if(!acquireRetrievalLock(lockKey,run.id)){finishRetrievalRun(run.id,"blocked",{},"توجد جلسة جلب أخرى قيد التشغيل للنطاق نفسه");return NextResponse.json({error:"توجد جلسة جلب أخرى قيد التشغيل للنطاق نفسه"},{status:409});}
  try{
    const results=platform?[await refreshSocialPlatform(platform as SocialPlatform)]:await refreshAllSocialPlatforms();
    const report={sourcesProcessed:results.map((item)=>item.platform),found:results.reduce((sum,item)=>sum+item.itemCount,0),imported:results.reduce((sum,item)=>sum+item.itemCount,0),updated:0,duplicates:0,invalidRejected:0,review:0,failedSources:results.filter((item)=>item.status==="failed").map((item)=>item.platform),details:results,retrievalMethods:results.map((item)=>({source:item.platform,method:"Official API / approved connector"}))};
    const status=results.some((item)=>item.status==="failed")?"completed_with_errors":results.every((item)=>item.status==="unconfigured")?"needs_configuration":"completed";
    finishRetrievalRun(run.id,status,report);return NextResponse.json({results,runId:run.id,report});
  }catch(error){const message=error instanceof Error?error.message:"تعذر تحديث المنصات";finishRetrievalRun(run.id,"failed",{},message);return NextResponse.json({error:message},{status:500});}
  finally{releaseRetrievalLock(lockKey,run.id);}
}
