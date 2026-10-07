import "server-only";
import { getRecord, getSettings, listRecords, saveHomepageRecoveryLog, updateRecord, type AdminRecord } from "@/lib/admin-db";
import { isNearDuplicate } from "@/lib/source-policy";

const publicStatuses=new Set(["منشور","معتمد"]);
const recoverableStatuses=new Set(["مسودة","بانتظار المراجعة","بحاجة إلى مراجعة","مستورد","Imported","Approved","معتمد","مجدول"]);
const categoryPriority:Record<string,number>={"رسمي":10,"السياسة":9,"الاقتصاد":8,"المجتمع":7,"التقنية":7,"الذكاء الاصطناعي":7,"الصحة والجمال":6,"التعليم":6,"الرياضة":5,"الثقافة":4,"السفر":3};
const supplyDefaults={minimumHomepagePosts:5,minimumPostsPerCategory:2,minimumReservePosts:10,maximumPostAgeHours:8760,minimumSourceReliability:85,minimumCompletenessScore:6,urgentRetrievalEnabled:true,emergencyAutoPublish:true};
export function homepageSupplySettings(){return {...supplyDefaults,...(getSettings("homepage_supply")[0]?.value||{})} as typeof supplyDefaults;}

function records(){const collected:AdminRecord[]=[];for(let page=1;page<=20;page++){const result=listRecords("content",{page,limit:100});collected.push(...result.data);if(page>=result.meta.pages)break;}return collected;}
function externalUrl(value:unknown){try{const url=new URL(String(value||"")),host=url.hostname.toLowerCase();return ["http:","https:"].includes(url.protocol)&&!["localhost","127.0.0.1","::1"].includes(host)&&!/^10\.|^192\.168\.|^172\.(1[6-9]|2\d|3[01])\./.test(host);}catch{return false;}}
function errors(value:unknown){if(Array.isArray(value))return value.map(String).filter(Boolean);if(typeof value==="string"&&value.trim())return [value];return [];}
function publicationDate(record:AdminRecord){for(const value of [record.data.publishedAt,record.data.originalPublishedAt,record.data.ingestedAt,record.updatedAt,record.createdAt]){const date=new Date(String(value||""));if(!Number.isNaN(date.getTime()))return date;}return new Date(0);}
function dueDate(record:AdminRecord){for(const value of [record.data.scheduledAt,record.data.publishAt,record.data.publicationDate,record.data.publishedAt]){const date=new Date(String(value||""));if(!Number.isNaN(date.getTime()))return date;}return null;}

export function publishability(record:AdminRecord){
  const data=record.data,reasons:string[]=[];
  const title=record.title.trim(),summary=String(data.summary||"").trim(),category=String(data.category||"").trim();
  if(title.length<15)reasons.push("Missing required content: headline");
  if(summary.length<35||isNearDuplicate(title,summary))reasons.push("Missing required content: meaningful non-duplicate summary");
  if(!category||category==="غير محدد")reasons.push("Missing category mapping");
  if(!externalUrl(data.originalUrl||data.sourceUrl))reasons.push("Missing required content: valid external source URL");
  if(data.type==="خبر مستورد"&&(Number(data.editorialVersion)<3||data.verified!==true||errors(data.validationErrors).length))reasons.push("Retrieved item did not pass validation");
  return {valid:reasons.length===0,reasons,completeness:[title,summary,category,data.subcategory,data.originalUrl||data.sourceUrl,data.originalPublishedAt,data.imageUrl,data.details].filter(Boolean).length};
}

function sourceAllowsAutoPublish(record:AdminRecord){if(record.data.automaticPublishingPermission===true||record.data.autoPublish===true)return true;const sourceId=String(record.data.sourceId||"");if(!sourceId)return false;const source=getRecord("sources",sourceId);return Boolean(source&&source.status==="نشط"&&source.data.approved===true&&source.data.verificationStatus==="معتمد"&&(source.data.automaticPublishingPermission===true||source.data.autoPublish===true||source.data.publicationMode==="نشر آلي"));}

export function homepageRank(record:AdminRecord){const data=record.data,date=publicationDate(record).getTime(),ageDays=Math.max(0,(Date.now()-date)/86400000),recency=Math.max(0,100-Math.min(ageDays,100)),importance=Math.min(Math.max(Number(data.importanceScore||data.priorityScore||0),0),100),trust=Math.min(Math.max(Number(data.trust||0),0),100),featured=data.featured===true?25:0,category=categoryPriority[String(data.category||"").split(/[،,]/)[0].trim()]||1,complete=publishability(record).completeness;return recency*5+importance*3+trust*2+featured+category*2+complete;}

