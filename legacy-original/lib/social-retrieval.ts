import "server-only";
import { createHash } from "node:crypto";
import { listSocialRefreshStatuses, listStoredSocialTrends, replaceStoredSocialTrends, saveSocialRefreshStatus } from "@/lib/admin-db";
import { socialPlatforms, type SocialMetric, type SocialPlatform, type SocialPlatformStatus, type SocialTrend } from "@/lib/social-types";

const connectorKeys:Record<SocialPlatform,{url:string;token:string}>={
  X:{url:"SOCIAL_X_API_URL",token:"SOCIAL_X_BEARER_TOKEN"},
  YouTube:{url:"SOCIAL_YOUTUBE_API_URL",token:"SOCIAL_YOUTUBE_ACCESS_TOKEN"},
  Instagram:{url:"SOCIAL_INSTAGRAM_API_URL",token:"SOCIAL_INSTAGRAM_ACCESS_TOKEN"},
  Facebook:{url:"SOCIAL_FACEBOOK_API_URL",token:"SOCIAL_FACEBOOK_ACCESS_TOKEN"},
  LinkedIn:{url:"SOCIAL_LINKEDIN_API_URL",token:"SOCIAL_LINKEDIN_ACCESS_TOKEN"},
  TikTok:{url:"SOCIAL_TIKTOK_API_URL",token:"SOCIAL_TIKTOK_ACCESS_TOKEN"},
  Threads:{url:"SOCIAL_THREADS_API_URL",token:"SOCIAL_THREADS_ACCESS_TOKEN"},
  Telegram:{url:"SOCIAL_TELEGRAM_API_URL",token:"SOCIAL_TELEGRAM_BOT_TOKEN"},
  Snapchat:{url:"SOCIAL_SNAPCHAT_API_URL",token:"SOCIAL_SNAPCHAT_ACCESS_TOKEN"},
};

