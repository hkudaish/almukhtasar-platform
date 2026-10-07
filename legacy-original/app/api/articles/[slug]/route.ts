import { NextResponse } from "next/server";
import { getPublishedImportedStory } from "@/lib/public-content";
export async function GET(_: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const story = getPublishedImportedStory(slug);
  return story ? NextResponse.json({ data: story }) : NextResponse.json({ error: "ARTICLE_NOT_FOUND" }, { status: 404 });
}
