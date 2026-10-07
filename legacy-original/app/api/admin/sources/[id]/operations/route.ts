import { NextRequest, NextResponse } from "next/server";
import { getRecord, getSourceRetrievalState, listRecords, updateRecord } from "@/lib/admin-db";

export const runtime="nodejs";

export async function GET(_:NextRequest,{params}:{params:Promise<{id:string}>}){
  const {id}=await params,source=getRecord("sources",id);
  if(!source)return NextResponse.json({error:"NOT_FOUND"},{status:404});
  const items=[];
  for(let page=1;page<=20&&items.length<20;page++){
    const result=listRecords("content",{page,limit:100});
    items.push(...result.data.filter((record)=>record.data.sourceId===id));
    if(page>=result.meta.pages)break;
  }
  return NextResponse.json({data:{source,state:getSourceRetrievalState(id),items:items.sort((a,b)=>Date.parse(b.updatedAt)-Date.parse(a.updatedAt)).slice(0,20).map((item)=>({id:item.id,title:item.title,status:item.status,category:item.data.category,publishedAt:item.data.originalPublishedAt||item.updatedAt,url:item.data.originalUrl,validationErrors:item.data.validationErrors||[]}))}});
}

export async function POST(request:NextRequest,{params}:{params:Promise<{id:string}>}){
  const {id}=await params,source=getRecord("sources",id);
  if(!source)return NextResponse.json({error:"NOT_FOUND"},{status:404});
  const body=await request.json().catch(()=>({})),action=String(body.action||"");
  if(action==="pause"||action==="activate"){
    const updated=updateRecord("sources",id,{status:action==="pause"?"متوقف":"نشط"},"مراقب المصادر");
    return NextResponse.json({data:updated});
  }
  if(action==="change-method"){
    const allowed=["صفحة أخبار رسمية","موقع إخباري","موقع / فيديو","RSS","Atom","REST / JSON","API","يدوي"];
    const method=String(body.method||"");
    if(!allowed.includes(method))return NextResponse.json({error:"INVALID_METHOD"},{status:400});
    const updated=updateRecord("sources",id,{data:{fetchMethod:method}},"مراقب المصادر");
    return NextResponse.json({data:updated});
  }
  return NextResponse.json({error:"INVALID_ACTION"},{status:400});
}