function externalUrl(value:unknown){try{const url=new URL(String(value||""));return ["http:","https:"].includes(url.protocol)&&!["localhost","127.0.0.1","::1"].includes(url.hostname)&&!/^10\.|^192\.168\.|^172\.(1[6-9]|2\d|3[01])\./.test(url.hostname)?url.toString():"";}catch{return "";}}
function text(value:unknown){return String(value??"").replace(/<[^>]+>/g," ").replace(/\s+/g," ").trim();}
function first(...values:unknown[]){return values.find((value)=>typeof value==="string"&&value.trim())||"";}
function rowsFromPayload(payload:unknown):unknown[]{
  if(Array.isArray(payload))return payload;
  if(!payload||typeof payload!=="object")return [];
  const root=payload as Record<string,unknown>;
  for(const key of ["items","posts","videos","results","data"]){const value=root[key];if(Array.isArray(value))return value;if(value&&typeof value==="object"){const nested=value as Record<string,unknown>;for(const nestedKey of ["items","posts","results","data"]){if(Array.isArray(nested[nestedKey]))return nested[nestedKey] as unknown[];}}}
  return [];
}
function metricsFromRow(row:Record<string,unknown>):SocialMetric[]{
  const raw=row.metrics??row.statistics??row.engagement;
  if(Array.isArray(raw))return raw.slice(0,4).map((entry)=>{const item=entry as Record<string,unknown>;return {label:text(item.label||item.name),value:text(item.value||item.count)};}).filter((item)=>item.label&&item.value);
  if(raw&&typeof raw==="object")return Object.entries(raw as Record<string,unknown>).slice(0,4).map(([label,value])=>({label,value:text(value)})).filter((item)=>item.value);
  return [];
}
function normalizeRow(platform:SocialPlatform,raw:unknown,retrievedAt:string):SocialTrend|null{
  if(!raw||typeof raw!=="object")return null;
  const row=raw as Record<string,unknown>,owner=(row.author||row.user||row.account||row.channel||row.owner) as Record<string,unknown>|string|undefined;
  const account=text(typeof owner==="object"&&owner?first(owner.name,owner.title,owner.username):first(owner,row.accountName,row.channelTitle,row.authorName));
  const body=text(first(row.text,row.caption,row.description,row.title,row.content));
  const url=externalUrl(first(row.url,row.permalink,row.webUrl,row.shareUrl,row.link));
  if(!account||body.length<20||!url)return null;
  const publishedRaw=text(first(row.publishedAt,row.publishTime,row.createdAt,row.date,row.timestamp));
  const timestamp=publishedRaw&&!Number.isNaN(Date.parse(publishedRaw))?new Date(publishedRaw).toISOString():null;
  const topic=text(first(row.topic,row.hashtag,row.category))||body.match(/#[\p{L}\p{N}_]+/u)?.[0]||"";
  const handle=text(first(row.handle,row.username,typeof owner==="object"&&owner?owner.username:""));
  const id=text(row.id)||createHash("sha256").update(`${platform}:${url}`).digest("hex").slice(0,24);
  const source=text(row.source)||platform,identifiableEvent=/(?:أعلن|أعلنت|أطلق|أطلقت|كشف|كشفت|فاز|فازت|حقق|حققت|بدأ|بدأت|تنطلق|وقّع|وقعت|اعتمد|اعتمدت|صدر|افتتح|افتتحت|نتائج|قرار|تحديث)/u.test(body);
  const normalized={source_id:`social:${platform}:${handle||account}`,source_name:account,source_type:"official_social_platform",external_article_id:id,original_url:url,canonical_url:url,original_title:text(row.title)||body.slice(0,120),clean_title:text(row.title)||body.slice(0,120),original_content:body,clean_content:body,summary:body.slice(0,280),additional_context:[],main_image:"",image_original_url:null,image_local_url:null,image_alt:"",author:account,date_published:timestamp,date_modified:null,date_retrieved:retrievedAt,main_category:topic||"رصد اجتماعي",subcategories:[platform],region:"",country:"",keywords:[...new Set(body.match(/#[\p{L}\p{N}_]+/gu)||[])].slice(0,12),entities:[account],retrieval_method:"Official platform API / approved integration",retrieval_confidence:identifiableEvent?90:75,validation_status:identifiableEvent?"Validated social event":"Social observation only",duplicate_status:"Unique URL",publication_status:identifiableEvent?"eligible_for_editorial_pipeline":"social_feed_only"};
  return {id:`${platform.toLowerCase()}-${id}`,platform,account,handle,verified:Boolean(row.verified||(typeof owner==="object"&&owner&&owner.verified)),text:body.slice(0,500),topic,publishedAt:timestamp,metrics:metricsFromRow(row),url,source,retrievedAt,normalized};
}

function config(platform:SocialPlatform){const keys=connectorKeys[platform];return {url:process.env[keys.url]?.trim()||"",token:process.env[keys.token]?.trim()||""};}

export async function refreshSocialPlatform(platform:SocialPlatform){
  const startedAt=new Date().toISOString(),connector=config(platform);
  if(!connector.url){return saveSocialRefreshStatus(platform,"unconfigured",`أضف ${connectorKeys[platform].url} لربط مصدر موثوق.`,0,startedAt);}
  const url=externalUrl(connector.url);
  if(!url)return saveSocialRefreshStatus(platform,"failed","عنوان موصل المنصة غير صالح أو محلي.",0,startedAt);
  try{
    const response=await fetch(url,{headers:{Accept:"application/json",...(connector.token?{Authorization:`Bearer ${connector.token}`}:{})},cache:"no-store",redirect:"follow",signal:AbortSignal.timeout(20000)});
    if(!response.ok)throw new Error(`HTTP ${response.status}`);
    const retrievedAt=new Date().toISOString();
    const items=rowsFromPayload(await response.json()).map((row)=>normalizeRow(platform,row,retrievedAt)).filter((item):item is SocialTrend=>Boolean(item));
    const unique=items.filter((item,index,all)=>all.findIndex((candidate)=>candidate.url===item.url)===index).slice(0,20);
    if(!unique.length)return saveSocialRefreshStatus(platform,"empty","لم يُرجع الموصل منشورات صالحة؛ احتُفظ بالبيانات السابقة.",0,startedAt);
    replaceStoredSocialTrends(platform,unique);
    return saveSocialRefreshStatus(platform,"updated","اكتمل التحديث من الموصل الخارجي.",unique.length,startedAt);
  }catch(error){return saveSocialRefreshStatus(platform,"failed",`تعذر التحديث: ${error instanceof Error?error.message:"خطأ غير معروف"}`,0,startedAt);}
}

export async function refreshAllSocialPlatforms(){return Promise.all(socialPlatforms.map(refreshSocialPlatform));}

export function getSocialTrendsPayload(){
  const stored=listStoredSocialTrends() as SocialTrend[],saved=new Map(listSocialRefreshStatuses().map((item)=>[item.platform,item]));
  const freshnessHours=Math.min(Math.max(Number(process.env.SOCIAL_FRESHNESS_HOURS)||48,1),168),freshnessCutoff=Date.now()-freshnessHours*60*60*1000;
  const fresh=stored.filter((item)=>Boolean(item.publishedAt)&&Number.isFinite(Date.parse(String(item.publishedAt)))&&Date.parse(String(item.publishedAt))>=freshnessCutoff);
  const statuses=socialPlatforms.map((platform):SocialPlatformStatus=>{
    const current=saved.get(platform),configured=Boolean(config(platform).url),freshCount=fresh.filter((item)=>item.platform===platform).length,storedCount=stored.filter((item)=>item.platform===platform).length;
    if(!current)return {platform,status:configured?"empty":"unconfigured",message:configured?"الموصل جاهز ولم يُشغّل بعد.":`لم يُضبط ${connectorKeys[platform].url}.`,itemCount:freshCount,startedAt:null,finishedAt:null};
    const staleMessage=storedCount>0&&!freshCount?`لا توجد منشورات خلال آخر ${freshnessHours} ساعة؛ أُخفيت النتائج القديمة.`:current.message;
    return {platform,status:(freshCount?current.status:current.status==="updated"?"empty":current.status) as SocialPlatformStatus["status"],message:staleMessage,itemCount:freshCount,startedAt:current.startedAt,finishedAt:current.finishedAt};
  });
  const topics=Object.fromEntries(socialPlatforms.map((platform)=>[platform,[...new Set(fresh.filter((item)=>item.platform===platform).map((item)=>item.topic).filter(Boolean))].slice(0,5)]));
  return {data:fresh,statuses,topics,updatedAt:statuses.map((item)=>item.finishedAt).filter(Boolean).sort().at(-1)||null,meta:{freshnessHours,staleItemsHidden:stored.length-fresh.length}};
}
