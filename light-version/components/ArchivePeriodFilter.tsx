"use client";

import { useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";

type Scope="all"|"year"|"day"|"week"|"month";
type Facet={year:string;month:string;day:string;count:number};
function isoWeek(date:string){const value=new Date(`${date}T12:00:00Z`),day=value.getUTCDay()||7;value.setUTCDate(value.getUTCDate()+4-day);const start=new Date(Date.UTC(value.getUTCFullYear(),0,1));return `${value.getUTCFullYear()}-W${String(Math.ceil((((value.getTime()-start.getTime())/86400000)+1)/7)).padStart(2,"0")}`;}
function label(scope:Scope,value:string){if(scope==="year")return value;if(scope==="month"){const [year,month]=value.split("-");return `${new Date(Number(year),Number(month)-1).toLocaleDateString("ar-SA",{month:"short"})} ${year}`;}if(scope==="week")return `أسبوع ${value.slice(-2)}`;return new Date(`${value}T12:00:00`).toLocaleDateString("ar-SA",{day:"numeric",month:"short"});}
export default function ArchivePeriodFilter({facets}:{facets:Facet[]}){
  const router=useRouter(),params=useSearchParams(),scope=(params.get("scope")||"all") as Scope,date=params.get("date")||"";
  function set(nextScope:Scope,nextDate=date){const query=new URLSearchParams(params.toString());if(nextScope==="all"){query.delete("scope");query.delete("date");}else{query.set("scope",nextScope);if(nextDate)query.set("date",nextDate);else query.delete("date");}query.delete("page");router.replace(`/archive${query.size?`?${query}`:""}`,{scroll:false});}
  const inputType=scope==="year"?"number":scope==="month"?"month":scope==="week"?"week":"date";
  const values=useMemo(()=>{const raw=scope==="year"?facets.map((item)=>item.year):scope==="month"?facets.map((item)=>`${item.year}-${item.month}`):scope==="week"?facets.map((item)=>isoWeek(`${item.year}-${item.month}-${item.day}`)):facets.map((item)=>`${item.year}-${item.month}-${item.day}`);return [...new Set(raw)].slice(0,10);},[facets,scope]);
  return <div className="archive-period-filter" aria-label="تصفية الأرشيف حسب التاريخ"><div className="archive-scope-tabs" role="tablist" aria-label="فترة الأرشيف">{([['all','الكل'],['year','السنوات'],['month','الشهور'],['week','الأسابيع'],['day','الأيام']] as const).map(([value,text])=><button key={value} type="button" className={scope===value?"active":""} onClick={()=>set(value,"")}>{text}</button>)}</div>{scope!=="all"?<div className="archive-quick-nav"><span>تنقّل سريع:</span><div>{values.map((value)=><button type="button" key={value} className={date===value?"active":""} onClick={()=>set(scope,value)}>{label(scope,value)}</button>)}</div><input type={inputType} min={scope==="year"?"1900":undefined} max={scope==="year"?"2200":undefined} value={date} onChange={(event)=>set(scope,event.target.value)} aria-label="تاريخ الأرشيف"/></div>:null}</div>;
}
