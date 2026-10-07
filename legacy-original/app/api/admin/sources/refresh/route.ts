import { NextRequest, NextResponse } from "next/server";
import { acquireRetrievalLock, claimNewsPipelineItems, createRecord, enqueueNewsPipelineItem, findRecordByTitle, finishNewsPipelineItem, finishRetrievalRun, getRecord, getSourceRetrievalState, listRecords, listSourceRefreshRuns, newsPipelineQueueSummary, recoverStaleNewsPipelineItems, releaseRetrievalLock, saveSourceRefreshRun, saveSourceRetrievalState, startRetrievalRun, updateRecord, type AdminRecord } from "@/lib/admin-db";
import { revalidatePath } from "next/cache";
import { APPROVED_CATEGORY_SOURCES, classifyNewsCategory, classifyNewsSubcategory, isNearDuplicate, NEWS_CATEGORIES, structureRetrievedNews, type NewsCategory } from "@/lib/source-policy";
import { recoverHomepageContent } from "@/lib/homepage-recovery";
import { buildUnifiedNewsObject, createSourceAdapter, externalArticleKey, isIncrementalCandidate, normalizeArticleUrl, retrievalHealth, type DiscoveredNewsItem } from "@/lib/news-pipeline";

export const runtime="nodejs";

type Candidate=DiscoveredNewsItem;

function isSafeExternalUrl(value:string){
  try {
    const url=new URL(value);
    if(!["http:","https:"].includes(url.protocol)) return false;
    const host=url.hostname.toLowerCase();
    return !["localhost","127.0.0.1","::1"].includes(host)&&!/^10\.|^192\.168\.|^172\.(1[6-9]|2\d|3[01])\./.test(host);
  } catch { return false; }
}

