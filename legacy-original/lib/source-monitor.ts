import "server-only";
import { listRecords, listSourceRetrievalStates, listSocialRefreshStatuses, type AdminRecord, type SourceRetrievalState } from "@/lib/admin-db";
import { createSourceAdapter } from "@/lib/news-pipeline";

export const SOURCE_HEALTH_STATUSES=["Healthy","Degraded","Failing","Authentication Required","Rate Limited","Configuration Error","Paused"] as const;
export type OperationalSourceStatus=typeof SOURCE_HEALTH_STATUSES[number];

export type SourceHealthRow={
  id:string;name:string;sourceType:string;retrievalMethod:string;categories:string[];
  lastChecked:string|null;lastSuccessfulConnection:string|null;lastArticleDiscovered:string|null;
  lastArticleRetrieved:string|null;lastPostPublished:string|null;recentItemsFound:number;
  imageRetrievalSuccess:number;averageProcessingTime:number|null;consecutiveFailures:number;
  healthStatus:OperationalSourceStatus;healthReason:string;noRecentContent:boolean;isSocial:boolean;
};

function categories(record:AdminRecord){
  return String(record.data.categories||record.data.category||"").split(/[،,\n]+/).map((value)=>value.trim()).filter(Boolean);
}
function mappedStatus(record:AdminRecord,state:SourceRetrievalState|null,hasConnector:boolean,noRecentContent:boolean):{status:OperationalSourceStatus;reason:string}{
  if(record.status!=="نشط")return {status:"Paused",reason:"المصدر متوقف إداريًا ولن يدخل جولات الجلب."};
  if(!hasConnector)return {status:"Configuration Error",reason:"لا يوجد API أو RSS/Atom أو صفحة أخبار صالحة في موصل المصدر."};
  const error=state?.lastError||"";
  if(/\b(?:401|403)\b|auth|token|credential|مصادقة|تفويض/i.test(error))return {status:"Authentication Required",reason:error};
  if(/\b429\b|rate.?limit|too many requests|تجاوز.*حد/i.test(error))return {status:"Rate Limited",reason:error};
  if((state?.consecutiveFailures||0)>=3)return {status:"Failing",reason:error||"فشل المصدر في ثلاث جولات متتالية أو أكثر."};
  if((state?.consecutiveFailures||0)>0)return {status:"Degraded",reason:error||"نجح المصدر سابقًا لكنه أخفق في آخر جولة."};
  if(!state?.lastCheckedAt)return {status:"Degraded",reason:"المصدر مهيأ لكنه لم يُختبر بعد."};
  if(noRecentContent)return {status:"Degraded",reason:"الاتصال يعمل، لكن لم تُكتشف مادة حديثة خلال نافذة المتابعة."};
  if(state.imageFailures>0&&state.imageFailures>=Math.max(2,state.articlesAccepted))return {status:"Degraded",reason:"معدل الحصول على الصور منخفض ويحتاج مراجعة موصل الصور."};
  return {status:"Healthy",reason:"اكتملت آخر جولة دون إخفاقات تشغيلية مسجلة."};
}

