import { NextResponse } from "next/server";
import { listSocialPosts } from "@/database/database";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const platform = (searchParams.get("platform") || "all") as "x" | "instagram" | "all";
  const limit = Math.min(100, Math.max(1, Number(searchParams.get("limit")) || 30));
  const minTrendScore = Number(searchParams.get("minTrendScore")) || 0;

  try {
    const posts = listSocialPosts({ platform, limit, minTrendScore });
    return NextResponse.json({
      ok: true,
      count: posts.length,
      platform,
      posts,
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "failed_to_fetch_social_posts" },
      { status: 500 }
    );
  }
}
