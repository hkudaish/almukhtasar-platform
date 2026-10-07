"use client";

import { ArrowLeft, CheckCircle2, ExternalLink, Hash, RefreshCw, TrendingUp } from "lucide-react";
import { useEffect, useMemo, useState, type CSSProperties } from "react";
import type { SocialPlatform, SocialPlatformStatus, SocialTrend } from "@/lib/social-types";

const platforms:Array<{value:SocialPlatform;label:string;mark:string;accent:string}>=[
  {value:"X",label:"إكس (X)",mark:"X",accent:"#111827"},
  {value:"YouTube",label:"يوتيوب",mark:"▶",accent:"#ff0033"},
  {value:"Instagram",label:"إنستغرام",mark:"◎",accent:"#d62976"},
  {value:"Facebook",label:"فيسبوك",mark:"f",accent:"#1877f2"},
  {value:"LinkedIn",label:"لينكدإن",mark:"in",accent:"#0a66c2"},
  {value:"TikTok",label:"تيك توك",mark:"♪",accent:"#00a9b8"},
  {value:"Threads",label:"ثريدز",mark:"@",accent:"#111827"},
  {value:"Telegram",label:"تيليجرام",mark:"➤",accent:"#229ed9"},
  {value:"Snapchat",label:"سناب شات",mark:"◉",accent:"#e0b900"},
];

type Payload={data:SocialTrend[];statuses:SocialPlatformStatus[];topics:Partial<Record<SocialPlatform,string[]>>;updatedAt:string|null};
function displayTime(value:string|null){if(!value)return "";try{return new Intl.DateTimeFormat("ar-SA",{dateStyle:"medium",timeStyle:"short"}).format(new Date(value));}catch{return value;}}

export default function SocialTrends(){
  const [activePlatform,setActivePlatform]=useState<SocialPlatform>("X");
  const [payload,setPayload]=useState<Payload>({data:[],statuses:[],topics:{},updatedAt:null});
  const [loading,setLoading]=useState(true),[refreshing,setRefreshing]=useState(false),[loadError,setLoadError]=useState("");
  async function load(){try{const response=await fetch(`/api/social-trends?t=${Date.now()}`,{cache:"no-store"});if(!response.ok)throw new Error();setPayload(await response.json() as Payload);setLoadError("");}catch{setLoadError("تعذر تحميل بيانات الرصد الاجتماعي.");}finally{setLoading(false);}}
  async function refresh(){setRefreshing(true);setLoadError("");try{const response=await fetch("/api/admin/social-trends/refresh",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({triggerType:"manual"}),cache:"no-store"});if(!response.ok)throw new Error();await load();}catch{setLoadError("تعذر تحديث موصلات الرصد الاجتماعي.");}finally{setRefreshing(false);}}
  useEffect(()=>{void load();const timer=window.setInterval(()=>void load(),60*1000);const onUpdate=()=>void load();window.addEventListener("almukhtasar-social-updated",onUpdate);return()=>{window.clearInterval(timer);window.removeEventListener("almukhtasar-social-updated",onUpdate);};},[]);
  const active=platforms.find((item)=>item.value===activePlatform)!;
  const visibleTrends=useMemo(()=>payload.data.filter((item)=>item.platform===activePlatform).slice(0,4),[payload.data,activePlatform]);
  const status=payload.statuses.find((item)=>item.platform===activePlatform),topics=payload.topics[activePlatform]||[];
  const statusText=status?.status==="updated"?`محدّث: ${displayTime(status.finishedAt)}`:status?.message||"بانتظار حالة الموصل";
  return <section className="social-trends-section focused-trends" aria-labelledby="social-trends-title"><div className="container">
    <div className="focused-section-heading"><div><span>رصد مختصر</span><h2 id="social-trends-title">الرائج اجتماعياً</h2></div><div className="social-heading-actions"><p>منشورات وأحداث عامة مسترجعة من موصلات المنصات، مع رابط المصدر ووقت التحديث.</p><button type="button" onClick={refresh} disabled={refreshing}>{refreshing?<RefreshCw className="spin"/>:<RefreshCw/>}{refreshing?" جارٍ التحديث…":" تحديث الآن"}</button></div></div>
    <div className="focused-platform-tabs" role="tablist" aria-label="اختر منصة اجتماعية">{platforms.map((platform)=><button key={platform.value} type="button" role="tab" aria-selected={activePlatform===platform.value} className={activePlatform===platform.value?"active":""} onClick={()=>setActivePlatform(platform.value)}><span>{platform.mark}</span>{platform.label}</button>)}</div>
    <div className={`social-connector-status ${status?.status||"empty"}`}><RefreshCw size={13}/><span>{loading?"جارٍ تحميل آخر رصد…":loadError||statusText}</span></div>
    <div className="focused-trends-panel">
      <div className="focused-hashtags"><div className="focused-trends-subhead"><Hash size={17}/><strong>أبرز الموضوعات على {active.label}</strong></div>{topics.length?<ol>{topics.map((topic,index)=>{const match=payload.data.find((item)=>item.platform===activePlatform&&item.topic===topic);return <li key={topic}><a href={match?.url||"#"} target={match?"_blank":undefined} rel={match?"noreferrer":undefined}><b>{index+1}</b><span>{topic}</span><ArrowLeft size={15}/></a></li>;})}</ol>:<div className="focused-social-empty"><strong>لا توجد موضوعات موثقة بعد.</strong><p>ستظهر بعد نجاح موصل المنصة.</p></div>}<small>الموضوعات مشتقة من المنشورات المسترجعة وليست قائمة ثابتة.</small></div>
      <div className="focused-social-posts"><div className="focused-trends-subhead"><TrendingUp size={17}/><strong>منشورات وأحداث مسترجعة</strong></div>{visibleTrends.length?visibleTrends.map((trend)=><article key={trend.id} style={{"--platform-color":active.accent} as CSSProperties}><header><div><strong>{trend.account}</strong>{trend.verified&&<CheckCircle2 size={13} aria-label="حساب موثق"/>}</div><span>{displayTime(trend.publishedAt||trend.retrievedAt)}</span></header><p>{trend.text}</p><footer><span>{trend.topic||trend.handle||active.label}</span><a href={trend.url} target="_blank" rel="noreferrer">المصدر <ExternalLink size={14}/></a></footer></article>):<div className="focused-social-empty"><strong>{loading?"جارٍ تحميل البيانات…":"لا توجد منشورات صالحة للنشر حالياً."}</strong><p>{loadError||status?.message||"لن تُعرض بيانات تجريبية أو قديمة بدلاً من نتائج الموصل."}</p></div>}</div>
    </div><p className="social-disclaimer">تتحقق الواجهة من البيانات كل دقيقة. يلزم ضبط موصل API رسمي لكل منصة؛ لا تُعرض بيانات تجريبية ولا تُستبدل النتائج الصحيحة إذا فشل الموصل.</p>
  </div></section>;
}
