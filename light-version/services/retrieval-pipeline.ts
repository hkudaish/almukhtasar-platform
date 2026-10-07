import { randomUUID } from "node:crypto";
import { adapterFor } from "@/services/adapters";
import { resolveFeaturedImage } from "@/services/image-resolution";
import { classifyArticle, cleanParagraphs, eventFingerprint, hash, isApprovedSource, normalizeArabic, parseSourceDate, summarizeArticle, validateHydratedArticle } from "@/lib/content-policy";
import {
  acquireSourceLock, enqueue, findDuplicate, finishJob, finishRun, freshnessInventory, getSettings, insertArticle,
  findKnownDiscoveredArticle, getSource, invalidateCache, listArticlesMissingImages, listSources, logArticleRetrieval, prepareHomepageSnapshot, recordSourceResult, recoverEligibleReviewPosts, releaseSourceLock, retryJob, startRun, trackedArticleForRefresh, updateSourceState,
  updateArticleBreaking, updateArticleImage, updateMaterialArticle, updateSupportingReference
} from "@/database/database";
import { runArchiveLifecycle } from "@/database/database";
import { activeNewsWindow, isInActiveNewsWindow } from "@/lib/news-window";
import { classifyGeography, scoreEditorialPriority } from "@/lib/editorial-policy";
import { cleanVerifiedBreakingTitle } from "@/lib/breaking-news";
import { extractSemanticTags } from "@/lib/semantic-tags";
import type { DiscoveredArticle, HydratedArticle, QueueName, RetrievalMethod, Source } from "@/types/news";

export type RetrievalTarget={trigger:"manual"|"scheduled"|"startup"|"homepage";targetType:"all"|"source"|"category"|"failing"|"recovery"|"breaking";targetId?:string};
type Metrics={discovered:number;known:number;processed:number;imported:number;rejected:number;duplicates:number;imagesRetrieved:number;imageFailures:number;published:number;review:number;failed:number;sourcesProcessed:number;archived:number};
type SourceMetrics={available:number;discovered:number;known:number;processed:number;rejected:number;published:number;review:number;failed:number;breakingImported:number;latestImportedDate:string|null};
const emptyMetrics=():Metrics=>({discovered:0,known:0,processed:0,imported:0,rejected:0,duplicates:0,imagesRetrieved:0,imageFailures:0,published:0,review:0,failed:0,sourcesProcessed:0,archived:0});
const emptySourceMetrics=():SourceMetrics=>({available:0,discovered:0,known:0,processed:0,rejected:0,published:0,review:0,failed:0,breakingImported:0,latestImportedDate:null});
const supportedMethods=new Set<RetrievalMethod>(["api","rss","atom","sitemap","jsonld","html","dynamic"]);

