import type { DiscoveredArticle, HydratedArticle, RetrievalMethod, Source } from "@/types/news";
import { isExternalHttpUrl, isNonNewsTitle, isNonNewsUrl, isSourceBoilerplate, parseSourceDate } from "@/lib/content-policy";
import { featuredImageCandidates } from "@/lib/featured-images";
import { updateSourceState } from "@/database/database";
import { booleanBreakingEvidence, strongestBreakingEvidence, verifiedBreakingEvidence } from "@/lib/breaking-news";

export interface SourceAdapter{
  method:RetrievalMethod;
  discover(source:Source):Promise<DiscoveredArticle[]>;
  hydrate(item:DiscoveredArticle,source:Source):Promise<HydratedArticle>;
}

const headers=(source:Source,conditional=false)=>({Accept:"text/html,application/xhtml+xml,application/xml;q=0.9,application/json;q=0.8,*/*;q=0.7","Accept-Language":"ar-SA,ar;q=0.9,en;q=0.7","Cache-Control":"no-cache","User-Agent":process.env.RETRIEVAL_USER_AGENT||"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36",...(conditional&&source.etag?{"If-None-Match":source.etag}:{}),...(conditional&&source.lastModified?{"If-Modified-Since":source.lastModified}:{})});
function retrievalTimeout(){const configured=Number(process.env.RETRIEVAL_TIMEOUT_MS)||20000;return Math.min(60000,Math.max(5000,configured));}
function networkError(error:unknown){if(!(error instanceof Error))return "network_error";const cause=(error as Error&{cause?:{code?:string;message?:string}}).cause;return [cause?.code,error.message,cause?.message].filter(Boolean).join(": ");}
async function fetchText(url:string,source:Source){
  if(!isExternalHttpUrl(url))throw new Error("unsafe_url");
  const discoveryEndpoint=new URL(url).hostname!=="news.google.com"&&[source.apiEndpoint,source.rssEndpoint,source.sitemapEndpoint,source.listingUrl].filter(Boolean).includes(url);
  for(let attempt=1;attempt<=2;attempt++)try{
    const response=await fetch(url,{headers:headers(source,discoveryEndpoint),redirect:"follow",cache:"no-store",signal:AbortSignal.timeout(retrievalTimeout())});
    if(response.status===304)throw new Error("source_not_modified");
    if(!response.ok)throw new Error(`http_${response.status}`);
    if(discoveryEndpoint){const etag=response.headers.get("etag")||source.etag,lastModified=response.headers.get("last-modified")||source.lastModified;if(etag!==source.etag||lastModified!==source.lastModified)updateSourceState(source.id,{etag,lastModified});}
    return {text:await response.text(),response};
  }catch(error){
    const reason=networkError(error),retryable=reason!=="source_not_modified"&&!/^http_(?:4\d\d)/.test(reason);
    if(attempt===2||!retryable)throw new Error(reason);
    await new Promise((resolve)=>setTimeout(resolve,400));
  }
  throw new Error("network_error");
}
function decode(value:string){return value.replace(/<!\[CDATA\[|\]\]>/g,"").replace(/<[^>]+>/g," ").replace(/&amp;/g,"&").replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/\s+/g," ").trim();}
function tag(block:string,name:string){return block.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${name}>`,"i"))?.[1]||"";}
function attr(block:string,name:string){return block.match(new RegExp(`\\b${name}=["']([^"']+)["']`,"i"))?.[1]||"";}
function absolute(value:string,base:string){try{return new URL(decode(value),base).toString();}catch{return "";}}
function sameSite(value:string,base:string){try{const first=new URL(value),second=new URL(base);return first.hostname.replace(/^www\./,"")===second.hostname.replace(/^www\./,"");}catch{return false;}}
function isGoogleNewsArticle(value:string){try{const url=new URL(value);return url.hostname==="news.google.com"&&url.pathname.includes("/rss/articles/");}catch{return false;}}
async function resolveGoogleNewsArticle(value:string,source:Source){
  if(!isGoogleNewsArticle(value))return value;
  const token=new URL(value).pathname.split("/articles/")[1]?.split("/")[0];if(!token)return value;
  const {text}=await fetchText(value,source),signature=attr(text,"data-n-a-sg"),timestamp=attr(text,"data-n-a-ts");if(!signature||!timestamp)return value;
  const context=[["X","X",["X","X"],null,null,1,1,"US:en",null,1,null,null,null,null,null,0,1],"X","X",1,[1,1,1],1,1,null,0,0,null,0],request=JSON.stringify(["garturlreq",context,token,Number(timestamp),signature]),payload=JSON.stringify([[["Fbv4je",request,null,"generic"]]]);
  const response=await fetch("https://news.google.com/_/DotsSplashUi/data/batchexecute?rpcids=Fbv4je",{method:"POST",headers:{...headers(source),"Content-Type":"application/x-www-form-urlencoded;charset=UTF-8"},body:new URLSearchParams({"f.req":payload}).toString(),signal:AbortSignal.timeout(retrievalTimeout())});
  if(!response.ok)return value;const result=await response.text();
  for(const line of result.split("\n")){if(!line.includes("Fbv4je"))continue;try{const envelope=JSON.parse(line) as unknown[],decoded=JSON.parse(String((envelope[0] as unknown[])[2])) as unknown[];const resolved=String(decoded[1]||"");if(isExternalHttpUrl(resolved)&&!isGoogleNewsArticle(resolved))return resolved;}catch{}}
  return value;
}
function articleLike(url:string,title:string){
  if(!isExternalHttpUrl(url)||/\.(?:jpg|jpeg|png|gif|webp|svg|pdf|zip)(?:\?|$)/i.test(url))return false;
  if(isNonNewsTitle(title)||isNonNewsUrl(url))return false;
  if(/(?:login|signin|privacy|terms|contact|about|services?|programs?|search|category|tags?|communicate-ministry|knowledge-centre\/initiatives|page\/(?:srpc|srmg))(?:\/|$)/i.test(new URL(url).pathname))return false;
  const path=new URL(url).pathname,signals=/(?:news|article|story|details?|press|media-center|الأخبار|خبر|\/20\d{2}\/|\/\d{4,}\/)/i.test(path);
  return title.length>=12&&signals;
}

function feedItems(xml:string,source:Source,atom=false):DiscoveredArticle[]{
  const blocks=xml.match(atom?/<entry\b[\s\S]*?<\/entry>/gi:/<item\b[\s\S]*?<\/item>/gi)||[];
  return blocks.map((block)=>{
    const link=atom?(block.match(/<link\b[^>]*rel=["']alternate["'][^>]*>/i)?.[0]||block.match(/<link\b[^>]*>/i)?.[0]||""):tag(block,"link");
    const url=absolute(atom?attr(link,"href"):link,source.rssEndpoint||source.listingUrl);
    const category=decode(tag(block,"category")||tag(block,"media:category"));
    return {sourceId:source.id,sourceArticleId:decode(tag(block,"id")||tag(block,"guid")),guid:decode(tag(block,"guid")||tag(block,"id")),url,title:decode(tag(block,"title")),publishedAt:decode(tag(block,atom?"published":"pubDate")||tag(block,"updated"))||null,modifiedAt:decode(tag(block,"updated")||tag(block,"modified"))||null,breakingEvidence:verifiedBreakingEvidence(category,category?"category":"rss")};
  }).filter((item)=>item.url&&item.title);
}
function jsonLdObjects(html:string){const output:Record<string,unknown>[]=[];for(const match of html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)){try{const parsed=JSON.parse(match[1]);const queue:unknown[]=[parsed];while(queue.length){const value=queue.shift();if(Array.isArray(value)){queue.push(...value);continue;}if(value&&typeof value==="object"){const item=value as Record<string,unknown>;output.push(item);if(item["@graph"])queue.push(item["@graph"]);}}}catch{}}return output;}
function nextDataObjects(html:string){const output:Record<string,unknown>[]=[],match=html.match(/<script[^>]+id=["']__NEXT_DATA__["'][^>]*>([\s\S]*?)<\/script>/i);if(!match)return output;try{const queue:unknown[]=[JSON.parse(match[1])];while(queue.length){const value=queue.shift();if(Array.isArray(value)){queue.push(...value);continue;}if(value&&typeof value==="object"){const item=value as Record<string,unknown>;output.push(item);queue.push(...Object.values(item));}}}catch{}return output;}
function meta(html:string,key:string){for(const element of html.match(/<meta\b[^>]*>/gi)||[]){const name=(attr(element,"property")||attr(element,"name")||attr(element,"itemprop")).toLowerCase();if(name===key.toLowerCase())return decode(attr(element,"content"));}return "";}
function rawJsonValue(html:string,key:string){const escaped=html.match(new RegExp(`${key}\\\\?["']?\\s*:\\s*\\\\?["']([^"\\\\]+)`,"i"));return escaped?.[1]?.replace(/\\u([0-9a-f]{4})/gi,(_,code)=>String.fromCharCode(Number.parseInt(code,16))).replace(/\\\//g,"/")||"";}
function firstRawJsonValue(html:string,keys:string[]){for(const key of keys){const value=rawJsonValue(html,key);if(value)return value;}return "";}
function visibleGregorianDate(html:string){const text=decode(html).replace(/[\u200e\u200f\u202a-\u202e\u2066-\u2069]/g,"");return text.match(/\d{1,2}[-/.\s](?:يناير|فبراير|مارس|أبريل|ابريل|مايو|يونيو|يوليو|أغسطس|اغسطس|سبتمبر|أكتوبر|اكتوبر|نوفمبر|ديسمبر|\d{1,2})[-/.\s]20\d{2}(?:[ T\s]+\d{1,2}:\d{2})?/u)?.[0]||text.match(/20\d{2}[-/.]\d{1,2}[-/.]\d{1,2}(?:[ T\s–—-]+\d{1,2}:\d{2}(?::\d{2})?)?/)?.[0]||"";}
function structuredImage(value:unknown):string{if(typeof value==="string")return value;if(Array.isArray(value))return structuredImage(value[0]);if(value&&typeof value==="object"){const item=value as Record<string,unknown>;return String(item.url||item.path||item.contentUrl||item["@id"]||"");}return "";}
function hydrateHtml(html:string,item:DiscoveredArticle,source:Source):HydratedArticle{
  const nextArticle=nextDataObjects(html).find((entry)=>typeof entry.title==="string"&&(typeof entry.content==="string"||typeof entry.subtitle==="string")),structured=jsonLdObjects(html).find((entry)=>/(?:NewsArticle|Article|ReportageNewsArticle)/i.test(String(entry["@type"]||"")))||nextArticle;
  const title=String(structured?.headline||meta(html,"og:title")||decode(html.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i)?.[1]||"")||item.title);
  const articleScope=html.match(/<article\b[^>]*>([\s\S]*?)<\/article>/i)?.[1]||html.match(/<(?:main|div|section)\b[^>]*class=["'][^"']*(?:article-body|article-content|story-content|entry-content|post-content)[^"']*["'][^>]*>([\s\S]*?)<\/(?:main|div|section)>/i)?.[1]||"";
  const structuredText=String(structured?.articleBody||structured?.content||""),structuredBody=structuredText.includes("<p")?(structuredText.match(/<p\b[^>]*>[\s\S]*?<\/p>/gi)||[]).map(decode):structuredText.split(/\n{2,}|(?<=[.!؟])\s+(?=[\p{L}])/u);
  let body=structuredBody.map(decode).filter((paragraph)=>paragraph.length>30&&!isSourceBoilerplate(paragraph));
  if(!body.length)body=(articleScope.match(/<p\b[^>]*>[\s\S]*?<\/p>/gi)||[]).map(decode).filter((paragraph)=>paragraph.length>30&&!isSourceBoilerplate(paragraph));
  if(!body.length&&structured)body=(html.match(/<p\b[^>]*>[\s\S]*?<\/p>/gi)||[]).map(decode).filter((paragraph)=>paragraph.length>45&&!isSourceBoilerplate(paragraph));
  if(body.join(" ").length<120){const embedded=firstRawJsonValue(html,["articleBody","body","content","description"]);if(embedded)body=decode(embedded).split(/\n{2,}|(?<=[.!؟])\s+(?=[\p{L}])/u).filter((paragraph)=>paragraph.length>30&&!isSourceBoilerplate(paragraph));}
  const canonicalElement=html.match(/<link\b[^>]*rel=["']canonical["'][^>]*>/i)?.[0]||"";
  const canonical=absolute(attr(canonicalElement,"href")||item.url,item.url),imageCandidates=featuredImageCandidates({html,articleScope,structured,baseUrl:item.url,title,explicitUrls:[firstRawJsonValue(html,["imageUrl","image_url","thumbnail","mainImage","featuredImage"])]}),primaryImage=imageCandidates[0],published=parseSourceDate(String(structured?.datePublished||structured?.published_at||meta(html,"article:published_time")||meta(html,"date")||attr(html.match(/<time\b[^>]*datetime=["'][^"']+["'][^>]*>/i)?.[0]||"","datetime")||firstRawJsonValue(html,["datePublished","publishedAt","published_at","publishDate","publishedDate","createdAt","created_at"])||visibleGregorianDate(html)||item.publishedAt||"")),modified=parseSourceDate(String(structured?.dateModified||structured?.updated_at||meta(html,"article:modified_time")||firstRawJsonValue(html,["dateModified","updatedAt","updated_at"])||""));
  const structuredBreaking=strongestBreakingEvidence(booleanBreakingEvidence(structured?.isBreaking,"metadata"),verifiedBreakingEvidence(structured?.articleSection||structured?.genre||"","metadata"));
  const metaBreaking=strongestBreakingEvidence(booleanBreakingEvidence(meta(html,"is_breaking")||meta(html,"breaking"),"metadata"),verifiedBreakingEvidence(meta(html,"article:section"),"metadata"));
  const sourceBadge=(html.match(/<(?:span|div|b|em)\b[^>]*(?:class|data-testid)=["'][^"']*(?:breaking|urgent|breaking-news)[^"']*["'][^>]*>([\s\S]{0,80}?)<\/(?:span|div|b|em)>/iu)?.[1]||"");
  const breakingEvidence=strongestBreakingEvidence(item.breakingEvidence,structuredBreaking,metaBreaking,verifiedBreakingEvidence(decode(sourceBadge),"source_badge"));
  return {...item,title,body,imageUrl:primaryImage?.url||"",imageAlt:primaryImage?.alt||title,imageCaption:primaryImage?.caption||"",imageCredit:primaryImage?.credit||"",imageCandidates,publishedAt:published,modifiedAt:modified,author:typeof structured?.author==="object"&&structured.author?String((structured.author as Record<string,unknown>).name||""):String(structured?.author||meta(html,"author")||""),sourceName:source.name,canonicalUrl:canonical,structuredMetadata:structured||{},breakingEvidence};
}

export class RssSourceAdapter implements SourceAdapter{
  method:RetrievalMethod="rss";
  async discover(source:Source){const endpoint=source.rssEndpoint||new URL("/rss.xml",source.listingUrl).toString(),{text}=await fetchText(endpoint,source);let items=feedItems(text,{...source,rssEndpoint:endpoint},false);if(new URL(endpoint).hostname==="news.google.com"){const topics=["NATION","WORLD","BUSINESS","TECHNOLOGY","ENTERTAINMENT","SPORTS","SCIENCE","HEALTH"],feeds=await Promise.allSettled(topics.map(async(topic)=>{const url=`https://news.google.com/rss/headlines/section/topic/${topic}?hl=ar&gl=SA&ceid=SA:ar`,result=await fetchText(url,source);return feedItems(result.text,{...source,rssEndpoint:url},false);}));items=[...items,...feeds.flatMap((result)=>result.status==="fulfilled"?result.value:[])];}items=[...new Map(items.map((item)=>[item.guid||item.url,item])).values()];if(!items.length)throw new Error("rss_endpoint_returned_no_entries");return items;}
  async hydrate(item:DiscoveredArticle,source:Source){const resolved=await resolveGoogleNewsArticle(item.url,source),target=resolved===item.url?item:{...item,url:resolved};const {text}=await fetchText(target.url,source);return hydrateHtml(text,target,source);}
}
export class AtomSourceAdapter extends RssSourceAdapter{method:RetrievalMethod="atom";override async discover(source:Source){const endpoint=source.rssEndpoint||new URL("/atom.xml",source.listingUrl).toString(),{text}=await fetchText(endpoint,source),items=feedItems(text,{...source,rssEndpoint:endpoint},true);if(!items.length)throw new Error("atom_endpoint_returned_no_entries");return items;}}
export class JsonLdSourceAdapter implements SourceAdapter{
  method:RetrievalMethod="jsonld";
  async discover(source:Source){const {text}=await fetchText(source.listingUrl,source);return jsonLdObjects(text).filter((item)=>/(?:NewsArticle|Article)/i.test(String(item["@type"]||""))).map((entry)=>({sourceId:source.id,sourceArticleId:String(entry.identifier||""),guid:String(entry.identifier||""),url:absolute(String(entry.url||entry.mainEntityOfPage||""),source.listingUrl),title:String(entry.headline||entry.name||""),publishedAt:String(entry.datePublished||"")||null})).filter((item)=>item.url&&item.title);}
  async hydrate(item:DiscoveredArticle,source:Source){const {text}=await fetchText(item.url,source);return hydrateHtml(text,item,source);}
}
export class HtmlArticleAdapter extends JsonLdSourceAdapter{method:RetrievalMethod="html";override async discover(source:Source){if(!source.listingUrl)throw new Error("listing_endpoint_not_configured");const {text}=await fetchText(source.listingUrl,source);if(!text.trim())throw new Error("listing_page_returned_no_content");const structured=jsonLdObjects(text).filter((item)=>/(?:NewsArticle|Article)/i.test(String(item["@type"]||""))).map((entry)=>({sourceId:source.id,sourceArticleId:String(entry.identifier||""),guid:String(entry.identifier||""),url:absolute(String(entry.url||entry.mainEntityOfPage||""),source.listingUrl),title:String(entry.headline||entry.name||""),publishedAt:parseSourceDate(String(entry.datePublished||""))})).filter((item)=>item.url&&item.title&&!isNonNewsTitle(item.title)&&!isNonNewsUrl(item.url)),nextData=nextDataObjects(text).filter((entry)=>typeof entry.title==="string"&&Boolean(entry.sharable_link||entry.url)&&Boolean(entry.published_at||entry.datePublished)).map((entry)=>{const raw=String(entry.sharable_link||entry.url||""),url=absolute(/^https?:\/\//i.test(raw)?raw:`https://${raw.replace(/^\/+/,"")}`,source.listingUrl);return {sourceId:source.id,sourceArticleId:String(entry.uuid||entry.id||""),guid:String(entry.uuid||entry.id||url),url,title:String(entry.title),publishedAt:parseSourceDate(String(entry.published_at||entry.datePublished||""))};}).filter((item)=>item.url&&item.title&&sameSite(item.url,source.listingUrl)&&!isNonNewsTitle(item.title)&&!isNonNewsUrl(item.url)),links=(text.match(/<a\b[^>]*href=["'][^"']+["'][^>]*>[\s\S]*?<\/a>/gi)||[]).map((element)=>({url:absolute(attr(element,"href"),source.listingUrl),title:decode(element)})).filter((item)=>sameSite(item.url,source.listingUrl)&&articleLike(item.url,item.title)).map((item)=>({sourceId:source.id,sourceArticleId:"",guid:item.url,url:item.url,title:item.title,publishedAt:null}));const combined=[...structured,...nextData,...links].filter((item,index,all)=>all.findIndex((candidate)=>candidate.url===item.url)===index).slice(0,500);if(!combined.length)throw new Error(/<script[^>]+src=/i.test(text)?"javascript_listing_no_article_links":"listing_page_no_article_links_detected");return combined;}}
export class DynamicPageAdapter extends HtmlArticleAdapter{method:RetrievalMethod="dynamic";}
export class SitemapSourceAdapter extends JsonLdSourceAdapter{method:RetrievalMethod="sitemap";override async discover(source:Source){if(!source.listingUrl)throw new Error("listing_endpoint_not_configured");const sitemap=source.sitemapEndpoint||new URL("/sitemap.xml",source.listingUrl).toString(),{text}=await fetchText(sitemap,source),blocks=text.match(/<url\b[\s\S]*?<\/url>/gi)||[];const items=blocks.map((block)=>{const url=absolute(tag(block,"loc"),sitemap),published=parseSourceDate(tag(block,"lastmod"));if(!url)return null;const path=decodeURIComponent(new URL(url).pathname),title=path.split("/").filter(Boolean).at(-1)?.replace(/[-_]+/g," ")||source.name;return {sourceId:source.id,sourceArticleId:"",guid:url,url,title,publishedAt:published};}).filter((item):item is DiscoveredArticle=>Boolean(item&&sameSite(item.url,source.listingUrl)&&articleLike(item.url,item.title)));if(!items.length)throw new Error("news_sitemap_returned_no_article_urls");return items.slice(-500);}}
export class ApiSourceAdapter implements SourceAdapter{
  method:RetrievalMethod="api";
  async discover(source:Source){const {text}=await fetchText(source.apiEndpoint,source);const parsed=JSON.parse(text),items=Array.isArray(parsed)?parsed:Array.isArray(parsed.items)?parsed.items:Array.isArray(parsed.articles)?parsed.articles:[];return items.map((entry:Record<string,unknown>)=>({sourceId:source.id,sourceArticleId:String(entry.id||entry.article_id||""),guid:String(entry.guid||entry.id||""),url:absolute(String(entry.url||entry.link||""),source.apiEndpoint),title:String(entry.title||entry.headline||""),publishedAt:String(entry.published_at||entry.publishedAt||entry.date||"")||null,breakingEvidence:strongestBreakingEvidence(booleanBreakingEvidence(entry.is_breaking??entry.breaking,"api"),verifiedBreakingEvidence(entry.category||entry.type||entry.label||"","api"))})).filter((item:DiscoveredArticle)=>item.url&&item.title);}
  async hydrate(item:DiscoveredArticle,source:Source){const {text}=await fetchText(item.url,source);const contentType=text.trim().startsWith("{");if(!contentType)return hydrateHtml(text,item,source);const entry=JSON.parse(text),title=String(entry.title||entry.headline||item.title),imageUrl=absolute(structuredImage(entry.image||entry.image_url||entry.featured_image),item.url),candidate=imageUrl?{url:imageUrl,origin:"api" as const,alt:String(entry.image_alt||title),caption:String(entry.image_caption||entry.caption||""),credit:String(entry.image_credit||entry.copyright||"")}:null,breakingEvidence=strongestBreakingEvidence(item.breakingEvidence,booleanBreakingEvidence(entry.is_breaking??entry.breaking,"api"),verifiedBreakingEvidence(entry.category||entry.type||entry.label||"","api"));return {...item,title,body:Array.isArray(entry.body)?entry.body.map(String):String(entry.body||entry.content||"").split(/\n{2,}/),imageUrl,imageAlt:candidate?.alt||title,imageCaption:candidate?.caption||"",imageCredit:candidate?.credit||"",imageCandidates:candidate?[candidate]:[],publishedAt:String(entry.published_at||item.publishedAt||"")||null,modifiedAt:String(entry.updated_at||"")||null,author:String(entry.author||""),sourceName:source.name,canonicalUrl:String(entry.canonical_url||item.url),structuredMetadata:entry,breakingEvidence};}
}
const adapters:Record<RetrievalMethod,SourceAdapter>={api:new ApiSourceAdapter(),rss:new RssSourceAdapter(),atom:new AtomSourceAdapter(),sitemap:new SitemapSourceAdapter(),jsonld:new JsonLdSourceAdapter(),html:new HtmlArticleAdapter(),dynamic:new DynamicPageAdapter()};
export function adapterFor(method:RetrievalMethod){return adapters[method];}
export async function testSourceConfiguration(source:Source){
  const methods=[source.retrievalMethod,...source.fallbackMethods].filter((method,index,all)=>all.indexOf(method)===index),attempts:Array<{method:string;ok:boolean;count?:number;latest?:string|null;error?:string}>=[];
  for(const method of methods){try{const adapter=adapterFor(method),items=await adapter.discover(source);if(!items.length)throw new Error("no_article_entries_discovered");const latest=items.map((item)=>parseSourceDate(item.publishedAt)).filter(Boolean).sort().at(-1)||null,sampleErrors:string[]=[];for(const item of items.slice(0,6))try{const sample=await adapter.hydrate(item,source),bodyLength=sample.body.join(" ").length;if(bodyLength<220){sampleErrors.push(`insufficient:${bodyLength}`);continue;}attempts.push({method,ok:true,count:items.length,latest});return {ok:true,method,articlesAvailable:items.length,latestArticle:latest,sample:{title:sample.title,url:sample.url,canonicalUrl:sample.canonicalUrl,bodyLength},attempts};}catch(error){sampleErrors.push(error instanceof Error?error.message:String(error));}throw new Error(`no_hydratable_sample:${sampleErrors.join(" | ")}`);}catch(error){attempts.push({method,ok:false,error:error instanceof Error?error.message:String(error)});}}
  return {ok:false,method:"",articlesAvailable:0,latestArticle:null,attempts,error:attempts.map((attempt)=>`${attempt.method}: ${attempt.error}`).join(" | ")};
}
