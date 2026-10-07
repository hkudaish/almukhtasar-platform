import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { isExternalHttpUrl } from "@/lib/content-policy";
import { isClearlyNonEditorialImage } from "@/lib/featured-images";
import type { FeaturedImageCandidate } from "@/types/news";

const cacheDirectory=path.resolve(process.cwd(),"database/media-cache");
const ascii=(bytes:Uint8Array,start:number,length:number)=>String.fromCharCode(...bytes.slice(start,start+length));
const uint32=(bytes:Uint8Array,start:number)=>(bytes[start]*0x1000000)+(bytes[start+1]<<16)+(bytes[start+2]<<8)+bytes[start+3];
function dimensions(bytes:Uint8Array){
  if(bytes.length>24&&bytes[0]===0x89&&bytes[1]===0x50)return {width:uint32(bytes,16),height:uint32(bytes,20)};
  if(bytes.length>10&&ascii(bytes,0,3)==="GIF")return {width:bytes[6]|bytes[7]<<8,height:bytes[8]|bytes[9]<<8};
  if(bytes.length>30&&ascii(bytes,0,4)==="RIFF"&&ascii(bytes,8,4)==="WEBP"){
    const format=ascii(bytes,12,4);
    if(format==="VP8X")return {width:1+bytes[24]+(bytes[25]<<8)+(bytes[26]<<16),height:1+bytes[27]+(bytes[28]<<8)+(bytes[29]<<16)};
    if(format==="VP8L"&&bytes[20]===0x2f)return {width:1+bytes[21]+((bytes[22]&0x3f)<<8),height:1+(bytes[22]>>6)+(bytes[23]<<2)+((bytes[24]&0x0f)<<10)};
    for(let index=20;index+7<Math.min(bytes.length,80);index++)if(bytes[index]===0x9d&&bytes[index+1]===0x01&&bytes[index+2]===0x2a)return {width:(bytes[index+3]|bytes[index+4]<<8)&0x3fff,height:(bytes[index+5]|bytes[index+6]<<8)&0x3fff};
  }
  for(let index=4;index+16<Math.min(bytes.length,4096);index++)if(ascii(bytes,index,4)==="ispe")return {width:uint32(bytes,index+8),height:uint32(bytes,index+12)};
  if(bytes.length>4&&bytes[0]===0xff&&bytes[1]===0xd8){let offset=2;while(offset+9<bytes.length){if(bytes[offset]!==0xff){offset++;continue;}const marker=bytes[offset+1],length=(bytes[offset+2]<<8)+bytes[offset+3];if([0xc0,0xc1,0xc2,0xc3,0xc9,0xca].includes(marker))return {height:(bytes[offset+5]<<8)+bytes[offset+6],width:(bytes[offset+7]<<8)+bytes[offset+8]};if(length<2)break;offset+=2+length;}}
  return null;
}
function normalizedImageUrl(value:string){
  try{
    const url=new URL(value);
    if(url.hostname==="sabq.org"&&url.pathname.startsWith("/cdn-cgi/image/")){
      const articlePath=url.pathname.indexOf("/news/");
      if(articlePath>=0)return `https://media.sabq.org${url.pathname.slice(articlePath)}${url.search}`;
    }
    return url.toString();
  }catch{return "";}
}
const empty=(status:string)=>({valid:false,url:"",localUrl:"",thumbnailUrl:"",width:null,height:null,status,alt:"",caption:"",credit:"",origin:""});
export async function resolveImage(value:string|FeaturedImageCandidate,articleUrl:string,articleId:string){
  const metadata=typeof value==="string"?{url:value,origin:"content",alt:"",caption:"",credit:""}:value,candidate=normalizedImageUrl(metadata.url);
  if(!candidate||!isExternalHttpUrl(candidate))return empty("missing_or_invalid_url");
  const authoritative=["og","twitter","structured","api"].includes(metadata.origin);
  if(isClearlyNonEditorialImage(`${candidate} ${metadata.alt} ${metadata.caption} ${metadata.credit}`,authoritative))return empty("rejected_non_editorial_image");
  try{
    const response=await fetch(candidate,{headers:{Accept:"image/webp,image/jpeg,image/png,image/avif;q=.8,image/*;q=.5",Referer:articleUrl,"User-Agent":process.env.RETRIEVAL_USER_AGENT||"AlmukhtasarLight/1.0"},redirect:"follow",cache:"no-store",signal:AbortSignal.timeout(15000)});
    const type=(response.headers.get("content-type")||"").split(";")[0];
    if(!response.ok)throw new Error(`image_http_${response.status}`);
    if(!type.startsWith("image/")||!isExternalHttpUrl(response.url))throw new Error("invalid_image_content_type");
    if(isClearlyNonEditorialImage(response.url,authoritative))throw new Error("rejected_non_editorial_image");
    const buffer=Buffer.from(await response.arrayBuffer()),size=dimensions(buffer);
    if(buffer.length<4000)throw new Error("image_file_too_small");
    if(buffer.length>12*1024*1024)throw new Error("image_file_too_large");
    // Some publishers use a portrait author or article image as the featured
    // image. A 300px-wide original is still suitable for our thumbnail sizes;
    // retain a floor high enough to exclude icons and UI assets.
    if(!size||size.width<240||size.height<180)throw new Error("invalid_image_dimensions");
    const ratio=size.width/size.height;if(ratio>4.5||ratio<.22)throw new Error("non_editorial_image_aspect_ratio");
    await mkdir(cacheDirectory,{recursive:true});const key=createHash("sha256").update(response.url).digest("hex").slice(0,20),extension=type.includes("png")?"png":type.includes("webp")?"webp":type.includes("avif")?"avif":"jpg";
    await writeFile(path.join(cacheDirectory,`${articleId}-${key}.${extension}`),buffer);
    return {valid:true,url:candidate,localUrl:`/api/media/${articleId}`,thumbnailUrl:`/api/media/${articleId}?variant=thumbnail`,width:size.width,height:size.height,status:"valid",alt:metadata.alt,caption:metadata.caption,credit:metadata.credit,origin:metadata.origin};
  }catch(error){return empty(error instanceof Error?error.message:"image_download_failed");}
}
export async function resolveFeaturedImage(candidates:FeaturedImageCandidate[],articleUrl:string,articleId:string){
  const failures:string[]=[];
  for(const candidate of candidates){const result=await resolveImage(candidate,articleUrl,articleId);if(result.valid)return result;failures.push(`${candidate.origin}:${result.status}`);}
  return empty(failures.length?`all_candidates_failed (${failures.join(" | ")})`:"no_article_image_candidates");
}
export async function cachedMediaFile(articleId:string){
  try{const files=(await import("node:fs/promises")).readdir(cacheDirectory);for(const name of await files)if(name.startsWith(articleId))return {bytes:await readFile(path.join(cacheDirectory,name)),type:name.endsWith(".png")?"image/png":name.endsWith(".webp")?"image/webp":name.endsWith(".avif")?"image/avif":"image/jpeg"};}catch{}return null;
}
