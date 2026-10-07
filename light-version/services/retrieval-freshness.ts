import { categoryMonitoringRows, finishAllSourceSchedules, retrievalFreshness, retrievalSessionActive } from "@/database/database";
import { runRetrieval } from "@/services/retrieval-pipeline";

let pending:Promise<unknown>|null=null;
const pendingCategories=new Map<string,Promise<unknown>>();
export function retrievalIsDue(){return retrievalFreshness().due||categoryMonitoringRows().some((row)=>row.stale);}
export function triggerDueRetrieval(trigger:"startup"|"homepage"){
  const freshness=retrievalFreshness(),staleCategories=categoryMonitoringRows().filter((row)=>row.stale).map((row)=>row.category);if(!freshness.due&&!staleCategories.length)return Promise.resolve({triggered:false,reason:"retrieval_is_fresh",freshness});if(retrievalSessionActive())return Promise.resolve({triggered:false,reason:"retrieval_session_already_running",freshness,staleCategories});if(pending)return pending;
  pending=runRetrieval({trigger,targetType:"all"}).then((result)=>{if(!result.skipped)finishAllSourceSchedules(result.errors.length?"completed_with_errors":"completed",result.errors.join(" | "));return {triggered:!result.skipped,result};}).finally(()=>{pending=null;});return pending;
}
export function triggerCategoryRetrieval(category:string){
  const row=categoryMonitoringRows().find((item)=>item.category===category);
  if(!row?.stale)return Promise.resolve({triggered:false,reason:"category_is_fresh",category});
  if(retrievalSessionActive())return Promise.resolve({triggered:false,reason:"retrieval_session_already_running",category});
  const existing=pendingCategories.get(category);if(existing)return existing;
  const task=runRetrieval({trigger:"homepage",targetType:"category",targetId:category}).then((result)=>({triggered:!result.skipped,result})).finally(()=>pendingCategories.delete(category));
  pendingCategories.set(category,task);return task;
}