export function buildSourceHealthSnapshot(){
  const records=listRecords("sources",{limit:100}).data;
  const states=new Map(listSourceRetrievalStates().map((state)=>[state.sourceId,state]));
  const content:AdminRecord[]=[];
  for(let page=1;page<=100;page++){const result=listRecords("content",{page,limit:100});content.push(...result.data);if(page>=result.meta.pages)break;}
  const now=Date.now(),freshCutoff=now-48*60*60*1000;
  const news:SourceHealthRow[]=records.map((record)=>{
    const state=states.get(record.id)||null,adapter=createSourceAdapter(record);
    const sourceContent=content.filter((item)=>item.data.sourceId===record.id);
    const published=sourceContent.filter((item)=>item.status==="منشور").sort((a,b)=>Date.parse(b.updatedAt)-Date.parse(a.updatedAt))[0];
    const recent=sourceContent.filter((item)=>{const value=String(item.data.originalPublishedAt||item.updatedAt);return Number.isFinite(Date.parse(value))&&Date.parse(value)>=freshCutoff;});
    const lastPublicationDate=state?.lastPublicationDate||null;
    const noRecentContent=Boolean(state?.lastSuccessAt)&&!recent.length&&(!lastPublicationDate||Date.parse(lastPublicationDate)<freshCutoff);
    const mapped=mappedStatus(record,state,adapter.endpoints.length>0,noRecentContent);
    const processed=Math.max(0,state?.articlesAccepted||0)+(state?.articlesRejected||0),imageSuccess=processed?Math.max(0,Math.round(((processed-(state?.imageFailures||0))/processed)*100)):0;
    return {id:record.id,name:record.title,sourceType:String(record.data.type||"موقع إخباري"),retrievalMethod:state?.retrievalMethod||adapter.endpoints[0]?.method||String(record.data.fetchMethod||"غير محدد"),categories:categories(record),lastChecked:state?.lastCheckedAt||null,lastSuccessfulConnection:state?.lastSuccessAt||null,lastArticleDiscovered:state?.lastArticleAt||null,lastArticleRetrieved:state?.lastArticleAt||null,lastPostPublished:published?.updatedAt||null,recentItemsFound:recent.length,imageRetrievalSuccess:imageSuccess,averageProcessingTime:state?.responseTimeMs||null,consecutiveFailures:state?.consecutiveFailures||0,healthStatus:mapped.status,healthReason:mapped.reason,noRecentContent,isSocial:false};
  });
  const social:SourceHealthRow[]=listSocialRefreshStatuses().map((item)=>{
    const status:OperationalSourceStatus=item.status==="updated"?"Healthy":item.status==="unconfigured"?"Configuration Error":item.status==="failed"?"Failing":"Degraded";
    return {id:`social:${item.platform}`,name:item.platform,sourceType:"منصة اجتماعية",retrievalMethod:"Official API / approved integration",categories:["رصد اجتماعي"],lastChecked:item.finishedAt,lastSuccessfulConnection:item.status==="updated"?item.finishedAt:null,lastArticleDiscovered:item.itemCount?item.finishedAt:null,lastArticleRetrieved:item.itemCount?item.finishedAt:null,lastPostPublished:null,recentItemsFound:item.itemCount,imageRetrievalSuccess:0,averageProcessingTime:item.startedAt&&item.finishedAt?Math.max(0,Date.parse(item.finishedAt)-Date.parse(item.startedAt)):null,consecutiveFailures:item.status==="failed"?1:0,healthStatus:status,healthReason:item.message,noRecentContent:item.itemCount===0,isSocial:true};
  });
  const sources=[...news,...social];
  const summary={all:sources.length,healthy:sources.filter((item)=>item.healthStatus==="Healthy").length,degraded:sources.filter((item)=>item.healthStatus==="Degraded").length,failing:sources.filter((item)=>["Failing","Authentication Required","Rate Limited","Configuration Error"].includes(item.healthStatus)).length,social:sources.filter((item)=>item.isSocial).length,noRecentContent:sources.filter((item)=>item.noRecentContent).length};
  return {sources,summary,generatedAt:new Date().toISOString()};
}

