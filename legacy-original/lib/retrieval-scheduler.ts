import "server-only";
import { updateRetrievalScheduleRun, type RetrievalSchedule } from "@/lib/admin-db";

export function nextScheduledRun(schedule:Pick<RetrievalSchedule,"enabled"|"frequency"|"intervalHours"|"fixedTime"|"weekdays"|"timezone">,after=new Date()){
  if(!schedule.enabled)return null;
  if(schedule.frequency==="hourly")return new Date(after.getTime()+Math.max(1,schedule.intervalHours)*3600000).toISOString();
  const formatter=new Intl.DateTimeFormat("en-US",{timeZone:schedule.timezone,weekday:"short",hour:"2-digit",minute:"2-digit",hourCycle:"h23"});
  const weekdayIndex:Record<string,number>={Sun:0,Mon:1,Tue:2,Wed:3,Thu:4,Fri:5,Sat:6},wanted=schedule.weekdays||[];
  const [wantedHour,wantedMinute]=schedule.fixedTime.split(":").map(Number),start=Math.ceil(after.getTime()/60000)*60000;
  for(let offset=0;offset<=8*24*60;offset++){
    const candidate=new Date(start+offset*60000),parts=Object.fromEntries(formatter.formatToParts(candidate).map((part)=>[part.type,part.value]));
    const day=weekdayIndex[parts.weekday];
    if(Number(parts.hour)===wantedHour&&Number(parts.minute)===wantedMinute&&(schedule.frequency==="daily"||wanted.includes(day)))return candidate.toISOString();
  }
  return null;
}

export async function executeRetrievalTarget(origin:string,input:{targetType:string;targetId?:string|null;workflow?:string;triggerType:"manual"|"scheduled";scheduleId?:string|null;actor?:string}){
  const headers={"Content-Type":"application/json","x-admin-user":encodeURIComponent(input.actor||"مدير النظام")};
  const invoke=async(path:string,body:Record<string,unknown>)=>{const response=await fetch(`${origin}${path}`,{method:"POST",headers,body:JSON.stringify({...body,workflow:input.workflow,triggerType:input.triggerType,scheduleId:input.scheduleId}),cache:"no-store"});const result=await response.json();if(!response.ok)throw new Error(result.error||`HTTP ${response.status}`);return result;};
  if(input.targetType==="news")return {news:await invoke("/api/admin/sources/refresh",{})};
  if(input.targetType==="source")return {news:await invoke("/api/admin/sources/refresh",{sourceId:input.targetId})};
  if(input.targetType==="category")return {news:await invoke("/api/admin/sources/refresh",{category:input.targetId})};
  if(input.targetType==="social")return {social:await invoke("/api/admin/social-trends/refresh",{})};
  if(input.targetType==="platform")return {social:await invoke("/api/admin/social-trends/refresh",{platform:input.targetId})};
  if(input.targetType==="all"){const [news,social]=await Promise.all([invoke("/api/admin/sources/refresh",{}),invoke("/api/admin/social-trends/refresh",{})]);return {news,social};}
  throw new Error("نوع هدف الجلب غير صالح");
}

export function markScheduleAfterRun(schedule:RetrievalSchedule,startedAt:string){const next=nextScheduledRun(schedule,new Date(startedAt));return updateRetrievalScheduleRun(schedule.id,startedAt,next);}