function candidateSources(target:RetrievalTarget){
  const sources=listSources().filter((source)=>isApprovedSource(source)&&supportedMethods.has(source.retrievalMethod)).filter((source)=>{
    if(target.targetType==="source")return source.id===target.targetId;
    if(target.targetType==="category")return source.mainCategories.includes(target.targetId||"");
    if(target.targetType==="failing")return ["Failing","Degraded","Misconfigured"].includes(source.health);
    return true;
  });
  if(target.targetType!=="breaking")return sources;
  const preferred=/(?:الإخبارية|عاجل|سبق)/u;
  return sources.sort((a,b)=>Number(preferred.test(b.name))-Number(preferred.test(a.name))||a.priority-b.priority||b.reliabilityScore-a.reliabilityScore);
}
function isMisconfigured(source:Source){
  const endpoint=source.apiEndpoint||source.rssEndpoint||source.listingUrl;
  return !endpoint||/(?:^https?:\/\/)?(?:www\.)?example\.com(?:\/|$)/i.test(endpoint);
}
function isIncremental(item:DiscoveredArticle,source:Source,recovery:boolean){
  if(recovery)return true;
  const published=parseSourceDate(item.publishedAt),modified=parseSourceDate(item.modifiedAt),cursor=parseSourceDate(source.lastSeenPublishedAt),modifiedCursor=parseSourceDate(source.lastSeenModifiedAt),materiallyUpdated=Boolean(modified&&(!modifiedCursor||Date.parse(modified)>Date.parse(modifiedCursor)));
  if(!materiallyUpdated&&source.lastSeenArticleId&&item.sourceArticleId&&item.sourceArticleId===source.lastSeenArticleId)return false;
  if(!materiallyUpdated&&source.lastSeenGuid&&item.guid&&item.guid===source.lastSeenGuid)return false;
  if(!materiallyUpdated&&source.lastSeenUrl&&item.url===source.lastSeenUrl)return false;
  if(!materiallyUpdated&&published&&cursor&&Date.parse(published)<=Date.parse(cursor))return false;
  return true;
}
function incrementalItems(items:DiscoveredArticle[],source:Source,recovery:boolean){
  if(recovery)return items;
  const cursorIndex=items.findIndex((item)=>(source.lastSeenArticleId&&item.sourceArticleId===source.lastSeenArticleId)||(source.lastSeenGuid&&item.guid===source.lastSeenGuid)||(source.lastSeenUrl&&item.url===source.lastSeenUrl));
  if(cursorIndex<0)return items.filter((item)=>isIncremental(item,source,false));
  return [...items.slice(0,cursorIndex+1),...items.slice(cursorIndex+1).filter((item)=>isIncremental(item,source,false))].filter((item)=>isIncremental(item,source,false));
}
function discoveryMethods(source:Source):RetrievalMethod[]{
  const methods:RetrievalMethod[]=[];
  if(source.apiEndpoint)methods.push("api");
  if(source.rssEndpoint)methods.push(source.retrievalMethod==="atom"?"atom":"rss");
  if(source.listingUrl&&!source.rssEndpoint)methods.push("rss");
  if(source.listingUrl)methods.push("sitemap","html");
  methods.push(...source.fallbackMethods);
  return methods.filter((method,index,all)=>supportedMethods.has(method)&&all.indexOf(method)===index);
}
async function stage<T>(runId:string,sourceId:string,queue:QueueName,payload:Record<string,unknown>,action:()=>Promise<T>){
  const jobId=enqueue(runId,sourceId,queue,payload);
  try{return await action().then((result)=>{finishJob(jobId);return result;});}catch(firstError){
    if(queue==="image-resolution"){
      retryJob(jobId);try{const result=await action();finishJob(jobId);return result;}catch(error){finishJob(jobId,error instanceof Error?error.message:"stage_failed");throw error;}
    }
    finishJob(jobId,firstError instanceof Error?firstError.message:"stage_failed");throw firstError;
  }
}
async function hydrateWithFallbacks(item:DiscoveredArticle,source:Source){
  const methods=([source.retrievalMethod,...source.fallbackMethods,"html","jsonld"] as RetrievalMethod[]).filter((method,index,all)=>supportedMethods.has(method)&&all.indexOf(method)===index);
  const failures:string[]=[];
  for(const method of methods)try{return await adapterFor(method).hydrate(item,source);}catch(error){failures.push(`${method}:${error instanceof Error?error.message:"hydration_failed"}`);}
  throw new Error(`article_page_hydration_failed (${failures.join(", ")})`);
}
function articleIdentity(article:HydratedArticle,category:string){
  const body=cleanParagraphs(article.body,article.title).join(" "),normalizedTitle=normalizeArabic(article.title);
  return {normalizedTitle,contentHash:hash(`${normalizedTitle}|${body}`),eventFingerprint:eventFingerprint(article,category)};
}
function increase(global:Metrics,local:SourceMetrics,key:keyof SourceMetrics,globalKey:keyof Metrics=key as keyof Metrics){
  (local[key] as number)++;(global[globalKey] as number)++;
}

