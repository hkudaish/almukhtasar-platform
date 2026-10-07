import { NextRequest, NextResponse } from "next/server";
import { listRetrievalSchedules } from "@/lib/admin-db";
import { executeRetrievalTarget, markScheduleAfterRun, nextScheduledRun } from "@/lib/retrieval-scheduler";
import { buildWatchdogReport } from "@/lib/source-monitor";

export const dynamic="force-dynamic";
async function runCron(request:NextRequest){
  const secret=process.env.RETRIEVAL_CRON_SECRET||process.env.CRON_SECRET;if(!secret||request.headers.get("authorization")!==`Bearer ${secret}`)return NextResponse.json({error:"غير مصرح"},{status:401});
  const now=new Date(),all=listRetrievalSchedules(),due=all.filter((schedule)=>schedule.enabled&&(!schedule.nextRunAt||Date.parse(schedule.nextRunAt)<=now.getTime())),results=[];
  for(const schedule of due){try{const data=await executeRetrievalTarget(request.nextUrl.origin,{targetType:schedule.targetType,targetId:schedule.targetId,workflow:schedule.workflow,triggerType:"scheduled",scheduleId:schedule.id,actor:"المجدول الآلي"});results.push({scheduleId:schedule.id,status:"completed",data});}catch(error){results.push({scheduleId:schedule.id,status:"failed",error:error instanceof Error?error.message:"خطأ غير معروف"});}finally{markScheduleAfterRun(schedule,now.toISOString());}}
  for(const schedule of all.filter((item)=>item.enabled&&!item.nextRunAt&&!due.some((dueItem)=>dueItem.id===item.id)))markScheduleAfterRun(schedule,now.toISOString());
  const watchdog=buildWatchdogReport(),recovery=[];
  if(watchdog.needsRecovery&&!due.some((schedule)=>["news","all"].includes(schedule.targetType))){
    const candidates=watchdog.sources.filter((source)=>!source.isSocial&&source.healthStatus!=="Paused"&&source.healthStatus!=="Healthy"&&(!source.lastChecked||Date.parse(source.lastChecked)<now.getTime()-30*60*1000)).slice(0,2);
    for(const source of candidates){try{const data=await executeRetrievalTarget(request.nextUrl.origin,{targetType:"source",targetId:source.id,workflow:"review",triggerType:"scheduled",actor:"مراقب الاستعادة الآلية"});recovery.push({sourceId:source.id,status:"completed",data});}catch(error){recovery.push({sourceId:source.id,status:"failed",error:error instanceof Error?error.message:"خطأ غير معروف"});}}
  }
  return NextResponse.json({checked:all.length,due:due.length,results,watchdog:{alerts:watchdog.alerts,inventory:watchdog.inventory,needsRecovery:watchdog.needsRecovery},recovery,nextCheckHint:all.filter((item)=>item.enabled).map((item)=>item.nextRunAt||nextScheduledRun(item,now))});
}
export async function GET(request:NextRequest){return runCron(request);}
export async function POST(request:NextRequest){return runCron(request);}
