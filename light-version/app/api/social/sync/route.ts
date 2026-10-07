import { NextResponse } from "next/server";
import { collectSocialPosts } from "@/services/social-collector";
import { syncTrendEngine, generateDailyBrief } from "@/lib/trend-engine";

export async function POST() {
  try {
    const socialResult = await collectSocialPosts();
    const trendResult = syncTrendEngine();
    const brief = generateDailyBrief();

    return NextResponse.json({
      ok: true,
      socialResult,
      trendResult,
      dailyBriefDate: brief.date,
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "failed_to_sync_social" },
      { status: 500 }
    );
  }
}