async function processArticle(item:DiscoveredArticle,source:Source,runId:string,metrics:Metrics,sourceMetrics:SourceMetrics,freshnessHours:number){
  let hydrated:HydratedArticle;
  try{
    hydrated=await stage(runId,source.id,"article-hydration",{url:item.url},()=>hydrateWithFallbacks(item,source));
    increase(metrics,sourceMetrics,"processed");
  }catch(error){
    const reason=error instanceof Error?error.message:"article_page_blocked";
    increase(metrics,sourceMetrics,"failed");logArticleRetrieval({runId,sourceId:source.id,url:item.url,stage:"article-hydration",status:"failed",reason});return;
  }
  const breakingEvidence=hydrated.breakingEvidence||{verified:false,detectedBy:null,sourceValue:""};
  hydrated.title=cleanVerifiedBreakingTitle(hydrated.title,breakingEvidence);
  const settings=getSettings(),validation=await stage(runId,source.id,"content-validation",{url:item.url},async()=>validateHydratedArticle(hydrated,source,freshnessHours));
  if(!validation.valid){
    increase(metrics,sourceMetrics,"rejected");logArticleRetrieval({runId,sourceId:source.id,url:item.url,stage:"content-validation",status:"rejected",reason:validation.errors.join(" | ")});return;
  }
  hydrated.body=validation.body;
  const publishedAt=parseSourceDate(hydrated.publishedAt);
  if(!publishedAt){
    increase(metrics,sourceMetrics,"rejected");logArticleRetrieval({runId,sourceId:source.id,url:item.url,stage:"freshness",status:"rejected",reason:"publication_date_could_not_be_parsed"});return;
  }
  hydrated.publishedAt=publishedAt;
  const classification=await stage(runId,source.id,"classification",{url:item.url},async()=>classifyArticle(hydrated,source)),identity=articleIdentity(hydrated,classification.category),semantic=extractSemanticTags({title:hydrated.title,body:hydrated.body,category:classification.category,subcategory:classification.subcategory,region:source.region,sourceName:source.name,sourceDomain:source.domain});
  const duplicate=await stage(runId,source.id,"duplicate-check",{url:item.url},async()=>findDuplicate({canonicalUrl:hydrated.canonicalUrl,sourceId:source.id,sourceArticleId:item.sourceArticleId,guid:item.guid,sourcePublishedAt:publishedAt,category:classification.category,...identity}));
  if(duplicate){
    increase(metrics,sourceMetrics,"known","known");metrics.duplicates++;
    const modifiedAt=parseSourceDate(hydrated.modifiedAt),existingUpdated=parseSourceDate(duplicate.source_updated_at);
    const exactSourceArticle=!["event_similarity","title_similarity","normalized_title","content_hash"].includes(duplicate.match_type),contentChanged=duplicate.content_hash!==identity.contentHash,sourceMarkedNewer=Boolean(modifiedAt&&(!existingUpdated||Date.parse(modifiedAt)>Date.parse(existingUpdated)));
    if(exactSourceArticle&&(contentChanged||sourceMarkedNewer)){const refreshed=await stage(runId,source.id,"summarization",{url:item.url,update:true},async()=>summarizeArticle(hydrated.title,hydrated.body));if(refreshed.summary&&refreshed.content.join(" ").length>=100){updateMaterialArticle(duplicate.id,{title:hydrated.title,normalizedTitle:identity.normalizedTitle,summary:refreshed.summary,content:refreshed.content,sourceUpdatedAt:modifiedAt||existingUpdated||null,retrievedAt:new Date().toISOString(),contentHash:identity.contentHash,eventFingerprint:identity.eventFingerprint,tags:semantic.tags,keyphrases:semantic.keyphrases});logArticleRetrieval({runId,sourceId:source.id,url:item.url,stage:"publication",status:"updated",reason:sourceMarkedNewer?"source_timestamp_update_applied":"material_content_update_applied",duplicateId:duplicate.id});}}
    const shouldRefreshImage=hydrated.imageCandidates.length>0&&(duplicate.image_status!=="valid"||(exactSourceArticle&&(contentChanged||sourceMarkedNewer)&&hydrated.imageCandidates.some((candidate)=>candidate.url!==duplicate.image_original_url)));
    if(shouldRefreshImage){
      const repaired=await stage(runId,source.id,"image-resolution",{candidates:hydrated.imageCandidates.length,articleId:duplicate.id,repair:true},()=>resolveFeaturedImage(hydrated.imageCandidates,hydrated.url,duplicate.id));
      if(repaired.valid){updateArticleImage(duplicate.id,repaired,hydrated.imageAlt||hydrated.title);metrics.imagesRetrieved++;}
      else{metrics.imageFailures++;logArticleRetrieval({runId,sourceId:source.id,url:item.url,stage:"image-resolution",status:"failed",reason:repaired.status,duplicateId:duplicate.id});}
    }
    logArticleRetrieval({runId,sourceId:source.id,url:item.url,stage:"duplicate-check",status:"skipped",reason:`duplicate_${duplicate.match_type}`,duplicateId:duplicate.id,similarityScore:duplicate.similarityScore});
    if(breakingEvidence.verified&&breakingEvidence.detectedBy){const verifiedAt=new Date().toISOString(),expiresAt=new Date(Date.parse(publishedAt)+getSettings().breakingHours*3600000).toISOString();updateArticleBreaking(duplicate.id,{source:source.name,detectedBy:breakingEvidence.detectedBy,verifiedAt,expiresAt});sourceMetrics.breakingImported++;updateSourceState(source.id,{lastBreakingDetectedAt:publishedAt,lastBreakingImportedAt:verifiedAt,breakingLatencySeconds:Math.max(0,Math.round((Date.parse(verifiedAt)-Date.parse(publishedAt))/1000)),breakingHealth:"Healthy"});}
    if(duplicate.title!==hydrated.title)updateSupportingReference(duplicate.id,source.name,hydrated.canonicalUrl);
    return;
  }
  const articleId=randomUUID(),image=await stage(runId,source.id,"image-resolution",{candidates:hydrated.imageCandidates.length},()=>resolveFeaturedImage(hydrated.imageCandidates,hydrated.url,articleId));
  if(image.valid)metrics.imagesRetrieved++;else{metrics.imageFailures++;logArticleRetrieval({runId,sourceId:source.id,url:item.url,stage:"image-resolution",status:"failed",reason:image.status});}
  const summarized=await stage(runId,source.id,"summarization",{url:item.url},async()=>summarizeArticle(hydrated.title,hydrated.body));
  if(!summarized.summary||summarized.content.join(" ").length<100){
    increase(metrics,sourceMetrics,"rejected");logArticleRetrieval({runId,sourceId:source.id,url:item.url,stage:"summarization",status:"rejected",reason:summarized.quality.reasons.join(" | ")||"article_body_extraction_failed_after_cleanup"});return;
  }
  const verifiedBreaking=breakingEvidence.verified&&Boolean(breakingEvidence.detectedBy),publish=isApprovedSource(source)&&!classification.needsReview,archiveStatus=isInActiveNewsWindow(publishedAt,settings.timezone)?"current":"archived",badge=verifiedBreaking?"عاجل":hydrated.modifiedAt?"محدّث":null,geography=classifyGeography(hydrated.title,hydrated.body,source),editorial=scoreEditorialPriority({title:hydrated.title,body:hydrated.body,category:classification.category,publishedAt,source,geographicRelevance:geography.geographicRelevance,breaking:verifiedBreaking,settings}),verifiedAt=verifiedBreaking?new Date().toISOString():null,breakingExpiresAt=verifiedBreaking?new Date(Date.parse(publishedAt)+settings.breakingHours*3600000).toISOString():null;
  await stage(runId,source.id,"publication",{url:item.url},async()=>insertArticle({id:articleId,slug:`news-${articleId}`,title:hydrated.title,normalizedTitle:identity.normalizedTitle,summary:summarized.summary,content:summarized.content,category:classification.category,subcategory:classification.subcategory,sourceId:source.id,sourceName:source.name,sourceUrl:hydrated.url,canonicalUrl:hydrated.canonicalUrl,sourceArticleId:item.sourceArticleId,guid:item.guid,author:hydrated.author,region:geography.region,geographicRelevance:geography.geographicRelevance,importanceLevel:editorial.importanceLevel,priorityScore:editorial.priorityScore,sourcePublishedAt:publishedAt,sourceUpdatedAt:hydrated.modifiedAt,retrievedAt:new Date().toISOString(),imageOriginalUrl:image.url,imageLocalUrl:image.localUrl,imageThumbnailUrl:image.thumbnailUrl,imageAlt:image.alt||hydrated.imageAlt||hydrated.title,imageCaption:image.caption||hydrated.imageCaption,imageCredit:image.credit||hydrated.imageCredit,imageWidth:image.width,imageHeight:image.height,imageStatus:image.status,publicationStatus:publish?"published":"review",archiveStatus,validationStatus:"valid",categoryConfidence:classification.confidence,classificationStatus:classification.needsReview?"needs_review":"classified",classificationReason:classification.reasons.join(" | "),classificationAlternatives:classification.alternatives,contentHash:identity.contentHash,eventFingerprint:identity.eventFingerprint,badge,isBreaking:verifiedBreaking,breakingSource:verifiedBreaking?source.name:"",breakingDetectedBy:breakingEvidence.detectedBy,breakingVerifiedAt:verifiedAt,breakingExpiresAt,tags:semantic.tags,keyphrases:semantic.keyphrases}));
  if(verifiedBreaking&&verifiedAt){sourceMetrics.breakingImported++;updateSourceState(source.id,{lastBreakingDetectedAt:publishedAt,lastBreakingImportedAt:verifiedAt,breakingLatencySeconds:Math.max(0,Math.round((Date.parse(verifiedAt)-Date.parse(publishedAt))/1000)),breakingHealth:"Healthy"});}
  metrics.imported++;sourceMetrics.latestImportedDate=!sourceMetrics.latestImportedDate||publishedAt>sourceMetrics.latestImportedDate?publishedAt:sourceMetrics.latestImportedDate;
  if(publish)increase(metrics,sourceMetrics,"published");else increase(metrics,sourceMetrics,"review");
  if(archiveStatus==="archived")metrics.archived++;
  logArticleRetrieval({runId,sourceId:source.id,url:item.url,stage:"publication",status:publish?"published":"review",reason:publish?"approved_source_article_published":classification.needsReview?"source_category_or_content_classification_needs_review":"source_not_approved_or_active"});
  invalidateCache(classification.category);
}

