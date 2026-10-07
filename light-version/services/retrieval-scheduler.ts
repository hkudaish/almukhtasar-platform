import { categoryMonitoringRows, dueSchedules, finishAllSourceSchedules, finishSchedule, recoverEligibleReviewPosts, retrievalFreshness, retrievalSessionActive, runArchiveLifecycle } from "@/database/database";
import { runRetrieval } from "@/services/retrieval-pipeline";
import { runSourceArticleMonitoring } from "@/services/source-article-monitor";
import { collectSocialPosts } from "@/services/social-collector";
import { syncTrendEngine, generateDailyBrief } from "@/lib/trend-engine";

const targetTypes=new Set(["all","source","category","failing","recovery","breaking"]);
export async function runDueRetrievalSchedules(){
  runArchiveLifecycle();
  const recovered=recoverEligibleReviewPosts();
  try {
    await collectSocialPosts();
    syncTrendEngine();
    generateDailyBrief();
  } catch(e) {
    console.error("Trend/Social scheduler error:", e);
  }
  if(retrievalSessionActive())return {processed:0,results:[],monitoring:[],recovered,reason:"retrieval_session_already_running"};
  let due=dueSchedules().filter((schedule)=>targetTypes.has(String(schedule.target_type)));if(due.some((schedule)=>String(schedule.target_type)==="all")&&!retrievalFreshness().due&&!categoryMonitoringRows().some((row)=>row.stale)){finishAllSourceSchedules("completed");due=due.filter((schedule)=>String(schedule.target_type)!=="all");}
  const schedules=due.filter((schedule,index)=>String(schedule.target_type)!=="all"||due.findIndex((candidate)=>String(candidate.target_type)==="all")===index),results:Record<string,unknown>[]=[];
  for(const schedule of schedules){const id=String(schedule.id),targetType=String(schedule.target_type) as "all"|"source"|"category"|"failing"|"recovery"|"breaking";try{const result=await runRetrieval({trigger:"scheduled",targetType,targetId:String(schedule.target_id||"")});if(!result.skipped){const status=result.errors.length?"completed_with_errors":"completed",error=result.errors.join(" | ");if(targetType==="all")finishAllSourceSchedules(status,error);else finishSchedule(id,status,error);}results.push({schedule:id,...result});}catch(error){const reason=error instanceof Error?error.message:String(error);finishSchedule(id,"failed",reason);results.push({schedule:id,error:reason});}}
  const monitoring=[];
  monitoring.push(await runSourceArticleMonitoring({breakingOnly:true,limit:30,intervalMinutes:5}));
  monitoring.push(await runSourceArticleMonitoring({breakingOnly:false,limit:Math.max(10,Number(process.env.SOURCE_MONITOR_BATCH_SIZE)||60),intervalMinutes:120}));
  return {processed:schedules.length,results,monitoring,recovered};
}

type SchedulerGlobal=typeof globalThis&{__almukhtasarScheduler?:ReturnType<typeof setInterval>;__almukhtasarStartupTimer?:ReturnType<typeof setTimeout>};
export function startRetrievalScheduler(){const state=globalThis as SchedulerGlobal;if(state.__almukhtasarScheduler)return;runArchiveLifecycle();state.__almukhtasarStartupTimer=setTimeout(()=>{void runDueRetrievalSchedules();},1500);state.__almukhtasarStartupTimer.unref?.();state.__almukhtasarScheduler=setInterval(()=>{void runDueRetrievalSchedules();},60000);state.__almukhtasarScheduler.unref?.();}

