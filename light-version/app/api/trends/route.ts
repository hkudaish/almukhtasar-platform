import { NextResponse } from "next/server";
import { listTrends } from "@/database/database";
import { syncTrendEngine } from "@/lib/trend-engine";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const platform = (searchParams.get("platform") || "all") as "all" | "news" | "x" | "instagram";
  const limit = Math.min(50, Math.max(1, Number(searchParams.get("limit")) || 20));

  try {
    const trends = listTrends({ platform, limit, activeOnly: true });
    return NextResponse.json({
      ok: true,
      count: trends.length,
      platform,
      trends,
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "failed_to_fetch_trends" },
      { status: 500 }
    );
  }
}

export async function POST() {
  try {
    const result = syncTrendEngine();
    return NextResponse.json({
      ok: true,
      message: "Trends synchronized successfully",
      result,
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "failed_to_sync_trends" },
      { status: 500 }
    );
  }
}