export function buildWatchdogReport(){
  const snapshot=buildSourceHealthSnapshot(),news=snapshot.sources.filter((source)=>!source.isSocial),healthy=news.filter((source)=>source.healthStatus==="Healthy");
  const allContent:AdminRecord[]=[];for(let page=1;page<=100;page++){const result=listRecords("content",{page,limit:100});allContent.push(...result.data);if(page>=result.meta.pages)break;}
  const inventory={published:0,readyToPublish:0,pendingReview:0,reserve:0,archived:0};
  for(const item of allContent){if(item.status==="منشور")inventory.published++;else if(["معتمد","مجدول"].includes(item.status))inventory.readyToPublish++;else if(["بانتظار المراجعة","بحاجة إلى مراجعة","بحاجة إلى تحقق"].includes(item.status))inventory.pendingReview++;else if(item.status==="احتياطي")inventory.reserve++;else if(item.status==="مؤرشف"||item.deleted)inventory.archived++;}
  const categorySources=new Map<string,Set<string>>();
  for(const source of healthy)for(const category of source.categories){if(!categorySources.has(category))categorySources.set(category,new Set());categorySources.get(category)!.add(source.id);}
  const alerts:Array<{severity:"critical"|"warning";code:string;message:string;sourceId?:string;category?:string;recovery:string}>=[];
  if(healthy.length<=2)alerts.push({severity:"critical",code:"SOURCE_CONCENTRATION",message:"مصدران أو أقل فقط في حالة سليمة؛ هناك خطر اعتماد المنصة على ناشرين محدودين.",recovery:"تشغيل اختبار شامل ثم جلب بدائل التصنيفات المتأثرة."});
  for(const [category,ids] of categorySources)if(ids.size<2)alerts.push({severity:"warning",code:"CATEGORY_SINGLE_SOURCE",category,message:`التصنيف «${category}» يعتمد حاليًا على مصدر سليم واحد فقط.`,recovery:"تشغيل المصادر البديلة المعتمدة لهذا التصنيف."});
  for(const source of news.filter((item)=>item.healthStatus!=="Healthy"))alerts.push({severity:source.healthStatus==="Failing"?"critical":"warning",code:"SOURCE_UNHEALTHY",sourceId:source.id,message:`${source.name}: ${source.healthReason}`,recovery:source.healthStatus==="Configuration Error"?"تصحيح إعدادات الموصل.":"إعادة المحاولة بطريقة الجلب البديلة مع تراجع زمني."});
  const social=snapshot.sources.filter((source)=>source.isSocial);
  if(!social.length||social.every((source)=>source.healthStatus!=="Healthy"))alerts.push({severity:"warning",code:"SOCIAL_STOPPED",message:"لا توجد منصة اجتماعية متصلة وتنتج محتوى حديثًا.",recovery:"ضبط موصل API رسمي واحد على الأقل وتشغيل تحديث المنصات."});
  const reserveMinimum=Math.max(10,Number(process.env.NEWS_RESERVE_MINIMUM)||20),publishableInventory=inventory.readyToPublish+inventory.reserve;
  if(publishableInventory<reserveMinimum)alerts.push({severity:"warning",code:"RESERVE_LOW",message:`المخزون القابل للنشر ${publishableInventory} فقط، وهو أقل من الحد ${reserveMinimum}.`,recovery:"تشغيل جلب إضافي مع إعطاء أولوية للتصنيفات ناقصة التغطية ثم الرصد الاجتماعي."});
  const recentPublished=allContent.filter((item)=>item.status==="منشور"&&Date.parse(String(item.data.originalPublishedAt||item.updatedAt))>=Date.now()-72*60*60*1000);
  const bySource=new Map<string,number>();for(const item of recentPublished){const source=String(item.data.source||"غير معروف");bySource.set(source,(bySource.get(source)||0)+1);}
  const dominant=[...bySource].sort((a,b)=>b[1]-a[1])[0];
  if(dominant&&recentPublished.length>=5&&dominant[1]/recentPublished.length>.45)alerts.push({severity:"warning",code:"SOURCE_DOMINANCE",message:`المصدر «${dominant[0]}» يمثل ${Math.round(dominant[1]/recentPublished.length*100)}% من المنشورات الحديثة.`,recovery:"خفض أولوية المصدر المهيمن مؤقتًا وتشغيل بدائل التصنيفات نفسها."});
  return {...snapshot,inventory:{...inventory,publishable:publishableInventory,minimum:reserveMinimum},sourceDistribution:Object.fromEntries(bySource),alerts,needsRecovery:alerts.some((alert)=>alert.severity==="critical")||publishableInventory<reserveMinimum};
}
