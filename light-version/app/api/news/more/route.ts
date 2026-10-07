import { NextResponse } from "next/server";
import { listHomepageMoreArticles } from "@/database/database";

export const dynamic="force-dynamic";

export function GET(request:Request){
  const {searchParams}=new URL(request.url),publishedAt=searchParams.get("publishedAt")||"",id=searchParams.get("id")||"",limit=Math.min(24,Math.max(1,Number(searchParams.get("limit"))||12));
  const cursor=publishedAt&&id&&Number.isFinite(Date.parse(publishedAt))?{sourcePublishedAt:publishedAt,id}:undefined;
  return NextResponse.json(listHomepageMoreArticles(cursor,limit));
}
