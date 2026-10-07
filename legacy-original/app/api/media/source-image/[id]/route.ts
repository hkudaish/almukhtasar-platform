import { NextResponse } from "next/server";
import { getRecord } from "@/lib/admin-db";
import { createHash } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";

export const runtime="nodejs";

function isSafeExternalUrl(value:string){
  try{
    const url=new URL(value);
    if(!["http:","https:"].includes(url.protocol))return false;
    const host=url.hostname.toLowerCase();
    return !["localhost","127.0.0.1","::1"].includes(host)&&!/^10\.|^192\.168\.|^172\.(1[6-9]|2\d|3[01])\.|^169\.254\./.test(host);
  }catch{return false;}
}

function isPlausibleImageUrl(value:string){
  try{const url=new URL(value),text=decodeURIComponent(`${url.pathname} ${url.search}`).toLowerCase();return url.pathname!=="/"&&!/\/(?:ar|en)?\/?news\/?$/.test(url.pathname)&&!/(?:^|[\/_%\s-])(?:logos?|favicon|icon|avatar|author|profile|banner|advert|ads?|sprite|placeholder|default|metatag|site[-_]?image|brand|masthead)(?:[\/_\-.%\s]|$)/i.test(text);}catch{return false;}
}

function htmlAttribute(tag:string,name:string){
  return tag.match(new RegExp(`\\b${name}\\s*=\\s*["']([^"']+)["']`,"i"))?.[1]?.replace(/&amp;/g,"&")||"";
}