async function processSource(source:Source,runId:string,metrics:Metrics,recovery:boolean){
  const local=emptySourceMetrics(),methodErrors:string[]=[],methodsUsed:string[]=[];
  metrics.sourcesProcessed++;
  if(isMisconfigured(source)){
    const reason="source_endpoint_misconfigured_or_placeholder";
    updateSourceState(source.id,{health:"Misconfigured",lastError:reason,consecutiveFailures:source.consecutiveFailures+1});
    recordSourceResult({runId,sourceId:source.id,status:"Misconfigured",method:"",...local,articlesAvailable:0,failureReason:reason});
    return `${source.name}: ${reason}`;
  }
  if(!acquireSourceLock(source.id,runId)){const reason="concurrent_source_run_prevented";recordSourceResult({runId,sourceId:source.id,status:"Degraded",method:"lock",articlesAvailable:0,discovered:0,known:0,processed:0,rejected:0,published:0,review:0,failed:1,failureReason:reason});return `${source.name}: ${reason}`;}
  try{
    const candidates:DiscoveredArticle[]=[],discoverySource=recovery?{...source,etag:"",lastModified:""}:source;
    for(const method of discoveryMethods(source)){
      try{
        const found=await stage(runId,source.id,"source-discovery",{method,recovery},()=>adapterFor(method).discover(discoverySource));
        methodsUsed.push(method);candidates.push(...found);
        if(!recovery&&candidates.length>=30)break;
      }catch(error){methodErrors.push(`${method}: ${error instanceof Error?error.message:"discovery_failed"}`);}
    }
    const discovered=[...new Map(candidates.map((item)=>[item.url,item])).values()],latestSourceDate=discovered.map((item)=>parseSourceDate(item.publishedAt)).filter((date):date is string=>Boolean(date)).sort().at(-1)||null,latestModifiedDate=discovered.map((item)=>parseSourceDate(item.modifiedAt)).filter((date):date is string=>Boolean(date)).sort().at(-1)||null;
    local.available=discovered.length;
    if(!discovered.length&&methodErrors.some((error)=>error.includes("source_not_modified"))){const checkedAt=new Date().toISOString();updateSourceState(source.id,{health:"Healthy",lastSuccessfulFetch:checkedAt,lastError:"",consecutiveFailures:0});recordSourceResult({runId,sourceId:source.id,status:"Healthy",method:methodsUsed.join("+")||"conditional",articlesAvailable:0,discovered:0,known:0,processed:0,rejected:0,published:0,review:0,failed:0,latestSourceDate:source.lastSeenPublishedAt,latestImportedDate:null,details:{notModified:true,methodErrors,recovery}});return "";}
    if(!discovered.length)throw new Error(methodErrors.length?`no_articles_discovered (${methodErrors.join("; ")})`:"no_discovery_method_processed");
    const settings=getSettings(),window=activeNewsWindow(settings.timezone),freshnessHours=Math.ceil((Date.parse(window.end)-Date.parse(window.start))/3600000)+1,incremental=incrementalItems(discovered,source,recovery).filter((item)=>{const date=parseSourceDate(item.publishedAt);return !date||(Date.parse(date)>=Date.parse(window.start)&&Date.parse(date)<=Date.parse(window.end));}),ordered=incremental.sort((a,b)=>Date.parse(parseSourceDate(b.publishedAt)||"0")-Date.parse(parseSourceDate(a.publishedAt)||"0")),limit=recovery?Math.min(1000,Math.max(50,Number(process.env.MAX_BACKFILL_ARTICLES_PER_SOURCE)||500)):12,fresh:DiscoveredArticle[]=[];
    local.discovered=incremental.length;metrics.discovered+=incremental.length;
    for(const item of ordered.slice(0,limit)){
      if(recovery){const known=findKnownDiscoveredArticle({sourceId:source.id,sourceArticleId:item.sourceArticleId,guid:item.guid,url:item.url}),modified=parseSourceDate(item.modifiedAt);if(known&&(!modified||(known.source_updated_at&&Date.parse(modified)<=Date.parse(known.source_updated_at)))){local.known++;metrics.known++;metrics.duplicates++;logArticleRetrieval({runId,sourceId:source.id,url:item.url,stage:"backfill-identity-check",status:"skipped",reason:"known_guid_article_id_or_canonical_url",duplicateId:known.id,similarityScore:100});continue;}}
      fresh.push(item);
    }
    const breakingCandidates=fresh.filter((item)=>item.breakingEvidence?.verified),articleConcurrency=3;
    for(let index=0;index<fresh.length;index+=articleConcurrency)await Promise.all(fresh.slice(index,index+articleConcurrency).map((item)=>processArticle(item,source,runId,metrics,local,freshnessHours)));
    const accepted=local.published+local.review+local.known>0,noNewItems=fresh.length===0,status=accepted?(local.failed?"Degraded":"Healthy"):noNewItems?"Healthy":"Degraded",failureReason=accepted||noNewItems?methodErrors.join("; "):"articles_visible_but_none_reached_publication_or_review";
    const breakingHealth=breakingCandidates.length&&local.breakingImported===0?"Out of Sync":status==="Healthy"?"Healthy":status==="Degraded"?"Delayed":"Failed";
    const newest=ordered[0];
    updateSourceState(source.id,{health:status,lastSuccessfulFetch:new Date().toISOString(),lastSeenArticleId:newest?.sourceArticleId||source.lastSeenArticleId,lastSeenGuid:newest?.guid||source.lastSeenGuid,lastSeenUrl:newest?.url||source.lastSeenUrl,lastSeenPublishedAt:latestSourceDate||source.lastSeenPublishedAt,lastSeenModifiedAt:latestModifiedDate||source.lastSeenModifiedAt,lastError:failureReason,consecutiveFailures:status==="Healthy"?0:source.consecutiveFailures+1,lastBreakingCheck:new Date().toISOString(),breakingHealth});
    recordSourceResult({runId,sourceId:source.id,status,method:methodsUsed.join("+"),articlesAvailable:local.available,discovered:local.discovered,known:local.known,processed:local.processed,rejected:local.rejected,published:local.published,review:local.review,failed:local.failed,latestSourceDate,latestImportedDate:local.latestImportedDate,failureReason,details:{methodErrors,recovery}});
    return status==="Healthy"?"":`${source.name}: ${failureReason}`;
  }catch(error){
    const reason=error instanceof Error?error.message:"source_retrieval_failed";metrics.failed++;
    updateSourceState(source.id,{health:"Failing",lastError:reason,consecutiveFailures:source.consecutiveFailures+1});
    recordSourceResult({runId,sourceId:source.id,status:"Failing",method:methodsUsed.join("+"),articlesAvailable:local.available,discovered:local.discovered,known:local.known,processed:local.processed,rejected:local.rejected,published:local.published,review:local.review,failed:local.failed+1,latestSourceDate:null,latestImportedDate:local.latestImportedDate,failureReason:reason,details:{methodErrors,recovery}});
    return `${source.name}: ${reason}`;
  }finally{releaseSourceLock(source.id,runId);}
}

