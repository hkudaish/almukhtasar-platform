import type { FeaturedImageCandidate } from "../types/news.ts";

const hardNonEditorial=/(?:^|[\/_.,?=&%\s-])(?:logo|favicon|icon|banner|advert|sprite|placeholder|default|social[ _-]?share|share[ _-]?image|no[ _-]?image|tracking|pixel|spacer|شعار|أيقونة|ايقونة|افتراضي|صورة افتراضية)(?:$|[\/_.,?=&%\s-])/iu;
const incidentalPortrait=/(?:^|[\/_.,?=&%\s-])(?:avatar|author|authors|profile)(?:$|[\/_.,?=&%\s-])/iu;

function decode(value:string){return value.replace(/<!\[CDATA\[|\]\]>/g,"").replace(/<[^>]+>/g," ").replace(/&amp;/g,"&").replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/&lt;/g,"<").replace(/&gt;/g,">").replace(/\s+/g," ").trim();}
function attr(element:string,name:string){return element.match(new RegExp(`\\b${name}=["']([^"']+)["']`,"i"))?.[1]||"";}
function absolute(value:string,base:string){const decoded=decode(value);if(!decoded)return "";try{return new URL(decoded,base).toString();}catch{return "";}}
function meta(html:string,key:string){for(const element of html.match(/<meta\b[^>]*>/gi)||[]){const name=(attr(element,"property")||attr(element,"name")||attr(element,"itemprop")).toLowerCase();if(name===key.toLowerCase())return decode(attr(element,"content"));}return "";}
function srcFromSet(value:string){const choices=value.split(",").map((part)=>part.trim().split(/\s+/)).map(([url,size])=>({url,weight:Number.parseInt(size||"0",10)||0})).filter((item)=>item.url);return choices.sort((a,b)=>b.weight-a.weight)[0]?.url||"";}
function imageUrl(element:string){return attr(element,"data-original")||attr(element,"data-lazy-src")||attr(element,"data-src")||srcFromSet(attr(element,"srcset")||attr(element,"data-srcset"))||attr(element,"src");}
function creditFrom(value:Record<string,unknown>){const credit=value.creditText||value.copyrightNotice||value.copyrightHolder||value.author;if(credit&&typeof credit==="object")return String((credit as Record<string,unknown>).name||"");return String(credit||"");}
function structuredCandidates(value:unknown,base:string,title:string):FeaturedImageCandidate[]{
  if(typeof value==="string")return [{url:absolute(value,base),origin:"structured",alt:title,caption:"",credit:""}];
  if(Array.isArray(value))return value.flatMap((item)=>structuredCandidates(item,base,title));
  if(!value||typeof value!=="object")return [];
  const item=value as Record<string,unknown>,url=absolute(String(item.url||item.contentUrl||item.path||item["@id"]||""),base);
  return url?[{url,origin:"structured",alt:String(item.caption||item.name||title),caption:String(item.caption||""),credit:creditFrom(item)}]:[];
}
function elementCandidate(element:string,base:string,title:string,origin:"featured"|"content",caption="",credit=""):FeaturedImageCandidate|null{
  const url=absolute(imageUrl(element),base),alt=decode(attr(element,"alt")||title),width=Number(attr(element,"width")),height=Number(attr(element,"height")),text=`${url} ${alt} ${attr(element,"class")} ${attr(element,"id")}`;
  if(!url||isClearlyNonEditorialImage(text,origin==="featured")||(width&&height&&(width<320||height<180)))return null;
  return {url,origin,alt,caption:decode(caption),credit:decode(credit||attr(element,"data-credit")||attr(element,"data-copyright")||"")};
}

export function isClearlyNonEditorialImage(value:string,allowEditorialPortrait=false){return hardNonEditorial.test(value)||(!allowEditorialPortrait&&incidentalPortrait.test(value));}

export function featuredImageCandidates({html,articleScope,structured,baseUrl,title,explicitUrls=[]}:{html:string;articleScope:string;structured?:Record<string,unknown>;baseUrl:string;title:string;explicitUrls?:string[]}){
  const candidates:FeaturedImageCandidate[]=[];
  const add=(candidate:FeaturedImageCandidate|null)=>{const authoritative=["og","twitter","structured"].includes(candidate?.origin||"");if(candidate?.url&&!candidates.some((item)=>item.url===candidate.url)&&!isClearlyNonEditorialImage(`${candidate.url} ${candidate.alt} ${candidate.caption} ${candidate.credit}`,authoritative))candidates.push(candidate);};
  const og=absolute(meta(html,"og:image")||meta(html,"og:image:secure_url"),baseUrl);if(og)add({url:og,origin:"og",alt:meta(html,"og:image:alt")||title,caption:"",credit:meta(html,"og:image:credit")||meta(html,"image:credit")});
  const twitter=absolute(meta(html,"twitter:image")||meta(html,"twitter:image:src"),baseUrl);if(twitter)add({url:twitter,origin:"twitter",alt:meta(html,"twitter:image:alt")||title,caption:"",credit:meta(html,"twitter:image:credit")});
  for(const candidate of structuredCandidates(structured?.image,baseUrl,title))add(candidate);
  for(const value of explicitUrls){const url=absolute(value,baseUrl);if(url)add({url,origin:"featured",alt:title,caption:"",credit:""});}
  for(const figure of html.match(/<(?:figure|picture|div)\b[^>]*(?:class|id)=["'][^"']*(?:featured|hero|main[-_ ]?image|article[-_ ]?image|lead[-_ ]?media)[^"']*["'][^>]*>[\s\S]*?<\/\s*(?:figure|picture|div)>/gi)||[]){const element=figure.match(/<img\b[^>]*>/i)?.[0]||"",caption=figure.match(/<figcaption\b[^>]*>([\s\S]*?)<\/figcaption>/i)?.[1]||"",credit=figure.match(/<(?:span|small|p)\b[^>]*class=["'][^"']*(?:credit|copyright|attribution)[^"']*["'][^>]*>([\s\S]*?)<\/(?:span|small|p)>/i)?.[1]||"";add(elementCandidate(element,baseUrl,title,"featured",caption,credit));}
  for(const figure of articleScope.match(/<figure\b[^>]*>[\s\S]*?<\/figure>/gi)||[]){const element=figure.match(/<img\b[^>]*>/i)?.[0]||"",caption=figure.match(/<figcaption\b[^>]*>([\s\S]*?)<\/figcaption>/i)?.[1]||"",credit=figure.match(/<(?:span|small|p)\b[^>]*class=["'][^"']*(?:credit|copyright|attribution)[^"']*["'][^>]*>([\s\S]*?)<\/(?:span|small|p)>/i)?.[1]||"";add(elementCandidate(element,baseUrl,title,"content",caption,credit));}
  for(const element of articleScope.match(/<img\b[^>]*>/gi)||[])add(elementCandidate(element,baseUrl,title,"content"));
  return candidates.slice(0,8);
}
