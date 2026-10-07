import { NextResponse } from "next/server";
import { repairMissingArticleImages } from "@/services/retrieval-pipeline";

export const runtime="nodejs";
export const maxDuration=300;

export async function POST(request:Request){
  try{
    const body=await request.json().catch(()=>({})),limit=Math.min(300,Math.max(1,Number(body.limit)||200)),articleIds=Array.isArray(body.articleIds)?body.articleIds.map(String).slice(0,200):[];
    return NextResponse.json(await repairMissingArticleImages(limit,"",articleIds));
  }catch(error){
    return NextResponse.json({error:error instanceof Error?error.message:"image_repair_failed"},{status:500});
  }
}
