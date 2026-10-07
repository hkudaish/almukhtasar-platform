import "server-only";
import { createHash } from "node:crypto";

export type DiscoveryMethod="Official API"|"Official RSS / Atom"|"Official news listing"|"Browser rendering";
export type HydrationMethod="NewsArticle / Article structured data"|"Open Graph metadata"|"Semantic HTML article extraction"|"Browser rendering";

export type DiscoveredNewsItem={
  title:string;
  summary:string;
  url:string;
  publishedAt?:string;
  modifiedAt?:string;
  externalId?:string;
  guid?:string;
  category?:string;
  imageUrl?:string;
  imageAlt?:string;
  author?:string;
  articleDetected?:boolean;
  newsSchema?:boolean;
  imageFromArticle?:boolean;
  imageFromFeed?:boolean;
  imageExtractionMethod?:string;
  imageCandidates?:Array<{url:string;method:string;alt?:string}>;
  extractionMethod?:string;
  fetchError?:string;
  canonicalUrl?:string;
  publisher?:string;
  discoveryMethod?:DiscoveryMethod;
  hydrationAttempts?:number;
};

export type SourceAdapter={
  id:string;
  sourceId:string;
  sourceName:string;
  endpoints:Array<{url:string;method:DiscoveryMethod;priority:number}>;
  articlePathPrefix:string;
  renderEndpoint:string|null;
  articleUrlPattern:string;
  selectors:{headline:string;body:string;publishedAt:string;image:string;canonical:string};
  categoryMap:Record<string,string>;
  pagination:{mode:string;parameter:string;maxPages:number};
  rateLimit:{requestsPerMinute:number;concurrency:number};
  retry:{attempts:number;baseDelayMs:number;maxDelayMs:number};
  excludedUrlPatterns:string[];
};

export type UnifiedNewsObject={
  source_id:string;
  source_name:string;
  source_type:string;
  external_article_id:string;
  original_url:string;
  canonical_url:string;
  original_title:string;
  clean_title:string;
  original_content:string;
  clean_content:string;
  summary:string;
  additional_context:string[];
  main_image:string;
  image_original_url:string|null;
  image_local_url:string|null;
  image_alt:string;
  author:string|null;
  date_published:string|null;
  date_modified:string|null;
  date_retrieved:string;
  main_category:string;
  subcategories:string[];
  region:string;
  country:string;
  keywords:string[];
  entities:string[];
  retrieval_method:string;
  retrieval_confidence:number;
  validation_status:string;
  duplicate_status:string;
  publication_status:string;
};

function nonEmpty(value:unknown){return typeof value==="string"&&value.trim()?value.trim():"";}
function addEndpoint(target:SourceAdapter["endpoints"],url:unknown,method:DiscoveryMethod,priority:number){
  const value=nonEmpty(url);
  if(value&&!target.some((entry)=>entry.url===value))target.push({url:value,method,priority});
}

/** Builds the per-source adapter. Configuration, not a global heuristic, decides available methods. */
export function createSourceAdapter(source:{id:string;title:string;data:Record<string,unknown>}):SourceAdapter{
  const endpoints:SourceAdapter["endpoints"]=[];
  addEndpoint(endpoints,source.data.apiUrl,"Official API",1);
  addEndpoint(endpoints,source.data.feedUrl,"Official RSS / Atom",2);
  const fetchMethod=String(source.data.fetchMethod||"");
  if(/موقع|صفحة أخبار|HTML|news listing/i.test(fetchMethod))addEndpoint(endpoints,source.data.url,"Official news listing",5);
  for(const extra of String(source.data.additionalUrls||"").split(/[\n،,]+/).map((value)=>value.trim()).filter(Boolean)){
    const method=/\.json(?:\?|$)|\/api\//i.test(extra)?"Official API":/(?:rss|atom|feed|\.xml)(?:\?|$)/i.test(extra)?"Official RSS / Atom":"Official news listing";
    addEndpoint(endpoints,extra,method,method==="Official API"?1:method==="Official RSS / Atom"?2:5);
  }
  const renderEndpoint=nonEmpty(source.data.renderEndpoint)||null;
  if(renderEndpoint)addEndpoint(endpoints,renderEndpoint,"Browser rendering",6);
  endpoints.sort((a,b)=>a.priority-b.priority);
  const stringList=(value:unknown)=>String(value||"").split(/[\n،,]+/).map((item)=>item.trim()).filter(Boolean);
  let categoryMap:Record<string,string>={};
  try{const parsed=JSON.parse(String(source.data.categoryMap||"{}"));if(parsed&&typeof parsed==="object"&&!Array.isArray(parsed))categoryMap=parsed;}catch{}
  return {
    id:`adapter:${source.id}`,sourceId:source.id,sourceName:source.title,endpoints,
    articlePathPrefix:String(source.data.articlePathPrefix||""),renderEndpoint,
    articleUrlPattern:String(source.data.articleUrlPattern||""),
    selectors:{
      headline:String(source.data.headlineSelector||""),
      body:String(source.data.bodySelector||""),
      publishedAt:String(source.data.publicationDateSelector||""),
      image:String(source.data.featuredImageSelector||""),
      canonical:String(source.data.canonicalSelector||"")
    },
    categoryMap,
    pagination:{mode:String(source.data.paginationMode||"auto"),parameter:String(source.data.paginationParameter||"page"),maxPages:Math.min(Math.max(Number(source.data.maxPages)||3,1),20)},
    rateLimit:{requestsPerMinute:Math.min(Math.max(Number(source.data.requestsPerMinute)||30,1),600),concurrency:Math.min(Math.max(Number(source.data.concurrency)||3,1),10)},
    retry:{attempts:Math.min(Math.max(Number(source.data.retryAttempts)||3,1),8),baseDelayMs:Math.min(Math.max(Number(source.data.retryBaseDelayMs)||500,100),30000),maxDelayMs:Math.min(Math.max(Number(source.data.retryMaxDelayMs)||10000,500),120000)},
    excludedUrlPatterns:stringList(source.data.excludedUrlPatterns)
  };
}

