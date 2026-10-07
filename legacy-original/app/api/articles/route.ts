import { NextRequest, NextResponse } from "next/server";
import { getPublishedImportedStories } from "@/lib/public-content";

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const query = params.get("q") || "";
  const category = params.get("category") || "الكل";
  const limit = Math.min(Math.max(Number(params.get("limit")) || 20, 1), 50);
  const allStories=getPublishedImportedStories(100);
  const normalized=query.trim().toLocaleLowerCase("ar");
  const filtered=allStories.filter((story)=>(category==="الكل"||story.category===category)&&(!normalized||[story.title,story.summary,story.category,story.source,...story.tags].join(" ").toLocaleLowerCase("ar").includes(normalized)));
  const items = filtered.slice(0, limit);
  return NextResponse.json({ data: items, meta: { total: filtered.length, available: allStories.length, limit } });
}