function structuredImageValue(value:unknown):string{if(typeof value==="string")return value;if(Array.isArray(value))return structuredImageValue(value[0]);if(value&&typeof value==="object"){const image=value as Record<string,unknown>;return String(image.url||image.contentUrl||image["@id"]||"");}return "";}
function imageFromArticleHtml(html:string,base:string){
  const structured:string[]=[];
  for(const match of html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)){try{const queue:unknown[]=[JSON.parse(match[1])];while(queue.length){const value=queue.shift();if(Array.isArray(value)){queue.push(...value);continue;}if(!value||typeof value!=="object")continue;const item=value as Record<string,unknown>;if(item["@graph"])queue.push(item["@graph"]);if(/(?:NewsArticle|ReportageNewsArticle|Article)/i.test(String(item["@type"]||"")))structured.push(structuredImageValue(item.image));}}catch{}}
  const metas:Record<string,string[]>={og:[],twitter:[]};
  for(const tag of html.match(/<meta\b[^>]*>/gi)||[]){const key=(htmlAttribute(tag,"property")||htmlAttribute(tag,"name")||htmlAttribute(tag,"itemprop")).toLowerCase(),value=htmlAttribute(tag,"content");if(["og:image","og:image:url"].includes(key))metas.og.push(value);if(["twitter:image","twitter:image:src"].includes(key))metas.twitter.push(value);}
  const imageSrc=(html.match(/<link\b(?=[^>]*\brel=["']image_src["'])[^>]*>/i)||[])[0]||"";
  const href=htmlAttribute(imageSrc,"href");
  const heroScope=html.match(/<(?:div|figure|picture|section)\b[^>]*class=["'][^"']*(?:story-image|article-image|article-hero|story-hero|news-image|post-image|featured-image|main-image)[^"']*["'][^>]*>([\s\S]*?)<\/(?:div|figure|picture|section)>/i)?.[1]||"",heroImages=(heroScope.match(/<img\b[^>]*>/gi)||[]).map((tag)=>htmlAttribute(tag,"src")||htmlAttribute(tag,"data-src")||htmlAttribute(tag,"data-lazy-src"));
  const articleScope=html.match(/<article\b[^>]*>([\s\S]*?)<\/article>/i)?.[1]||html.match(/<(?:main|div|section)\b[^>]*class=["'][^"']*(?:article-content|article-body|story-content|news-content|entry-content|post-content|content-body|ms-rtestate-field)[^"']*["'][^>]*>([\s\S]*?)<\/(?:main|div|section)>/i)?.[1]||"",bodyImages=(articleScope.match(/<img\b[^>]*>/gi)||[]).map((tag)=>htmlAttribute(tag,"src")||htmlAttribute(tag,"data-src")||htmlAttribute(tag,"data-lazy-src"));
  return [...structured,...metas.og,...metas.twitter,href,...heroImages,...bodyImages].map((value)=>{try{return new URL(value,base).toString();}catch{return "";}}).filter((url,index,all)=>isSafeExternalUrl(url)&&isPlausibleImageUrl(url)&&all.indexOf(url)===index);
}

function imageDimensions(bytes:Uint8Array){if(bytes.length>=24&&bytes[0]===0x89&&bytes[1]===0x50&&bytes[2]===0x4e&&bytes[3]===0x47)return {width:(bytes[16]<<24)|(bytes[17]<<16)|(bytes[18]<<8)|bytes[19],height:(bytes[20]<<24)|(bytes[21]<<16)|(bytes[22]<<8)|bytes[23]};if(bytes.length>=10&&String.fromCharCode(...bytes.slice(0,3))==="GIF")return {width:bytes[6]|bytes[7]<<8,height:bytes[8]|bytes[9]<<8};if(bytes.length>=30&&String.fromCharCode(...bytes.slice(0,4))==="RIFF"&&String.fromCharCode(...bytes.slice(8,12))==="WEBP"&&String.fromCharCode(...bytes.slice(12,16))==="VP8X")return {width:1+bytes[24]+(bytes[25]<<8)+(bytes[26]<<16),height:1+bytes[27]+(bytes[28]<<8)+(bytes[29]<<16)};if(bytes.length>=30&&String.fromCharCode(...bytes.slice(0,4))==="RIFF"&&String.fromCharCode(...bytes.slice(8,12))==="WEBP"&&String.fromCharCode(...bytes.slice(12,16))==="VP8 "&&bytes[23]===0x9d&&bytes[24]===0x01&&bytes[25]===0x2a)return {width:(bytes[26]|bytes[27]<<8)&0x3fff,height:(bytes[28]|bytes[29]<<8)&0x3fff};if(bytes.length>=25&&String.fromCharCode(...bytes.slice(0,4))==="RIFF"&&String.fromCharCode(...bytes.slice(8,12))==="WEBP"&&String.fromCharCode(...bytes.slice(12,16))==="VP8L"&&bytes[20]===0x2f)return {width:1+bytes[21]+((bytes[22]&0x3f)<<8),height:1+(bytes[22]>>6)+(bytes[23]<<2)+((bytes[24]&0x0f)<<10)};if(bytes.length>=4&&bytes[0]===0xff&&bytes[1]===0xd8){let offset=2;while(offset+9<bytes.length){if(bytes[offset]!==0xff){offset++;continue;}const marker=bytes[offset+1],length=(bytes[offset+2]<<8)+bytes[offset+3];if([0xc0,0xc1,0xc2,0xc3,0xc5,0xc6,0xc7,0xc9,0xca,0xcb,0xcd,0xce,0xcf].includes(marker))return {height:(bytes[offset+5]<<8)+bytes[offset+6],width:(bytes[offset+7]<<8)+bytes[offset+8]};if(length<2)break;offset+=2+length;}}return null;}

async function downloadImage(url:string,referer:string){
  if(!isSafeExternalUrl(url)||!isPlausibleImageUrl(url))return null;
  const response=await fetch(url,{headers:{Accept:"image/avif,image/webp,image/png,image/jpeg,image/*;q=0.8","User-Agent":"Mozilla/5.0 (compatible; AlmukhtasarImageProxy/1.0)",...(isSafeExternalUrl(referer)?{Referer:referer}:{})},redirect:"follow",cache:"no-store",signal:AbortSignal.timeout(15000)});
  const contentType=(response.headers.get("content-type")||"").split(";")[0].trim().toLowerCase();
  if(!response.ok||!isSafeExternalUrl(response.url)||!contentType.startsWith("image/"))return null;
  const bytes=await response.arrayBuffer();
  const urlSize=response.url.match(/(?:[?/,])w=(\d+).*?h=(\d+)/i),dimensions=imageDimensions(new Uint8Array(bytes))||(urlSize?{width:Number(urlSize[1]),height:Number(urlSize[2])}:null);
  if(bytes.byteLength<4000||bytes.byteLength>12*1024*1024||!dimensions||dimensions.width<320||dimensions.height<180||dimensions.width*dimensions.height<90000)return null;
  return {bytes,contentType,width:dimensions.width,height:dimensions.height};
}

const cacheDirectory=path.join(process.cwd(),"data","image-cache");
async function cachedImage(id:string,imageUrl:string){const key=createHash("sha256").update(imageUrl).digest("hex").slice(0,20),base=path.join(cacheDirectory,`${id}-${key}`);try{const [bytes,meta]=await Promise.all([readFile(`${base}.bin`),readFile(`${base}.json`,"utf8")]),copy=new Uint8Array(bytes.byteLength);copy.set(bytes);return {bytes:copy.buffer,...(JSON.parse(meta) as {contentType:string;width:number|null;height:number|null})};}catch{return null;}}
async function saveCachedImage(id:string,imageUrl:string,result:{bytes:ArrayBuffer;contentType:string;width:number|null;height:number|null}){await mkdir(cacheDirectory,{recursive:true});const key=createHash("sha256").update(imageUrl).digest("hex").slice(0,20),base=path.join(cacheDirectory,`${id}-${key}`),nonce=`${process.pid}-${Date.now()}`;await Promise.all([writeFile(`${base}.${nonce}.bin`,Buffer.from(result.bytes)),writeFile(`${base}.${nonce}.json`,JSON.stringify({contentType:result.contentType,width:result.width,height:result.height}))]);await Promise.all([rename(`${base}.${nonce}.bin`,`${base}.bin`),rename(`${base}.${nonce}.json`,`${base}.json`)]);}

export async function GET(_:Request,{params}:{params:Promise<{id:string}>}){
  const {id}=await params;
  const record=getRecord("content",id);
  const imageUrl=String(record?.data.imageUrl||"");
  const cacheIdentity=`${imageUrl}|${String(record?.data.imageVerifiedAt||record?.updatedAt||"")}`;
  const originalUrl=String(record?.data.originalUrl||"");
  if(!record||record.deleted||record.data.type!=="خبر مستورد"||record.data.imageIsFallback===true||!isSafeExternalUrl(originalUrl))return new NextResponse(null,{status:404});
  try{
    let result=isSafeExternalUrl(imageUrl)?await cachedImage(id,cacheIdentity):null;
    if(!result&&isSafeExternalUrl(imageUrl)){result=await downloadImage(imageUrl,originalUrl);if(result)await saveCachedImage(id,cacheIdentity,result);}
    if(!result){
      const article=await fetch(originalUrl,{headers:{Accept:"text/html,application/xhtml+xml","User-Agent":"Mozilla/5.0 (compatible; AlmukhtasarImageProxy/1.0)"},redirect:"follow",cache:"no-store",signal:AbortSignal.timeout(15000)});
      if(article.ok&&isSafeExternalUrl(article.url))for(const discovered of imageFromArticleHtml(await article.text(),article.url)){result=await downloadImage(discovered,article.url);if(result)break;}
    }
    if(!result)return new NextResponse(null,{status:404});
    return new NextResponse(result.bytes,{headers:{"Content-Type":result.contentType,"Content-Length":String(result.bytes.byteLength),"Cache-Control":"public, max-age=31536000, immutable","X-Image-Width":String(result.width||"unknown"),"X-Image-Height":String(result.height||"unknown"),"X-Content-Type-Options":"nosniff"}});
  }catch{return new NextResponse(null,{status:404});}
}