export async function runRetrieval(target:RetrievalTarget){
  const run=startRun(target.trigger,target.targetType,target.targetId||""),metrics=emptyMetrics(),errors:string[]=[],inventory=freshnessInventory(),recovery=target.targetType==="recovery",sources=candidateSources(target);
  const sessionLock="__retrieval_session__";
  if(!acquireSourceLock(sessionLock,run.id,3*3600000)){const reason="retrieval_session_already_running";errors.push(reason);finishRun(run.id,metrics,reason);return {id:run.id,metrics,errors,sourcesQueued:0,sourcesProcessed:0,recovered:0,recovery,inventoryBefore:inventory,skipped:true};}
  try{
  if(!sources.length)errors.push("no_active_sources_matched_the_requested_target");
  const concurrency=Math.min(8,Math.max(1,Number(process.env.MAX_RETRIEVAL_CONCURRENCY)||8));
  for(let index=0;index<sources.length;index+=concurrency){
    const results=await Promise.all(sources.slice(index,index+concurrency).map((source)=>processSource(source,run.id,metrics,recovery)));
    errors.push(...results.filter(Boolean));
  }
  const recovered=recoverEligibleReviewPosts();if(recovered){metrics.published+=recovered;metrics.review=Math.max(0,metrics.review-recovered);}metrics.archived+=runArchiveLifecycle();
  const imageRepair=target.trigger==="manual"&&target.targetType==="all"?await repairMissingArticleImages(200,run.id):null;
  if(imageRepair){metrics.imagesRetrieved+=imageRepair.repaired;metrics.imageFailures+=imageRepair.failed;}
  invalidateCache("all");const homepageSnapshot=prepareHomepageSnapshot();finishRun(run.id,metrics,errors.join(" | "));
  return {id:run.id,metrics,errors,sourcesQueued:sources.length,sourcesProcessed:metrics.sourcesProcessed,recovered,recovery,imageRepair,inventoryBefore:inventory,homepageSnapshot};
  }finally{releaseSourceLock(sessionLock,run.id);}
}

