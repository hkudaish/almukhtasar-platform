import "server-only";
import { getHomepageSnapshot, getRecord, listRecords, saveHomepageSnapshot } from "@/lib/admin-db";
import type { Story } from "@/lib/data";
import { conciseNewsTitle, isNearDuplicate, removeEditorialBoilerplate, structureRetrievedNews } from "@/lib/source-policy";
import { homepageRank, publishability, recoverHomepageContent } from "@/lib/homepage-recovery";

const publicStatuses=new Set(["منشور","معتمد"]);
function allContentRecords(){const records=[];for(let page=1;page<=20;page++){const result=listRecords("content",{page,limit:100});records.push(...result.data);if(page>=result.meta.pages)break;}return records;}

function validDate(value:unknown){
  const date=new Date(String(value||""));
  return Number.isNaN(date.getTime())?new Date():date;
}

function relativeTime(date:Date){
  const minutes=Math.max(0,Math.floor((Date.now()-date.getTime())/60000));
  if(minutes<1)return "الآن";
  if(minutes<60)return `منذ ${minutes} دقيقة`;
  const hours=Math.floor(minutes/60);
  if(hours<24)return `منذ ${hours} ساعة`;
  return date.toLocaleDateString("ar-SA",{day:"numeric",month:"short"});
}

function publicImageUrl(value:unknown){
  if(typeof value!=="string"||!value.trim())return undefined;
  if(value.startsWith("/api/media/category-fallback/"))return value;
  try{
    const url=new URL(value),path=url.pathname.toLowerCase();
    if(!["http:","https:"].includes(url.protocol)||path==="/"||/\/(?:ar|en)?\/?news\/?$/.test(path))return undefined;
    return url.toString();
  }catch{return undefined;}
}

function publicPageUrl(value:unknown){
  if(typeof value!=="string"||!value.trim())return undefined;
  try{const url=new URL(value),host=url.hostname.toLowerCase();return ["http:","https:"].includes(url.protocol)&&!["localhost","127.0.0.1","::1"].includes(host)&&!/^10\.|^192\.168\.|^172\.(1[6-9]|2\d|3[01])\.|^169\.254\./.test(host)?url.toString():undefined;}catch{return undefined;}
}

function toStory(record:ReturnType<typeof getRecord>):Story|null{
  if(!record||!publicStatuses.has(record.status))return null;
  const data=record.data;
  if(!publishability(record).valid)return null;
  if(data.type==="خبر مستورد"&&Number(data.editorialVersion)<3)return null;
  const storedSummary=removeEditorialBoilerplate(String(data.summary||""));
  const legacyStructured=structureRetrievedNews(record.title,storedSummary||record.title);
  const isStructured=Number(data.editorialVersion)>=2;
  const title=isStructured?conciseNewsTitle(removeEditorialBoilerplate(record.title)):legacyStructured.title;
  const summary=isStructured?storedSummary:legacyStructured.summary;
  if(!title||!summary||isNearDuplicate(title,summary))return null;
  const storedDetails=Array.isArray(data.details)?data.details.map(String):String(data.details||"").split(/\n{2,}/);
  const details=(isStructured?storedDetails:legacyStructured.details).map(removeEditorialBoilerplate).filter((item,index,all)=>item&&!isNearDuplicate(item,title)&&!isNearDuplicate(item,summary)&&all.findIndex((candidate)=>isNearDuplicate(candidate,item))===index);
  const published=validDate(data.originalPublishedAt||data.ingestedAt||record.createdAt);
  const originalUrl=String(data.originalUrl||data.sourceUrl||"");
  const externalOriginalUrl=publicPageUrl(originalUrl);
  if(!externalOriginalUrl)return null;
  const source=String(data.source||"مصدر معتمد").trim().replace(/(?<![\p{L}\p{N}])([\p{L}\p{N}]{3,})(?:\s+\1)+(?![\p{L}\p{N}])/giu,"$1").replace(/^(.{2,80}?)\s+\1$/u,"$1");
  const supportingSources=(Array.isArray(data.supportingSources)?data.supportingSources:[]).map((value)=>value as Record<string,unknown>).map((value)=>{const url=publicPageUrl(value.url);return url?{name:String(value.name||"مصدر داعم"),url,role:"داعم" as const,type:"مصدر إخباري",publishedAt:String(value.publishedAt||"")}:null;}).filter((value):value is NonNullable<typeof value>=>Boolean(value)).filter((value,index,all)=>value.url!==externalOriginalUrl&&all.findIndex((candidate)=>candidate.url===value.url)===index).slice(0,4);
  return {
    id:`imported-${record.id}`,
    title,
    summary,
    category:String(data.category||"عام").split(/[،,]/)[0].trim()||"عام",
    subcategory:String(data.subcategory||String(data.category||"").split(/[،,]/)[1]||"").trim()||undefined,
    time:relativeTime(published),
    publishedAt:published.toISOString(),
    readTime:"دقيقة واحدة",
    source,
    sources:[{name:source,url:externalOriginalUrl,role:"أساسي",type:String(data.sourceType||"مصدر إخباري"),publishedAt:published.toLocaleString("ar-SA")},...supportingSources],
    confidence:Math.min(Math.max(Number(data.trust)||80,0),100),
    accent:"linear-gradient(135deg,#17364d,#28708c)",
    tags:[String(data.category||"عام")],
    bullets:[summary],
    details,
    whyItMatters:"",
    imageUrl:data.imageIsFallback===true?publicImageUrl(data.imageUrl)||`/api/media/category-fallback/${encodeURIComponent(String(data.category||"عام"))}`:publicImageUrl(data.imageUrl)?data.type==="خبر مستورد"?`/api/media/source-image/${record.id}?v=${encodeURIComponent(String(data.imageVerifiedAt||record.updatedAt))}`:publicImageUrl(data.imageUrl):`/api/media/category-fallback/${encodeURIComponent(String(data.category||"عام"))}`,
    imageAlt:typeof data.imageAlt==="string"?data.imageAlt:record.title,
    imageCredit:typeof data.imageCredit==="string"?data.imageCredit:source
    ,badge:data.breaking===true?"عاجل":data.updatedBadge===true?"محدّث":undefined
  };
}

export function getPublishedImportedStories(limit=50){
  return allContentRecords().sort((a,b)=>homepageRank(b)-homepageRank(a)).map((record)=>toStory(record)).filter((story):story is Story=>Boolean(story)).slice(0,Math.min(Math.max(limit,1),100));
}

export function getHomepageStories(limit=20){const recovery=recoverHomepageContent("homepage_load"),stories=recovery.eligible.slice(0,Math.min(Math.max(limit,1),100)).map((record)=>toStory(record)).filter((story):story is Story=>Boolean(story));if(stories[0])saveHomepageSnapshot(stories[0] as unknown as Record<string,unknown>,`ranking:${recovery.eligible[0]?.id||"unknown"}`);if(stories.length)return stories;const snapshot=getHomepageSnapshot();return snapshot?.story?.id?[snapshot.story as unknown as Story]:[];}

export function getPublishedImportedStoriesByCategory(category:string,limit=50){
  return allContentRecords().map((record)=>toStory(record)).filter((story):story is Story=>Boolean(story)).filter((story)=>story.category===category).sort((a,b)=>new Date(b.publishedAt).getTime()-new Date(a.publishedAt).getTime()).slice(0,Math.min(Math.max(limit,1),100));
}

export function getPublishedImportedStory(id:string){
  if(!id.startsWith("imported-"))return null;
  return toStory(getRecord("content",id.slice("imported-".length)));
}