export function externalArticleKey(item:Pick<DiscoveredNewsItem,"url"|"externalId"|"guid">){
  const raw=nonEmpty(item.externalId)||nonEmpty(item.guid)||normalizeArticleUrl(item.url);
  return createHash("sha256").update(raw).digest("hex");
}

export function normalizeArticleUrl(value:string){
  try{
    const url=new URL(value);
    url.hash="";
    for(const key of [...url.searchParams.keys()])if(/^utm_|^(?:fbclid|gclid|mc_cid|mc_eid)$/i.test(key))url.searchParams.delete(key);
    url.hostname=url.hostname.toLowerCase();
    url.pathname=url.pathname.replace(/\/{2,}/g,"/").replace(/\/$/,"")||"/";
    return url.toString();
  }catch{return value.trim();}
}

export function isIncrementalCandidate(item:DiscoveredNewsItem,state:{lastSeenUrl?:string|null;lastPublicationDate?:string|null}|null){
  if(!state)return true;
  if(state.lastSeenUrl&&normalizeArticleUrl(item.url)===normalizeArticleUrl(state.lastSeenUrl))return false;
  if(state.lastPublicationDate&&item.publishedAt){
    const candidate=Date.parse(item.publishedAt),previous=Date.parse(state.lastPublicationDate);
    if(Number.isFinite(candidate)&&Number.isFinite(previous)&&candidate<previous-48*60*60*1000)return false;
  }
  return true;
}

export function retrievalHealth(consecutiveFailures:number,paused=false){
  if(paused)return "Paused";
  if(consecutiveFailures>=3)return "Failing";
  if(consecutiveFailures>=1)return "Degraded";
  return "Healthy";
}

const ENTITY_PATTERN=/[«"]([^»"]{2,80})[»"]|(?:شركة|وزارة|هيئة|جامعة|مؤسسة|مركز|مدينة|محافظة|دولة)\s+[\p{L}\p{N}][\p{L}\p{N}\s-]{2,60}/gu;
export function lightweightEntities(text:string){
  return [...text.matchAll(ENTITY_PATTERN)].map((match)=>String(match[1]||match[0]).trim()).filter((value,index,all)=>value.length<90&&all.indexOf(value)===index).slice(0,15);
}
export function lightweightKeywords(text:string){
  const stop=new Set(["التي","الذي","هذا","هذه","ذلك","تلك","إلى","الى","على","عبر","خلال","بعد","قبل","حول","بين","ضمن","مع","عن","من","في","وقد","كما"]);
  const counts=new Map<string,number>();
  for(const word of text.toLocaleLowerCase("ar").replace(/[\u064b-\u065f\u0670]/g,"").match(/[\p{L}\p{N}]{4,}/gu)||[])if(!stop.has(word))counts.set(word,(counts.get(word)||0)+1);
  return [...counts].sort((a,b)=>b[1]-a[1]).slice(0,12).map(([word])=>word);
}

export function buildUnifiedNewsObject(input:{
  source:{id:string;title:string;data:Record<string,unknown>};
  item:DiscoveredNewsItem;
  cleanTitle:string;
  cleanContent:string;
  summary:string;
  details:string[];
  imageUrl:string;
  originalImageUrl:string|null;
  imageAlt:string;
  category:string;
  subcategory:string;
  retrievalMethod:string;
  confidence:number;
  validationStatus:string;
  duplicateStatus:string;
  publicationStatus:string;
}):UnifiedNewsObject{
  const retrievedAt=new Date().toISOString(),text=`${input.cleanTitle} ${input.cleanContent}`;
  return {
    source_id:input.source.id,source_name:input.source.title,source_type:String(input.source.data.type||""),
    external_article_id:String(input.item.externalId||input.item.guid||externalArticleKey(input.item)),
    original_url:input.item.url,canonical_url:normalizeArticleUrl(input.item.canonicalUrl||input.item.url),
    original_title:input.item.title,clean_title:input.cleanTitle,original_content:input.item.summary,clean_content:input.cleanContent,
    summary:input.summary,additional_context:input.details,main_image:input.imageUrl,image_original_url:input.originalImageUrl,image_local_url:input.originalImageUrl?`/api/media/source-image/{record_id}`:null,image_alt:input.imageAlt,
    author:input.item.author||null,date_published:input.item.publishedAt||null,date_modified:input.item.modifiedAt||null,date_retrieved:retrievedAt,
    main_category:input.category,subcategories:[input.subcategory],region:String(input.source.data.geography||input.source.data.region||""),country:String(input.source.data.country||"السعودية"),
    keywords:lightweightKeywords(text),entities:lightweightEntities(text),retrieval_method:input.retrievalMethod,retrieval_confidence:input.confidence,
    validation_status:input.validationStatus,duplicate_status:input.duplicateStatus,publication_status:input.publicationStatus
  };
}