export function recoverHomepageContent(triggerType="homepage_load"){
  try{
    const all=records(),now=Date.now(),settings=homepageSupplySettings(),promoted:string[]=[],blocked:Array<{id:string;title:string;status:string;reasons:string[]}>=[],statusCounts:Record<string,number>={};
    for(const record of all){statusCounts[record.status]=(statusCounts[record.status]||0)+1;const check=publishability(record),reasons=[...check.reasons];let promote=false;
      if(record.status==="مجدول"){const due=dueDate(record);if(!due||due.getTime()>now)reasons.push("Scheduled post not activated: publication time has not arrived");else if(check.valid)promote=true;}
      else if(["معتمد","Approved"].includes(record.status)&&check.valid)promote=true;
      else if(recoverableStatuses.has(record.status)&&record.data.type==="خبر مستورد"&&check.valid&&record.data.reviewRequired!==true){if(sourceAllowsAutoPublish(record))promote=true;else reasons.push("Automatic publishing is not enabled for the source");}
      else if(!publicStatuses.has(record.status))reasons.push(`Invalid publication status: ${record.status}`);
      if(promote){updateRecord("content",record.id,{status:"منشور",data:{publishedAt:new Date().toISOString(),postStatus:"منشور",homepageRecoveryAt:new Date().toISOString()}},"نظام استعادة الصفحة الرئيسية");record.status="منشور";promoted.push(record.id);}else if(!publicStatuses.has(record.status)||!check.valid)blocked.push({id:record.id,title:record.title,status:record.status,reasons:[...new Set(reasons)]});
    }
    const qualityEligible=all.filter((record)=>{const check=publishability(record),ageHours=(now-publicationDate(record).getTime())/3600000;return publicStatuses.has(record.status)&&check.valid&&check.completeness>=Number(settings.minimumCompletenessScore)&&Number(record.data.trust||0)>=Number(settings.minimumSourceReliability)&&ageHours<=Number(settings.maximumPostAgeHours);});
    const eligible=qualityEligible.sort((a,b)=>homepageRank(b)-homepageRank(a)),unpublishedReserve=all.filter((record)=>!publicStatuses.has(record.status)&&publishability(record).valid&&record.data.reviewRequired!==true),reserve=[...eligible.slice(Number(settings.minimumHomepagePosts)),...unpublishedReserve],categoryCounts=eligible.reduce<Record<string,number>>((counts,record)=>{const category=String(record.data.category||"غير محدد");counts[category]=(counts[category]||0)+1;return counts;},{}),shortCategories=Object.keys(categoryPriority).filter((category)=>(categoryCounts[category]||0)<Number(settings.minimumPostsPerCategory));
    const shortages={homepage:eligible.length<Number(settings.minimumHomepagePosts),reserve:reserve.length<Number(settings.minimumReservePosts),categories:shortCategories,urgentRetrievalRequired:Boolean(settings.urgentRetrievalEnabled)&&(eligible.length<Number(settings.minimumHomepagePosts)||reserve.length<Number(settings.minimumReservePosts)||shortCategories.length>0)};
    const hadPublished=all.some((record)=>record.status==="منشور"),hasExplicitFeatured=eligible.some((record)=>record.data.featured===true),report={totalRecords:all.length,statusCounts,settings,promotedCount:promoted.length,promoted,eligibleCount:eligible.length,reserveCount:reserve.length,categoryCounts,shortages,blockedCount:blocked.length,blocked:blocked.slice(0,100),diagnostics:{noPublishedPostsFound:!hadPublished,postsExcludedByFilters:Math.max(0,all.length-eligible.length),scheduledPostsNotActivated:blocked.filter((item)=>item.reasons.some((reason)=>reason.startsWith("Scheduled post"))).length,missingCategoryMapping:blocked.filter((item)=>item.reasons.includes("Missing category mapping")).length,invalidPublicationStatus:blocked.filter((item)=>item.reasons.some((reason)=>reason.startsWith("Invalid publication status"))).length,missingRequiredContent:blocked.filter((item)=>item.reasons.some((reason)=>reason.startsWith("Missing required content"))).length,featuredPostQueryFailure:false,featuredFallbackApplied:eligible.length>0&&!hasExplicitFeatured,cacheNotRefreshed:false}};
    saveHomepageRecoveryLog(triggerType,eligible.length?promoted.length?"recovered_and_selected":"selected":"genuine_empty",eligible[0]?.id||null,report);
    return {eligible,promoted,blocked,report};
  }catch(error){const message=error instanceof Error?error.message:"Unknown database or API error";try{saveHomepageRecoveryLog(triggerType,"failed",null,{diagnostics:{databaseOrApiError:message}});}catch{}return {eligible:[] as AdminRecord[],promoted:[],blocked:[],report:{diagnostics:{databaseOrApiError:message}}};}
}
