import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { database } from "@/database/database";

export const runtime="nodejs";
async function localFile(id:string){
  for(const directory of [path.resolve(process.cwd(),"database/media-cache"),path.resolve(process.cwd(),"database/image-cache")])try{
    const names=await readdir(directory),name=names.find((item)=>item.startsWith(`${id}-`)&&(item.endsWith(".bin")||/\.(?:jpe?g|png|webp|avif)$/i.test(item)));
    if(name){const metaName=name.endsWith(".bin")?name.replace(/\.bin$/,".json"):"",meta=metaName?JSON.parse(await readFile(path.join(directory,metaName),"utf8")):{};return {bytes:await readFile(path.join(directory,name)),type:String(meta.contentType||(/\.png$/i.test(name)?"image/png":/\.webp$/i.test(name)?"image/webp":/\.avif$/i.test(name)?"image/avif":"image/jpeg"))};}
  }catch{}return null;
}
export async function GET(_:Request,{params}:{params:Promise<{id:string}>}){const {id}=await params,file=await localFile(id);if(file)return new NextResponse(file.bytes,{headers:{"Content-Type":file.type,"Cache-Control":"public,max-age=31536000,immutable","X-Content-Type-Options":"nosniff"}});const row=database.prepare("SELECT image_original_url,source_url FROM articles WHERE id=?").get(id) as {image_original_url:string;source_url:string}|undefined;if(!row?.image_original_url)return new NextResponse(null,{status:404});try{const response=await fetch(row.image_original_url,{headers:{Referer:row.source_url,"User-Agent":process.env.RETRIEVAL_USER_AGENT||"AlmukhtasarLight/1.0"},signal:AbortSignal.timeout(12000)});if(!response.ok||!(response.headers.get("content-type")||"").startsWith("image/"))throw new Error();return new NextResponse(await response.arrayBuffer(),{headers:{"Content-Type":response.headers.get("content-type")||"image/jpeg","Cache-Control":"public,max-age=86400,stale-while-revalidate=604800"}});}catch{return new NextResponse(null,{status:404});}}