export async function repairMissingArticleImages(limit=200,runId="",articleIds:string[]=[]){
  const rows=listArticlesMissingImages(limit,articleIds),reasons:Record<string,number>={},repairedIds:string[]=[],failures:Array<{id:string;reason:string}>=[];
  let repaired=0,failed=0;
  for(let index=0;index<rows.length;index+=3)await Promise.all(rows.slice(index,index+3).map(async(row)=>{
    const source=getSource(String(row.source_id));
    if(!source){failed++;reasons.source_not_found=(reasons.source_not_found||0)+1;failures.push({id:String(row.id),reason:"source_not_found"});if(runId)logArticleRetrieval({runId,sourceId:String(row.source_id),url:String(row.source_url),stage:"image-repair",status:"failed",reason:"source_not_found"});return;}
    try{
      const item:DiscoveredArticle={sourceId:source.id,sourceArticleId:"",guid:String(row.source_url),url:String(row.source_url),title:String(row.title),publishedAt:null};
      const hydrated=await hydrateWithFallbacks(item,source),image=await resolveFeaturedImage(hydrated.imageCandidates,hydrated.url,String(row.id));
      if(image.valid){updateArticleImage(String(row.id),image,hydrated.imageAlt||hydrated.title);repaired++;repairedIds.push(String(row.id));if(runId)logArticleRetrieval({runId,sourceId:source.id,url:item.url,stage:"image-repair",status:"updated",reason:`featured_image_attached_${image.origin}`});return;}
      failed++;reasons[image.status]=(reasons[image.status]||0)+1;failures.push({id:String(row.id),reason:image.status});if(runId)logArticleRetrieval({runId,sourceId:source.id,url:item.url,stage:"image-repair",status:"failed",reason:image.status});
    }catch(error){
      const reason=error instanceof Error?error.message:"image_repair_failed";
      failed++;reasons[reason]=(reasons[reason]||0)+1;failures.push({id:String(row.id),reason});if(runId)logArticleRetrieval({runId,sourceId:source.id,url:String(row.source_url),stage:"image-repair",status:"failed",reason});
    }
  }));
  return {checked:rows.length,repaired,failed,reasons,repairedIds,failures};
}

export async function refreshTrackedArticle(articleId:string,runId:string){
  const row=trackedArticleForRefresh(articleId);if(!row)return {ok:false,error:"article_not_found"};const source=getSource(String(row.source_id));if(!source||!isApprovedSource(source))return {ok:false,error:"source_not_approved_or_active"};
  const metrics=emptyMetrics(),local=emptySourceMetrics(),window=activeNewsWindow(getSettings().timezone),freshnessHours=Math.ceil((Date.parse(window.end)-Date.parse(window.start))/3600000)+1,item:DiscoveredArticle={sourceId:source.id,sourceArticleId:String(row.source_article_id||""),guid:String(row.rss_guid||row.source_url),url:String(row.source_url),title:String(row.title),publishedAt:String(row.source_published_at)};
  await processArticle(item,source,runId,metrics,local,freshnessHours);return {ok:local.known>0||local.published>0||local.review>0,metrics,sourceMetrics:local};
}
