import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { listRetrievalRuns } from "@/lib/admin-db";
import { homepageSupplySettings, recoverHomepageContent } from "@/lib/homepage-recovery";
import { executeRetrievalTarget } from "@/lib/retrieval-scheduler";

export const dynamic="force-dynamic";
export async function POST(request:NextRequest){
  const origin=request.headers.get("origin");if(origin&&origin!==request.nextUrl.origin)return NextResponse.json({error:"غير مصرح"},{status:403});
  const settings=homepageSupplySettings();if(!settings.urgentRetrievalEnabled)return NextResponse.json({status:"disabled"});
  const recent=listRetrievalRuns(20).find((run)=>run.actor==="نظام إمداد الصفحة"&&Date.now()-Date.parse(run.startedAt)<15*60*1000);if(recent)return NextResponse.json({status:"cooldown",runId:recent.id});
  try{const data=await executeRetrievalTarget(request.nextUrl.origin,{targetType:"news",workflow:settings.emergencyAutoPublish?"publish":"review",triggerType:"manual",actor:"نظام إمداد الصفحة"});const recovery=recoverHomepageContent("urgent_retrieval_finished");revalidatePath("/");return NextResponse.json({status:"completed",data,eligibleCount:recovery.eligible.length});}catch(error){return NextResponse.json({error:error instanceof Error?error.message:"تعذر الجلب العاجل"},{status:500});}
}
