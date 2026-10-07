import { NextResponse } from "next/server";
import { runRetrieval } from "@/services/retrieval-pipeline";
export const runtime="nodejs";export const maxDuration=800;
export async function POST(request:Request){
  try{
    const body=await request.json(),targetType=String(body.targetType||"all");
    if(!["all","source","category","failing","recovery","breaking"].includes(targetType))return NextResponse.json({error:"invalid_target"},{status:400});
    const encoder=new TextEncoder();
    const stream=new ReadableStream<Uint8Array>({
      start(controller){
        let open=true;
        const write=(value:string)=>{if(!open)return;try{controller.enqueue(encoder.encode(value));}catch{open=false;}};
        write(" \n");
        const heartbeat=setInterval(()=>write(" \n"),15000);
        runRetrieval({trigger:"manual",targetType:targetType as "all"|"source"|"category"|"failing"|"recovery"|"breaking",targetId:String(body.targetId||"")}).then((result)=>{
          clearInterval(heartbeat);write(JSON.stringify(result));if(open)controller.close();
        }).catch((error)=>{
          clearInterval(heartbeat);write(JSON.stringify({error:error instanceof Error?error.message:"retrieval_failed"}));if(open)controller.close();
        });
      }
    });
    return new Response(stream,{headers:{"Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store, no-transform"}});
  }catch(error){return NextResponse.json({error:error instanceof Error?error.message:"retrieval_failed"},{status:500});}
}