function clean(value:string){return value.replace(/<!\[CDATA\[|\]\]>/g,"").replace(/<script\b[^>]*>[\s\S]*?<\/script>|<style\b[^>]*>[\s\S]*?<\/style>/gi," ").replace(/<br\s*\/?\s*>/gi,". ").replace(/<[^>]+>/g," ").replace(/&nbsp;|&#160;/gi," ").replace(/&amp;/gi,"&").replace(/&quot;/gi,'"').replace(/&#39;|&apos;/gi,"'").replace(/&lt;/gi,"<").replace(/&gt;/gi,">").replace(/&#(\d+);/g,(_,code)=>String.fromCodePoint(Number(code))).replace(/&#x([\da-f]+);/gi,(_,code)=>String.fromCodePoint(Number.parseInt(code,16))).replace(/\s+/g," ").trim();}
function tag(block:string,name:string){return clean(block.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)<\\/${name}>`,"i"))?.[1]||"");}
function imageFromXml(block:string){
  const patterns=[
    /<media:content\b[^>]*\burl=["']([^"']+)["'][^>]*>/i,
    /<media:thumbnail\b[^>]*\burl=["']([^"']+)["'][^>]*>/i,
    /<enclosure\b(?=[^>]*\btype=["']image\/)[^>]*\burl=["']([^"']+)["'][^>]*>/i,
    /<enclosure\b[^>]*\burl=["']([^"']+)["'][^>]*(?:type=["']image\/|\.(?:jpe?g|png|webp|avif)(?:\?|["']))/i,
    /<image\b[^>]*>[\s\S]*?<url[^>]*>([^<]+)<\/url>/i,
    /<img\b[^>]*\bsrc=["']([^"']+)["']/i
  ];
  const value=patterns.map((pattern)=>block.match(pattern)?.[1]).find(Boolean)||"";
  return isSafeExternalUrl(value)?value.replace(/&amp;/g,"&"):"";
}
function parseXml(text:string){
  return [...text.matchAll(/<(?:item|entry)\b[^>]*>([\s\S]*?)<\/(?:item|entry)>/gi)].slice(0,100).map((match)=>{
    const block=match[1], title=tag(block,"title"), summary=tag(block,"description")||tag(block,"summary")||tag(block,"content");
    const link=tag(block,"link")||block.match(/<link[^>]+href=["']([^"']+)/i)?.[1]||"";
    return {title,summary,url:link,publishedAt:tag(block,"pubDate")||tag(block,"published")||tag(block,"updated"),externalId:tag(block,"guid")||tag(block,"id"),guid:tag(block,"guid")||tag(block,"id"),imageUrl:imageFromXml(block),imageAlt:title,imageFromFeed:true,imageExtractionMethod:"Official RSS / Atom image field",discoveryMethod:"Official RSS / Atom" as const};
  }).filter((item)=>item.title&&item.url);
}
function parseJson(value:unknown,documentBase=""):Candidate[]{
  const root=value as Record<string,unknown>;
  const rows=Array.isArray(value)?value:Array.isArray(root?.articles)?root.articles:Array.isArray(root?.items)?root.items:Array.isArray(root?.data)?root.data:[];
  return rows.slice(0,100).map((raw)=>{
    const item=raw as Record<string,unknown>, media=item.media as Record<string,unknown>|undefined;
    const link=typeof item.link==="object"&&item.link?item.link as Record<string,unknown>:undefined;
    const image=typeof item.image==="object"&&item.image?item.image as Record<string,unknown>:undefined;
    const rawImage=String(item.imageUrl||(typeof item.image==="string"?item.image:"")||item.urlToImage||item.thumbnailUrl||item.thumbnail||image?.fileReference||image?.url||media?.url||"");
    const rawUrl=String(item.url||link?.url||item.originalUrl||"");
    const base=String(root.baseUrl||root.siteUrl||documentBase);
    return {title:clean(String(item.title||item.name||"")),summary:clean(String(item.description||item.summary||item.excerpt||"")),url:absoluteUrl(rawUrl,base),publishedAt:String(item.publishedAt||item.pubDate||item.date||""),modifiedAt:String(item.modifiedAt||item.dateModified||""),externalId:String(item.id||item.guid||item.uuid||""),imageUrl:absoluteUrl(rawImage,base),imageAlt:String(item.imageAlt||item.alt||image?.alt||item.title||item.name||""),imageFromFeed:true,imageExtractionMethod:"Official API image field",discoveryMethod:"Official API" as const};
  }).filter((item)=>item.title&&item.url);
}

function absoluteUrl(value:string,base:string){if(!value.trim())return "";try{return new URL(value,base).toString();}catch{return "";}}
function structuredImageValue(value:unknown):string{if(typeof value==="string")return value;if(Array.isArray(value))return structuredImageValue(value[0]);if(value&&typeof value==="object"){const image=value as Record<string,unknown>;return String(image.url||image.contentUrl||image["@id"]||"");}return "";}
function candidatesFromJsonTree(root:unknown,base:string){
  const candidates:Candidate[]=[],queue:unknown[]=[root];let visited=0;
  while(queue.length&&visited<15000){visited++;const value=queue.shift();if(Array.isArray(value)){queue.push(...value);continue;}if(!value||typeof value!=="object")continue;const item=value as Record<string,unknown>;for(const child of Object.values(item)){if(child&&typeof child==="object")queue.push(child);}
    const title=clean(String(item.headline||item.newsTitle||item.title||""));if(title.length<28||title.length>240)continue;
    const rawUrl=String(item.url||item.link||item.newsUrl||item.detailsUrl||item.slug||item.path||"");if(!rawUrl)continue;
    const imageValue=item.image||item.imageUrl||item.thumbnail||item.mainImage||item.coverImage;const image=typeof imageValue==="string"?imageValue:typeof imageValue==="object"&&imageValue?String((imageValue as Record<string,unknown>).url||""):"";
    candidates.push({title,summary:clean(String(item.description||item.summary||item.excerpt||title)),url:absoluteUrl(rawUrl,base),publishedAt:String(item.datePublished||item.publishDate||item.publishedAt||item.date||""),modifiedAt:String(item.dateModified||item.modifiedAt||""),externalId:String(item.id||item.guid||item.uuid||""),imageUrl:absoluteUrl(image,base),imageAlt:title,imageFromFeed:Boolean(image),imageExtractionMethod:image?"Official API image field":undefined,discoveryMethod:"Official API"});
  }
  return candidates.filter((item)=>item.title&&item.url);
}
function parseHtml(text:string,base:string):Candidate[]{
  const candidates:Candidate[]=[];
  for(const match of text.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)){
    try{
      const root=JSON.parse(match[1]);const queue:unknown[]=[root];
      while(queue.length){const value=queue.shift();if(Array.isArray(value)){queue.push(...value);continue;}if(!value||typeof value!=="object")continue;const item=value as Record<string,unknown>;if(item["@graph"])queue.push(item["@graph"]);const type=String(item["@type"]||"");if(!/(NewsArticle|Article|ReportageNewsArticle)/i.test(type))continue;const image=structuredImageValue(item.image);const main=typeof item.mainEntityOfPage==="string"?item.mainEntityOfPage:typeof item.mainEntityOfPage==="object"&&item.mainEntityOfPage?String((item.mainEntityOfPage as Record<string,unknown>)["@id"]||""):"";candidates.push({title:clean(String(item.headline||item.name||"")),summary:clean(String(item.description||"")),url:absoluteUrl(String(item.url||main||""),base),publishedAt:String(item.datePublished||item.dateModified||""),imageUrl:absoluteUrl(image,base),imageAlt:clean(String(item.headline||item.name||""))});}
    }catch{continue;}
  }
  for(const match of text.matchAll(/<script[^>]*(?:id=["']__NEXT_DATA__["']|type=["']application\/json["'])[^>]*>([\s\S]*?)<\/script>/gi)){try{candidates.push(...candidatesFromJsonTree(JSON.parse(match[1]),base));}catch{continue;}}
  if(candidates.length)return candidates.filter((item,index,all)=>item.title&&item.url&&all.findIndex((candidate)=>candidate.url===item.url)===index);
  for(const match of text.matchAll(/<a\b([^>]*\bhref=["']([^"']+)["'][^>]*)>([\s\S]*?)<\/a>/gi)){
    const title=clean(match[3]);if(title.length<28||title.length>220)continue;const url=absoluteUrl(match[2],base);if(!isSafeExternalUrl(url))continue;const image=match[3].match(/<img\b[^>]*(?:src|data-src)=["']([^"']+)["']/i)?.[1]||"";candidates.push({title,summary:title,url,imageUrl:absoluteUrl(image,base),imageAlt:title});
  }
  return candidates.filter((item,index,all)=>all.findIndex((candidate)=>candidate.url===item.url)===index).slice(0,100);
}

function htmlAttribute(tagText:string,name:string){
  return clean(tagText.match(new RegExp(`\\b${name}\\s*=\\s*["']([^"']*)["']`,"i"))?.[1]||"");
}
function metaContent(html:string,names:string[]){
  const wanted=new Set(names.map((name)=>name.toLowerCase()));
  for(const meta of html.match(/<meta\b[^>]*>/gi)||[]){
    const key=(htmlAttribute(meta,"property")||htmlAttribute(meta,"name")||htmlAttribute(meta,"itemprop")).toLowerCase();
    if(wanted.has(key)){const content=htmlAttribute(meta,"content");if(content)return content;}
  }
  return "";
}
function cleanArticleTitle(value:string){
  return clean(value).replace(/^\s*(?:الصفحة الرئيسية|الرئيسية)\s*(?:[-–—|:：]\s*)+/u,"").replace(/\s+\d{4}-\d{2}-\d{2}(?:\s+\d{2}:\d{2}(?::\d{2})?)?\s*(?:-->)?\s*$/," ").replace(/\s*[|｜]\s*(?:صحيفة\s+)?[^|｜]{2,45}$/u,"").replace(/\s+/g," ").trim();
}
function removeNonArticleMarkup(value:string){return value.replace(/<(?:nav|aside|header|footer|form|button|script|style|figure|figcaption)\b[^>]*>[\s\S]*?<\/(?:nav|aside|header|footer|form|button|script|style|figure|figcaption)>/gi," ");}
function contentParagraphs(value:string){
  const cleanedScope=removeNonArticleMarkup(value);
  const paragraphs=[...cleanedScope.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi)].map((match)=>clean(match[1])).filter((paragraph)=>paragraph.length>=35&&!/^(?:الرئيسية|الصفحة الرئيسية|من نحن|خدماتنا|اقرأ أيضا|مواضيع ذات صلة|تابعنا|شارك|جميع الحقوق|اشترك|عودة)/u.test(paragraph));
  return paragraphs.filter((paragraph,index,all)=>all.findIndex((candidate)=>candidate===paragraph)===index);
}
function classedElementContents(html:string,classPattern:RegExp){
  const opening=/<(main|div|section)\b[^>]*class=["']([^"']*)["'][^>]*>/gi;let match:RegExpExecArray|null;
  while((match=opening.exec(html))){
    if(!classPattern.test(match[2]))continue;
    const tagName=match[1],tagPattern=new RegExp(`<\\/?${tagName}\\b[^>]*>`,"gi");tagPattern.lastIndex=opening.lastIndex;
    let depth=1,tagMatch:RegExpExecArray|null;
    while((tagMatch=tagPattern.exec(html))){
      if(tagMatch[0].startsWith("</"))depth--;else depth++;
      if(depth===0)return html.slice(opening.lastIndex,tagMatch.index);
    }
  }
  return "";
}
function firstBodyImage(scope:string,base:string){for(const tag of scope.match(/<img\b[^>]*>/gi)||[]){const raw=htmlAttribute(tag,"src")||htmlAttribute(tag,"data-src")||htmlAttribute(tag,"data-lazy-src");const candidate=absoluteUrl(raw,base);if(candidate&&!badArticleImage(candidate))return {url:candidate,alt:htmlAttribute(tag,"alt")};}return {url:"",alt:""};}
function articleDataFromHtml(html:string,base:string):Partial<Candidate>{
  let title="",body="",publishedAt="",modifiedAt="",schemaImage="",author="",publisher="",newsSchema=false,structuredBody=false;
  for(const match of html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)){
    try{
      const queue:unknown[]=[JSON.parse(match[1])];
      while(queue.length){
        const value=queue.shift();if(Array.isArray(value)){queue.push(...value);continue;}if(!value||typeof value!=="object")continue;
        const item=value as Record<string,unknown>;if(item["@graph"])queue.push(item["@graph"]);
        const schemaType=String(item["@type"]||"");if(!/(NewsArticle|Article|ReportageNewsArticle)/i.test(schemaType))continue;
        newsSchema=newsSchema||/(NewsArticle|ReportageNewsArticle)/i.test(schemaType);
        title=title||cleanArticleTitle(String(item.headline||item.name||""));const schemaBody=clean(String(item.articleBody||""));if(schemaBody.length>body.length){body=schemaBody;structuredBody=true;}publishedAt=publishedAt||String(item.datePublished||item.dateModified||"");modifiedAt=modifiedAt||String(item.dateModified||"");
        const authorValue=item.author;author=author||clean(typeof authorValue==="string"?authorValue:Array.isArray(authorValue)?authorValue.map((entry)=>typeof entry==="object"&&entry?String((entry as Record<string,unknown>).name||""):String(entry)).filter(Boolean).join("، "):authorValue&&typeof authorValue==="object"?String((authorValue as Record<string,unknown>).name||""):"");
        const publisherValue=item.publisher;publisher=publisher||clean(typeof publisherValue==="string"?publisherValue:publisherValue&&typeof publisherValue==="object"?String((publisherValue as Record<string,unknown>).name||""):"");
        const rawImage=structuredImageValue(item.image);schemaImage=schemaImage||absoluteUrl(rawImage,base);
      }
    }catch{continue;}
  }
  const articleScope=html.match(/<article\b[^>]*>([\s\S]*?)<\/article>/i)?.[1]||classedElementContents(html,/(?:article-content|article-body|story-content|news-content|entry-content|post-content|content-body|ms-rtestate-field)/i);
  const pageHeading=cleanArticleTitle(clean((articleScope||html).match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i)?.[1]||""));
  title=pageHeading||title||cleanArticleTitle(metaContent(html,["og:title","twitter:title"])||tag(html,"title"));
  publishedAt=publishedAt||metaContent(html,["article:published_time","datepublished","date"]);
  const ogImage=absoluteUrl(metaContent(html,["og:image","og:image:url"]),base),twitterImage=absoluteUrl(metaContent(html,["twitter:image","twitter:image:src"]),base);
  const heroScope=classedElementContents(html,/(?:story-image|article-image|article-hero|story-hero|news-image|post-image|featured-image|main-image)/i),heroImage=firstBodyImage(heroScope,base),contentImage=firstBodyImage(articleScope,base),bodyImage=heroImage.url?heroImage:contentImage;
  const imageCandidates=[{url:schemaImage,method:"NewsArticle / Article structured image"},{url:ogImage,method:"Open Graph og:image"},{url:twitterImage,method:"Twitter / X card image"},{url:bodyImage.url,method:heroImage.url?"Main image associated with article":"Main image inside article body",alt:bodyImage.alt}].filter((entry,index,all)=>entry.url&&!badArticleImage(entry.url)&&all.findIndex((candidate)=>candidate.url===entry.url)===index),imageUrl=imageCandidates[0]?.url||"",imageExtractionMethod=imageCandidates[0]?.method||"none";
  if(articleScope){const paragraphBody=contentParagraphs(articleScope).join(". ");if(paragraphBody.length>body.length)body=paragraphBody;}
  const timeElement=html.match(/<time\b[^>]*(?:datetime=["']([^"']+)["'])?[^>]*>([\s\S]*?)<\/time>/i),visibleDate=clean(html.match(/<span\b[^>]*class=["'][^"']*date[^"']*["'][^>]*>([\s\S]*?)<\/span>/i)?.[1]||"");publishedAt=publishedAt||String(timeElement?.[1]||clean(timeElement?.[2]||"")||visibleDate);
  const canonicalTag=(html.match(/<link\b(?=[^>]*\brel=["']canonical["'])[^>]*>/i)||[])[0]||"",canonicalUrl=absoluteUrl(htmlAttribute(canonicalTag,"href"),base)||base;
  const articleDetected=Boolean(title&&body&&(newsSchema||(Boolean(articleScope)&&Boolean(publishedAt))));
  return {title,summary:body,publishedAt,modifiedAt,canonicalUrl,imageUrl,imageAlt:bodyImage.alt||title,author,publisher,articleDetected,newsSchema,imageFromArticle:Boolean(imageUrl),imageExtractionMethod,imageCandidates,extractionMethod:structuredBody?"NewsArticle.articleBody":articleScope?"article paragraphs":"none"};
}
async function enrichCandidate(item:Candidate,source:Record<string,unknown>):Promise<Candidate>{
  const cleanedTitle=cleanArticleTitle(item.title);
  try{
    const response=await fetch(item.url,{headers:{Accept:"text/html,application/xhtml+xml;q=0.9","User-Agent":"AlmukhtasarNewsBot/1.0 (+source attribution; editorial summaries)"},signal:AbortSignal.timeout(15000),redirect:"follow",cache:"no-store"});
    if(!response.ok||!domainAllowed(response.url,source))return {...item,title:cleanedTitle||item.title,summary:"",articleDetected:false,imageFromArticle:false,fetchError:!response.ok?`HTTP ${response.status}`:"تحويل إلى نطاق غير معتمد"};
    let details=articleDataFromHtml(await response.text(),response.url),browserRendered=false;
    const renderEndpoint=String(source.renderEndpoint||"");
    if(!details.articleDetected&&renderEndpoint&&isSafeExternalUrl(renderEndpoint)){
      try{
        const renderedUrl=renderEndpoint.includes("{url}")?renderEndpoint.replace("{url}",encodeURIComponent(item.url)):`${renderEndpoint}${renderEndpoint.includes("?")?"&":"?"}url=${encodeURIComponent(item.url)}`;
        const renderedResponse=await fetch(renderedUrl,{headers:{Accept:"application/json,text/html","User-Agent":"AlmukhtasarNewsBot/2.0 BrowserHydration"},signal:AbortSignal.timeout(30000),redirect:"follow",cache:"no-store"});
        if(renderedResponse.ok){const contentType=renderedResponse.headers.get("content-type")||"",raw=await renderedResponse.text();const html=contentType.includes("json")?String((JSON.parse(raw) as Record<string,unknown>).html||""):raw;const renderedDetails=articleDataFromHtml(html,item.url);if(renderedDetails.articleDetected){details=renderedDetails;browserRendered=true;}}
      }catch{}
    }
    const detailedTitle=cleanArticleTitle(String(details.title||""));
    const detailedSummary=clean(String(details.summary||""));
    const feedImage=item.imageFromFeed&&item.imageUrl?item.imageUrl:"",imageCandidates=[...(feedImage?[{url:feedImage,method:item.imageExtractionMethod||"Official feed image field",alt:item.imageAlt}]:[]),...(details.imageCandidates||[])].filter((entry,index,all)=>all.findIndex((candidate)=>candidate.url===entry.url)===index);
    return {...item,title:detailedTitle||cleanedTitle||item.title,summary:detailedSummary,publishedAt:details.publishedAt||item.publishedAt,modifiedAt:details.modifiedAt||item.modifiedAt,canonicalUrl:details.canonicalUrl||item.url,imageUrl:imageCandidates[0]?.url||"",imageAlt:imageCandidates[0]?.alt||item.imageAlt||details.imageAlt,author:details.author,publisher:details.publisher,articleDetected:details.articleDetected===true,newsSchema:details.newsSchema===true,imageFromArticle:Boolean(imageCandidates.length),imageExtractionMethod:imageCandidates[0]?.method,imageCandidates,extractionMethod:browserRendered?`Browser rendering → ${details.extractionMethod}`:details.extractionMethod};
  }catch(error){return {...item,title:cleanedTitle||item.title,summary:"",articleDetected:false,imageFromArticle:false,fetchError:error instanceof Error?error.message:"تعذر جلب صفحة الخبر"};}
}

const NON_ARTICLE_TITLE=/^(?:الصفحة الرئيسية|الرئيسية|من نحن|خدماتنا|اتصل بنا|تواصل معنا|سياسة الخصوصية|الشروط والأحكام|الأخبار|المركز الإعلامي)(?:\s|$|[-–—|:：])/iu;
const EVENT_PATTERN=/(?:أعلن(?:ت)?|أطلق(?:ت)?|دشّن(?:ت)?|افتتح(?:ت)?|وقّع(?:ت)?|اعتمد(?:ت)?|قرّر(?:ت)?|طبّق(?:ت)?|أصدر(?:ت)?|كشف(?:ت)?|أوضح(?:ت)?|أفاد(?:ت)?|سجّل(?:ت)?|ارتفع(?:ت)?|انخفض(?:ت)?|حقق(?:ت)?|بدأ(?:ت)?|تبدأ|تنطلق|تعتزم|تستعد|وافق(?:ت)?|نظّم(?:ت)?|استضاف(?:ت)?|فاز(?:ت)?|أقر(?:ت)?|صرّح(?:ت)?|طوّر(?:ت)?|طورت)/u;
const CONTENT_STOP_WORDS=new Set(["هذا","هذه","ذلك","تلك","التي","الذي","في","من","إلى","الى","على","عن","مع","أن","إن","هو","هي","كما","عبر","خلال","ضمن","بعد","قبل","لدى","بين","حول"]);
function contentTokens(value:string){return clean(value).toLocaleLowerCase("ar").replace(/[\u064b-\u065f\u0670]/g,"").replace(/[^\p{L}\p{N}\s]/gu," ").split(/\s+/).map((word)=>word.replace(/^ال(?=.{3})/u,"")).filter((word)=>word.length>2&&!CONTENT_STOP_WORDS.has(word));}
function titleMatchesBody(title:string,body:string){const titleWords=new Set(contentTokens(title)),bodyWords=new Set(contentTokens(body));const shared=[...titleWords].filter((word)=>bodyWords.has(word)).length;return shared>=Math.min(2,titleWords.size)||shared/Math.max(titleWords.size,1)>=.45;}
function validPublicationDate(value:string){if(!value.trim())return false;const timestamp=Date.parse(value);if(!Number.isNaN(timestamp))return timestamp<=Date.now()+86400000;return /(?:19|20)\d{2}|\d{1,2}[\/-]\d{1,2}[\/-](?:19|20)?\d{2}/u.test(value);}
function nonArticleUrl(value:string){try{const path=new URL(value).pathname.replace(/\/+$/,"").toLocaleLowerCase("en");return !path||path==="/"||/(?:^|\/)(?:about(?:-us)?|contact(?:-us)?|services?|programs?|privacy|terms|search|categories?|tags?)(?:\/|$)/i.test(path)||/(?:^|\/)(?:news|media|ar\/news|en\/news)$/i.test(path)||/\/(?:default|index)\.(?:aspx?|html?)$/i.test(path);}catch{return true;}}
function badArticleImage(value:string){try{const url=new URL(value),text=decodeURIComponent(`${url.pathname} ${url.search}`).toLowerCase();return !isSafeExternalUrl(value)||/(?:^|[\/_%\s-])(?:logos?|favicon|icon|avatar|author|profile|banner|advert|ads?|sprite|placeholder|default|metatag|site[-_]?image|brand|masthead)(?:[\/_\-.%\s]|$)/i.test(text);}catch{return true;}}
function imageDimensions(bytes:Uint8Array){
  if(bytes.length>=24&&bytes[0]===0x89&&bytes[1]===0x50&&bytes[2]===0x4e&&bytes[3]===0x47)return {width:(bytes[16]<<24)|(bytes[17]<<16)|(bytes[18]<<8)|bytes[19],height:(bytes[20]<<24)|(bytes[21]<<16)|(bytes[22]<<8)|bytes[23]};
  if(bytes.length>=10&&String.fromCharCode(...bytes.slice(0,3))==="GIF")return {width:bytes[6]|bytes[7]<<8,height:bytes[8]|bytes[9]<<8};
  if(bytes.length>=30&&String.fromCharCode(...bytes.slice(0,4))==="RIFF"&&String.fromCharCode(...bytes.slice(8,12))==="WEBP"&&String.fromCharCode(...bytes.slice(12,16))==="VP8X")return {width:1+bytes[24]+(bytes[25]<<8)+(bytes[26]<<16),height:1+bytes[27]+(bytes[28]<<8)+(bytes[29]<<16)};
  if(bytes.length>=30&&String.fromCharCode(...bytes.slice(0,4))==="RIFF"&&String.fromCharCode(...bytes.slice(8,12))==="WEBP"&&String.fromCharCode(...bytes.slice(12,16))==="VP8 "&&bytes[23]===0x9d&&bytes[24]===0x01&&bytes[25]===0x2a)return {width:(bytes[26]|bytes[27]<<8)&0x3fff,height:(bytes[28]|bytes[29]<<8)&0x3fff};
  if(bytes.length>=25&&String.fromCharCode(...bytes.slice(0,4))==="RIFF"&&String.fromCharCode(...bytes.slice(8,12))==="WEBP"&&String.fromCharCode(...bytes.slice(12,16))==="VP8L"&&bytes[20]===0x2f)return {width:1+bytes[21]+((bytes[22]&0x3f)<<8),height:1+(bytes[22]>>6)+(bytes[23]<<2)+((bytes[24]&0x0f)<<10)};
  if(bytes.length>=4&&bytes[0]===0xff&&bytes[1]===0xd8){let offset=2;while(offset+9<bytes.length){if(bytes[offset]!==0xff){offset++;continue;}const marker=bytes[offset+1],length=(bytes[offset+2]<<8)+bytes[offset+3];if([0xc0,0xc1,0xc2,0xc3,0xc5,0xc6,0xc7,0xc9,0xca,0xcb,0xcd,0xce,0xcf].includes(marker))return {height:(bytes[offset+5]<<8)+bytes[offset+6],width:(bytes[offset+7]<<8)+bytes[offset+8]};if(length<2)break;offset+=2+length;}}
  return null;
}
async function verifyArticleImage(value:string,articleUrl:string){
  if(badArticleImage(value))return null;
  const headers={Accept:"image/avif,image/webp,image/png,image/jpeg,image/*","User-Agent":"Mozilla/5.0 (compatible; AlmukhtasarNewsBot/1.0)",Referer:articleUrl};
  try{const response=await fetch(value,{headers:{...headers,Range:"bytes=0-65535"},redirect:"follow",cache:"no-store",signal:AbortSignal.timeout(12000)});const contentType=(response.headers.get("content-type")||"").split(";")[0],declaredSize=Number(response.headers.get("content-length")||0);if(!response.ok||!isSafeExternalUrl(response.url)||!contentType.startsWith("image/")||(declaredSize>0&&declaredSize<4000))return null;const buffer=await response.arrayBuffer(),bytes=new Uint8Array(buffer),urlSize=response.url.match(/(?:[?/,])w=(\d+).*?h=(\d+)/i),dimensions=imageDimensions(bytes)||(urlSize?{width:Number(urlSize[1]),height:Number(urlSize[2])}:null);if(bytes.byteLength<1024||!dimensions||dimensions.width<320||dimensions.height<180||dimensions.width*dimensions.height<90000)return null;return {url:response.url,contentType,width:dimensions.width,height:dimensions.height};}catch{return null;}
}
function validationErrors(item:Candidate,category:NewsCategory,subcategory:string|null){
  const title=cleanArticleTitle(item.title),body=clean(item.summary),words=contentTokens(body);
  const errors:string[]=[];
  if(!isSafeExternalUrl(item.url)||nonArticleUrl(item.url))errors.push("الرابط لا يشير إلى صفحة خبر فردية خارجية");
  if(title.length<15||contentTokens(title).length<3||NON_ARTICLE_TITLE.test(title))errors.push("العنوان ليس عنوان خبر صالحًا");
  if(!item.articleDetected)errors.push("لم تُكتشف بنية مقال إخباري موثوقة في الصفحة");
  if(body.length<220||words.length<40||isNearDuplicate(title,body))errors.push("متن الخبر مفقود أو أقصر من الحد اللازم لاستخراج حدث");
  if(!EVENT_PATTERN.test(body))errors.push("لا يحتوي المتن على واقعة أو قرار إخباري قابل للتحديد");
  if(!titleMatchesBody(title,body))errors.push("العنوان والمتن لا يصفان الموضوع نفسه");
  if(!validPublicationDate(String(item.publishedAt||"")))errors.push("تاريخ النشر مفقود أو غير صالح");
  if(!subcategory)errors.push(`تعذر تعيين تصنيف فرعي موثوق ضمن ${category}`);
  if(item.fetchError)errors.push(`تعذر جلب صفحة الخبر: ${item.fetchError}`);
  return [...new Set(errors)];
}
function containsVerbatimSourceText(sourceBody:string,values:string[]){
  const normalizedSource=clean(sourceBody).replace(/[.!؟؛،]/g," ").replace(/\s+/g," ").trim();
  return values.some((value)=>{const normalized=clean(value).replace(/[.!؟؛،]/g," ").replace(/\s+/g," ").trim();return normalized.length>=45&&normalizedSource.includes(normalized);});
}

function allowedCategoriesForSource(title:string,source:Record<string,unknown>={}){
  const configured=String(source.categories||"").split(/[،,\n]+/).map((category)=>category.trim()).filter((category):category is NewsCategory=>NEWS_CATEGORIES.includes(category as NewsCategory));
  return NEWS_CATEGORIES.filter((category)=>APPROVED_CATEGORY_SOURCES[category].includes(title)||configured.includes(category)) as NewsCategory[];
}
function domainAllowed(value:string,source:Record<string,unknown>){try{const host=new URL(value).hostname.replace(/^www\./,"");let siteDomain="";try{siteDomain=new URL(String(source.url||"")).hostname.replace(/^www\./,"");}catch{siteDomain="";}const official=String(source.officialDomain||siteDomain);const extras=String(source.allowedDomains||"").split(/[،,\s]+/).filter(Boolean);return [official,...extras].filter(Boolean).some((domain)=>host===domain||host.endsWith(`.${domain}`));}catch{return false;}}
function hasWebsiteConnector(value:unknown){const method=String(value||"");return method.includes("موقع")||method.includes("صفحة أخبار رسمية");}

export async function GET(){return NextResponse.json({data:listSourceRefreshRuns(15)});}

export async function POST(request:NextRequest){
  recoverStaleNewsPipelineItems();
  const startedAt=new Date().toISOString();let actor="مدير النظام";try{actor=decodeURIComponent(request.headers.get("x-admin-user")||actor);}catch{}
  let sourceId:string|undefined,categoryFilter:string|undefined,workflow="",triggerType="manual",scheduleId:string|undefined,repairExisting=false;
  try { const body=await request.json();sourceId=String(body.sourceId||"")||undefined;categoryFilter=String(body.category||"")||undefined;workflow=String(body.workflow||"");triggerType=body.triggerType==="scheduled"?"scheduled":"manual";scheduleId=String(body.scheduleId||"")||undefined;repairExisting=body.repairExisting===true; } catch { sourceId=undefined; }
  const runTarget=sourceId?"source":categoryFilter?"category":"news",targetId=sourceId||categoryFilter;
  const retrievalRun=startRetrievalRun({triggerType,targetType:runTarget,targetId,scheduleId,actor}),lockKey=`news:${targetId||"all"}`;
  if(!acquireRetrievalLock(lockKey,retrievalRun.id)){finishRetrievalRun(retrievalRun.id,"blocked",{},"توجد جلسة جلب أخرى قيد التشغيل للنطاق نفسه");return NextResponse.json({error:"توجد جلسة جلب أخرى قيد التشغيل للنطاق نفسه"},{status:409});}
  const allActive=listRecords("sources",{status:"نشط",limit:100}).data;
  const selected=sourceId?[getRecord("sources",sourceId)].filter(Boolean):categoryFilter?allActive.filter((source)=>allowedCategoriesForSource(source.title,source.data).includes(categoryFilter as NewsCategory)):allActive;
  if(sourceId&&!selected.length){finishRetrievalRun(retrievalRun.id,"failed",{},"المصدر غير موجود");releaseRetrievalLock(lockKey,retrievalRun.id);return NextResponse.json({error:"NOT_FOUND"},{status:404});}
  const knownContent:AdminRecord[]=[];for(let page=1;page<=100;page++){const result=listRecords("content",{page,limit:100});knownContent.push(...result.data);if(page>=result.meta.pages)break;}

  const details:Array<Record<string,unknown>>=[];
  const categoryResults=Object.fromEntries(NEWS_CATEGORIES.map((category)=>[category,{fetched:0,imported:0,updated:0,duplicates:0}])) as Record<NewsCategory,{fetched:number;imported:number;updated:number;duplicates:number}>;
  let found=0, imported=0, updated=0, imagesImported=0, fallbackImages=0, duplicates=0, failed=0, skipped=0, review=0, drafts=0, reserve=0, published=0, invalidForReview=0, sensitiveForReview=0;
  for(let batchStart=0;batchStart<selected.length;batchStart+=5){
  await Promise.all(selected.slice(batchStart,batchStart+5).map(async(source)=>{
    if(!source) return;
    if(source.status!=="نشط"){skipped++;details.push({sourceId:source.id,name:source.title,status:"متوقف",message:"المصدر غير نشط"});return;}
    const allowedCategories=allowedCategoriesForSource(source.title,source.data), trust=Number(source.data.trust)||0;
    if(source.data.approved!==true||source.data.verificationStatus!=="معتمد"||trust<80||!allowedCategories.length){skipped++;details.push({sourceId:source.id,name:source.title,status:"مستبعد",message:"المصدر غير معتمد أو غير موثوق أو غير مرتبط بتصنيف معتمد"});return;}
    const adapter=createSourceAdapter(source),sourceState=getSourceRetrievalState(source.id),sourceStarted=Date.now();
    if(!adapter.endpoints.length){skipped++;saveSourceRetrievalState(source.id,{adapter:adapter.id,healthStatus:"Paused",lastCheckedAt:new Date().toISOString(),lastError:"لا يوجد موصل مكتمل"});details.push({sourceId:source.id,name:source.title,status:"بحاجة إلى موصل",message:"أضف رابط RSS أو Atom أو API أو صفحة أخبار رسمية"});return;}
    const invalidEndpoint=adapter.endpoints.find((entry)=>!isSafeExternalUrl(entry.url)||!domainAllowed(entry.url,source.data));
    if(invalidEndpoint){failed++;saveSourceRetrievalState(source.id,{adapter:adapter.id,healthStatus:retrievalHealth((sourceState?.consecutiveFailures||0)+1),consecutiveFailures:(sourceState?.consecutiveFailures||0)+1,lastCheckedAt:new Date().toISOString(),lastError:"رابط موصل غير معتمد",httpErrors:(sourceState?.httpErrors||0)+1});details.push({sourceId:source.id,name:source.title,status:"فشل التحقق",message:"أحد روابط الموصل لا يطابق النطاق الرسمي المعتمد"});return;}
    const discoveryJob=enqueueNewsPipelineItem({runId:retrievalRun.id,sourceId:source.id,stage:"discovery",externalKey:adapter.id,payload:{adapter}});
    claimNewsPipelineItems(retrievalRun.id,source.id,"discovery",1);
    try {
      let payloads:Array<{value:string;contentType:string;text:string;method:Candidate["discoveryMethod"];etag:string;lastModified:string}>=[],adapterErrors:string[]=[];
      for(const priority of [...new Set(adapter.endpoints.map((entry)=>entry.priority))]){
        const group=adapter.endpoints.filter((entry)=>entry.priority===priority);
        const attempts=await Promise.all(group.map(async(entry)=>{
          try{
            const conditional:Record<string,string>={};if(sourceState?.etag)conditional["If-None-Match"]=sourceState.etag;if(sourceState?.lastModified)conditional["If-Modified-Since"]=sourceState.lastModified;
            let response:Response|null=null,lastAttemptError="";
            for(let attempt=0;attempt<adapter.retry.attempts;attempt++){
              try{
                response=await fetch(entry.url,{headers:{Accept:"application/rss+xml, application/atom+xml, application/json, text/html, text/xml;q=0.9","User-Agent":"AlmukhtasarNewsBot/2.0 (+source attribution; two-stage hydration)",...conditional},signal:AbortSignal.timeout(20000),redirect:"follow",cache:"no-store"});
                if(response.ok||response.status===304||[401,403,404,429].includes(response.status))break;
                lastAttemptError=`HTTP ${response.status}`;
              }catch(error){lastAttemptError=error instanceof Error?error.message:"تعذر الجلب";}
              if(attempt<adapter.retry.attempts-1){const delay=Math.min(adapter.retry.maxDelayMs,adapter.retry.baseDelayMs*(2**attempt));await new Promise((resolve)=>setTimeout(resolve,delay));}
            }
            if(!response)throw new Error(lastAttemptError||"تعذر الجلب بعد استنفاد المحاولات");
            if(response.status===304)return {unchanged:true,entry};
            if(!response.ok)throw new Error(`HTTP ${response.status}`);
            return {unchanged:false,entry,payload:{value:response.url,contentType:response.headers.get("content-type")||"",text:await response.text(),method:entry.method,etag:response.headers.get("etag")||"",lastModified:response.headers.get("last-modified")||""}};
          }catch(error){adapterErrors.push(`${entry.method}: ${error instanceof Error?error.message:"تعذر الجلب"}`);return null;}
        }));
        const successful=attempts.filter((entry):entry is NonNullable<typeof entry>=>Boolean(entry));
        if(successful.some((entry)=>entry.unchanged)){payloads=[];break;}
        payloads=successful.flatMap((entry)=>entry.payload?[entry.payload]:[]);
        if(payloads.length)break;
      }
      if(!payloads.length&&adapterErrors.length===adapter.endpoints.length)throw new Error(adapterErrors.join(" | "));
      const candidates:Candidate[]=payloads.flatMap<Candidate>(({value,contentType,text,method})=>(contentType.includes("json")||text.trimStart().startsWith("{")||text.trimStart().startsWith("[")?parseJson(JSON.parse(text),value):contentType.includes("html")||/<html[\s>]/i.test(text)?parseHtml(text,value):parseXml(text)).map((item)=>({...item,discoveryMethod:item.discoveryMethod||method}))).filter((item,index,all)=>all.findIndex((candidate)=>normalizeArticleUrl(candidate.url)===normalizeArticleUrl(item.url))===index);
      finishNewsPipelineItem(discoveryJob.id,"completed",{adapterMethod:payloads[0]?.method||sourceState?.retrievalMethod||"Unchanged",discovered:candidates.length});
      const articlePathPrefix=adapter.articlePathPrefix;
      const scopedCandidates=candidates.filter((item)=>{
        try{
          const pathname=new URL(item.url).pathname;
          if(articlePathPrefix&&!pathname.startsWith(articlePathPrefix))return false;
          if(adapter.articleUrlPattern){try{if(!new RegExp(adapter.articleUrlPattern).test(item.url))return false;}catch{}}
          if(adapter.excludedUrlPatterns.some((pattern)=>{try{return new RegExp(pattern).test(item.url);}catch{return item.url.includes(pattern);}}))return false;
          return true;
        }catch{return false;}
      });
      const includeTerms=String(source.data.keywords||"").split(/[،,\n]+/).map((value)=>value.trim().toLocaleLowerCase("ar")).filter(Boolean),excludeTerms=String(source.data.excludedWords||source.data.excludedTerms||"").split(/[،,\n]+/).map((value)=>value.trim().toLocaleLowerCase("ar")).filter(Boolean);
      const relevantCandidates=scopedCandidates.filter((item)=>{const haystack=`${item.title} ${item.summary}`.toLocaleLowerCase("ar");return (!includeTerms.length||includeTerms.some((term)=>haystack.includes(term)))&&!excludeTerms.some((term)=>haystack.includes(term));});
      const repairCandidates:Candidate[]=repairExisting?knownContent.filter((record)=>record.data.type==="خبر مستورد"&&record.data.sourceId===source.id&&isSafeExternalUrl(String(record.data.originalUrl||""))).map((record)=>({title:record.title,summary:String(record.data.summary||""),url:String(record.data.originalUrl),canonicalUrl:String(record.data.canonicalUrl||record.data.originalUrl),publishedAt:String(record.data.originalPublishedAt||""),modifiedAt:String(record.data.dateModified||""),externalId:String(record.data.externalArticleId||record.id),imageUrl:String(record.data.originalImageUrl||""),imageAlt:String(record.data.imageAlt||record.title),imageFromFeed:false,discoveryMethod:"Official news listing"})):[];
      const hydrationCandidates=(repairExisting?repairCandidates:relevantCandidates).filter((item,index,all)=>all.findIndex((candidate)=>normalizeArticleUrl(candidate.url)===normalizeArticleUrl(item.url))===index);
      const incrementalCandidates=triggerType==="scheduled"&&!repairExisting?hydrationCandidates.filter((item)=>isIncrementalCandidate(item,sourceState)):hydrationCandidates;
      const maxItems=repairExisting?1000:Math.min(Math.max(Number(source.data.maxItems)||30,1),100),acceptedRaw=incrementalCandidates.slice(0,maxItems),accepted:Candidate[]=[];
      for(const item of acceptedRaw)enqueueNewsPipelineItem({runId:retrievalRun.id,sourceId:source.id,stage:"hydration",externalKey:externalArticleKey(item),payload:item as unknown as Record<string,unknown>});
      while(true){
        const hydrationJobs=claimNewsPipelineItems(retrievalRun.id,source.id,"hydration",6);if(!hydrationJobs.length)break;
        const hydrated=await Promise.all(hydrationJobs.map(async(job)=>{let item=await enrichCandidate(job.payload as unknown as Candidate,source.data),attempts=1;if(item.fetchError||!item.articleDetected||clean(item.summary).length<220){await new Promise((resolve)=>setTimeout(resolve,300));item=await enrichCandidate(job.payload as unknown as Candidate,source.data);attempts=2;}return {job,item:{...item,hydrationAttempts:attempts}};}));
        for(const result of hydrated){const needsReview=Boolean(result.item.fetchError)||!result.item.articleDetected;accepted.push(result.item);finishNewsPipelineItem(result.job.id,needsReview?"review":"completed",{hydrated:!needsReview,hydrationAttempts:result.item.hydrationAttempts,fetchError:result.item.fetchError||""},result.item.fetchError||"");}
      }
      found+=accepted.length;
      let sourceImported=0, sourceUpdated=0, sourceImages=0, sourceDuplicates=0, sourceReview=0;
      for(const item of accepted){
        const classifiedCategory=classifyNewsCategory(`${item.title} ${item.summary} ${item.url}`,allowedCategories,source.data.strictClassification===true),category=classifiedCategory||allowedCategories[0];
        if(!category)continue;
        const subcategory=classifyNewsSubcategory(`${item.title} ${item.summary}`,category);
        const candidateTitle=cleanArticleTitle(item.title),candidateExternalId=String(item.externalId||item.guid||externalArticleKey(item));
        const existingByUrl=knownContent.find((record)=>normalizeArticleUrl(String(record.data.canonicalUrl||record.data.originalUrl||""))===normalizeArticleUrl(item.canonicalUrl||item.url));
        const existingByExternalId=knownContent.find((record)=>String(record.data.externalArticleId||((record.data.normalized as Record<string,unknown>|undefined)?.external_article_id)||"")===candidateExternalId);
        const existingByTitle=findRecordByTitle("content",candidateTitle),similar=knownContent.find((record)=>record.id!==existingByUrl?.id&&isNearDuplicate(record.title,candidateTitle));
        let existing=existingByUrl||existingByExternalId||existingByTitle;
        if(similar&&!existing){
          if(trust>Number(similar.data.trust||0)){existing=similar;}
          else{
            const supporting=Array.isArray(similar.data.supportingSources)?similar.data.supportingSources as Array<Record<string,unknown>>:[],addition={name:source.title,url:item.canonicalUrl||item.url,trust,publishedAt:item.publishedAt||null};
            if(!supporting.some((entry)=>normalizeArticleUrl(String(entry.url||""))===normalizeArticleUrl(String(addition.url))))updateRecord("content",similar.id,{data:{supportingSources:[...supporting,addition]}},actor);
            duplicates++;sourceDuplicates++;categoryResults[category].duplicates++;continue;
          }
        }
        const structured=structureRetrievedNews(item.title,item.summary||item.title);
        const errors=validationErrors(item,category,subcategory);
        const configuredSubcategories=String(source.data.subcategories||"").split(/[،,\n]+/).map((value)=>value.trim()).filter(Boolean);
        if(configuredSubcategories.length&&(!subcategory||!configuredSubcategories.includes(subcategory)))errors.push("التصنيف الفرعي لا يطابق التصنيفات المعتمدة لهذا المصدر");
        if(!classifiedCategory)errors.push("تعذر إثبات مطابقة التصنيف الرئيسي من نص الخبر");
        if(!domainAllowed(item.url,source.data))errors.push("رابط الخبر خارج نطاق المصدر المعتمد");
        if(!structured.title)errors.push("تعذر استخراج عنوان صالح من صفحة الخبر");
        if(!structured.summary)errors.push("تعذر إنشاء ملخص غير مكرر من متن الخبر");
        if(containsVerbatimSourceText(item.summary,[structured.summary,...structured.details]))errors.push("الصياغة الموجزة تتطابق حرفيًا مع نص المصدر وتحتاج إلى إعادة تحرير أصلية");
        categoryResults[category].fetched++;
        const sensitive=Boolean(source.data.sensitiveReview)||["السياسة","الصحة والجمال"].includes(category);
        const configuredMode=workflow||String(source.data.publicationMode||"");
        const wantsDraft=configuredMode==="draft"||configuredMode.includes("مسودة"),wantsReview=configuredMode==="review"||configuredMode.includes("مراجعة")||configuredMode.includes("تحقق");
        const autoPublishAllowed=source.data.automaticPublishingPermission===true||source.data.autoPublish===true;
        let status=errors.length||sensitive||wantsReview||(triggerType==="scheduled"&&!autoPublishAllowed)?"بحاجة إلى مراجعة":wantsDraft?"مسودة":"منشور";
        if(status==="منشور"){
          const recentPublished=knownContent.filter((record)=>record.status==="منشور"&&Date.parse(String(record.data.originalPublishedAt||record.updatedAt))>=Date.now()-72*60*60*1000);
          const sameSource=recentPublished.filter((record)=>record.data.sourceId===source.id).length;
          const sameCategory=recentPublished.filter((record)=>record.data.category===category),categorySourceCount=sameCategory.filter((record)=>record.data.sourceId===source.id).length;
          if((recentPublished.length>=8&&sameSource/recentPublished.length>=.35)||(sameCategory.length>=4&&categorySourceCount/sameCategory.length>=.5))status="احتياطي";
        }
        const mediaAllowed=String(source.data.mediaPolicy||"")!=="عدم إعادة استخدام الوسائط"&&String(source.data.copyrightMode||"")!=="لا يُعاد استخدام الوسائط";
        let verifiedArticleImage:Awaited<ReturnType<typeof verifyArticleImage>>=null,selectedImageCandidate:{url:string;method:string;alt?:string}|undefined;
        if(mediaAllowed&&item.imageFromArticle)for(const candidate of item.imageCandidates||[]){verifiedArticleImage=await verifyArticleImage(candidate.url,item.url);if(verifiedArticleImage){selectedImageCandidate=candidate;break;}}
        const imageUrl=verifiedArticleImage?.url||`/api/media/category-fallback/${encodeURIComponent(category)}`;
        const imageIsFallback=!verifiedArticleImage;
        const retrievalMethod=`${item.discoveryMethod||"Official news listing"} → ${item.newsSchema?"NewsArticle / Article structured data":item.extractionMethod==="article paragraphs"?"Semantic HTML article extraction":"Open Graph / semantic hydration"}`;
        const normalized=buildUnifiedNewsObject({source,item,cleanTitle:structured.title,cleanContent:item.summary,summary:structured.summary,details:structured.details,imageUrl,originalImageUrl:imageIsFallback?null:String(selectedImageCandidate?.url||verifiedArticleImage?.url||""),imageAlt:imageIsFallback?`صورة افتراضية لتصنيف ${category}`:(selectedImageCandidate?.alt||item.imageAlt||structured.title),category,subcategory:subcategory||"غير محدد",retrievalMethod,confidence:Math.max(0,Math.min(100,trust-(errors.length*12)-(imageIsFallback?4:0))),validationStatus:errors.length?"Needs Review":"Validated",duplicateStatus:existing?"Existing article update":"Unique",publicationStatus:status});
        const priorSupporting=existing&&existing.data.originalUrl&&normalizeArticleUrl(String(existing.data.originalUrl))!==normalized.canonical_url?[{name:existing.data.source||"مصدر داعم",url:existing.data.canonicalUrl||existing.data.originalUrl,trust:existing.data.trust||0,publishedAt:existing.data.originalPublishedAt||null},...(Array.isArray(existing.data.supportingSources)?existing.data.supportingSources as Array<Record<string,unknown>>:[])]:[];
        const postData={type:"خبر مستورد",category,subcategory:subcategory||"غير محدد",summary:structured.summary,details:structured.details.join("\n\n"),author:item.author||null,source:source.title,sourceId:source.id,supportingSources:priorSupporting,externalArticleId:candidateExternalId,canonicalUrl:normalized.canonical_url,originalUrl:item.url,originalPublishedAt:item.publishedAt||null,dateModified:item.modifiedAt||null,sourceType:source.data.type,trust,verified:errors.length===0,hydrationStatus:item.fetchError||!item.articleDetected?"Needs Review":"Hydrated",hydrationAttempts:item.hydrationAttempts||1,validationStatus:errors.length?"فشل التحقق الآلي":"اجتاز التحقق الآلي",validationErrors:errors,verificationChecks:["المصدر نشط ومعتمد","الرابط الخارجي عنوان مقال فردي","اكتمال مرحلة ترطيب المقال الأصلي","وجود تاريخ وبنية خبر وواقعة قابلة للتحديد","مطابقة موضوع العنوان والمتن","مطابقة التصنيف الرئيسي والفرعي","فحص التكرار قبل التلخيص","فحص عدم تكرار العنوان والملخص والمضمون","التحقق من صورة المقال أو تعيين صورة تصنيف افتراضية"],reviewRequired:Boolean(errors.length)||sensitive,reviewState:errors.length?"بحاجة إلى مراجعة الاستخراج":sensitive?"مراجعة بشرية إلزامية للمحتوى الحساس":"اجتاز التحقق الآلي",extractionMethod:item.extractionMethod||"غير محدد",newsSchema:Boolean(item.newsSchema),imageUrl,originalImageUrl:imageIsFallback?null:String(selectedImageCandidate?.url||verifiedArticleImage?.url||""),imageExtractionMethod:imageIsFallback?"Approved category fallback":selectedImageCandidate?.method||"Article image",imageWidth:verifiedArticleImage?.width||null,imageHeight:verifiedArticleImage?.height||null,imageContentType:verifiedArticleImage?.contentType||null,imageVerifiedAt:new Date().toISOString(),imageAlt:imageIsFallback?`صورة افتراضية لتصنيف ${category}`:(selectedImageCandidate?.alt||item.imageAlt||structured.title),imageCredit:imageIsFallback?`المختصر — صورة افتراضية معتمدة لتصنيف ${category}`:source.title,imageSourceUrl:imageIsFallback?null:item.url,imageIsFallback,mediaRights:imageIsFallback?"صورة تصنيف افتراضية معتمدة":"صورة المقال المستخرجة من الصفحة الأصلية؛ تخضع لشروط المصدر",rights:"صياغة موجزة أصلية؛ لا يُخزّن النص الكامل",country:normalized.country,region:normalized.region,keywords:normalized.keywords,entities:normalized.entities,retrievalConfidence:normalized.retrieval_confidence,duplicateStatus:normalized.duplicate_status,normalized,editorialVersion:4,pipelineVersion:2,ingestedAt:new Date().toISOString(),publishedAt:status==="منشور"?new Date().toISOString():null};
        Object.assign(postData,{retrievalMethod,postStatus:status,retrievedAt:postData.ingestedAt});
        const recordTitle=structured.title||cleanArticleTitle(item.title)||"مادة مستوردة بحاجة إلى مراجعة";
        let appliedStatus=status,appliedData:Record<string,unknown>=postData;
        if(existing){
          if(existing.data.type!=="خبر مستورد"){duplicates++;sourceDuplicates++;categoryResults[category].duplicates++;continue;}
          if(["منشور","معتمد"].includes(existing.status)&&!["منشور","معتمد"].includes(status)){appliedStatus=existing.status;appliedData=errors.length?{...existing.data,lastRetrievalAttemptAt:new Date().toISOString(),lastRetrievalValidationErrors:errors}:{...postData,postStatus:existing.status,publishedAt:existing.data.publishedAt||new Date().toISOString(),normalized:{...normalized,publication_status:existing.status}};}
          const changed=updateRecord("content",existing.id,{title:errors.length&&["منشور","معتمد"].includes(existing.status)?existing.title:recordTitle,status:appliedStatus,data:appliedData},actor);if(changed){const index=knownContent.findIndex((record)=>record.id===changed.id);if(index>=0)knownContent[index]=changed;}
          updated++;sourceUpdated++;categoryResults[category].updated++;
        }else{
          knownContent.push(createRecord("content",{title:recordTitle,status,data:postData},actor));
          imported++;sourceImported++;categoryResults[category].imported++;
        }
        if(verifiedArticleImage){imagesImported++;sourceImages++;}else fallbackImages++;
        if(appliedStatus==="بحاجة إلى مراجعة"){if(errors.length)invalidForReview++;else sensitiveForReview++;}
        if(appliedStatus==="منشور")published++;else if(appliedStatus==="مسودة")drafts++;else if(appliedStatus==="احتياطي")reserve++;else{review++;sourceReview++;}
      }
      const successfulAt=new Date().toISOString(),lastArticle=accepted[0],extractionFailures=accepted.filter((item)=>Boolean(item.fetchError)||!item.articleDetected).length,imageFailures=accepted.length-sourceImages;
      const health=saveSourceRetrievalState(source.id,{adapter:adapter.id,retrievalMethod:String(payloads[0]?.method||sourceState?.retrievalMethod||"Unchanged"),healthStatus:"Healthy",consecutiveFailures:0,lastCheckedAt:successfulAt,lastSuccessAt:successfulAt,lastArticleAt:lastArticle?successfulAt:sourceState?.lastArticleAt,lastArticleId:lastArticle?String(lastArticle.externalId||lastArticle.guid||externalArticleKey(lastArticle)):sourceState?.lastArticleId,lastSeenUrl:lastArticle?.canonicalUrl||lastArticle?.url||sourceState?.lastSeenUrl,lastPublicationDate:lastArticle?.publishedAt||sourceState?.lastPublicationDate,etag:payloads[0]?.etag||sourceState?.etag,lastModified:payloads[0]?.lastModified||sourceState?.lastModified,responseTimeMs:Date.now()-sourceStarted,articlesFound:(sourceState?.articlesFound||0)+accepted.length,articlesAccepted:(sourceState?.articlesAccepted||0)+sourceImported+sourceUpdated,articlesRejected:(sourceState?.articlesRejected||0)+sourceReview+sourceDuplicates,extractionFailures:(sourceState?.extractionFailures||0)+extractionFailures,imageFailures:(sourceState?.imageFailures||0)+imageFailures,lastError:""});
      updateRecord("sources",source.id,{data:{lastSuccess:successfulAt,lastError:"",lastFound:accepted.length,lastImported:sourceImported,lastUpdated:sourceUpdated,currentRetrievalMethod:health.retrievalMethod,healthStatus:health.healthStatus,consecutiveFailures:0,responseTimeMs:health.responseTimeMs,lastArticleDiscovered:lastArticle?.url||source.data.lastArticleDiscovered||null}},actor);
      details.push({sourceId:source.id,name:source.title,status:"نجح",adapter:adapter.id,method:health.retrievalMethod,responseTimeMs:health.responseTimeMs,found:accepted.length,imported:sourceImported,updated:sourceUpdated,images:sourceImages,imageFailures,extractionFailures,review:sourceReview,duplicates:sourceDuplicates});
    } catch(error){
      failed++;const message=error instanceof Error?error.message:"تعذر الاتصال";
      finishNewsPipelineItem(discoveryJob.id,"failed",{},message);
      const consecutiveFailures=(sourceState?.consecutiveFailures||0)+1,specificStatus=/\b(?:401|403)\b/.test(message)?"Authentication Required":/\b429\b/.test(message)?"Rate Limited":retrievalHealth(consecutiveFailures),health=saveSourceRetrievalState(source.id,{adapter:adapter.id,healthStatus:specificStatus,consecutiveFailures,lastCheckedAt:new Date().toISOString(),responseTimeMs:Date.now()-sourceStarted,httpErrors:(sourceState?.httpErrors||0)+1,lastError:message});
      updateRecord("sources",source.id,{data:{lastError:message,lastAttempt:new Date().toISOString(),healthStatus:health.healthStatus,consecutiveFailures,responseTimeMs:health.responseTimeMs}},actor);
      details.push({sourceId:source.id,name:source.title,status:"فشل",adapter:adapter.id,health:health.healthStatus,responseTimeMs:health.responseTimeMs,message});
    }
  }));
  }
  const expectedCategories=categoryFilter?[categoryFilter as NewsCategory]:sourceId&&selected[0]?allowedCategoriesForSource(selected[0].title,selected[0].data):NEWS_CATEGORIES;
  const uncoveredCategories=expectedCategories.filter((category)=>categoryResults[category].fetched===0);
  const report={triggerType,workflow:workflow||"source-default",repairExisting,pipelineVersion:3,architecture:"Source Registry → Health Monitor → Source Adapter → Discovery Queue → Freshness → Hydration → Image Resolver → Validation → Deduplication/Event Merge → Classification → Summary → Verification → Balanced Publication/Reserve → Watchdog",queue:newsPipelineQueueSummary(retrievalRun.id),sourcesChecked:selected.length,sourcesProcessed:details.map((item)=>item.name),succeeded:details.filter((item)=>item.status==="نجح").length,failedSources:details.filter((item)=>item.status==="فشل").map((item)=>item.name),failed,skipped,inactiveOrUnapprovedSkipped:skipped,found,imported,updated,imagesImported,fallbackImages,duplicates,invalidRejected:0,invalidForReview,sensitiveForReview,eligiblePublished:published,review,drafts,reserve,published,categories:categoryResults,uncoveredCategories,details,retrievalMethods:details.map((item)=>({source:item.name,adapter:item.adapter||"",method:item.method||"غير محدد"})),deduplication:"canonical URL + external article ID/GUID/social ID + normalized title + named entities + event/near-title similarity before summarization",sourceBalancing:"35% maximum recent-source share; overflow enters validated reserve"};
  const runStatus=failed&&failed===selected.length?"فشل":skipped===selected.length?"بحاجة إلى إعداد":failed||uncoveredCategories.length?"مكتمل بتحذيرات":"مكتمل";
  const run=saveSourceRefreshRun(sourceId||null,runStatus,report,startedAt,actor);
  finishRetrievalRun(retrievalRun.id,runStatus,report);
  releaseRetrievalLock(lockKey,retrievalRun.id);
  recoverHomepageContent("retrieval_finished");
  revalidatePath("/");revalidatePath("/search");revalidatePath("/category/[slug]","page");revalidatePath("/archive","layout");revalidatePath("/news/[slug]","page");
  return NextResponse.json({data:run});
}
