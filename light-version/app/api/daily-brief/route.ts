import { NextResponse } from "next/server";
import { getDailyBrief } from "@/database/database";
import { generateDailyBrief } from "@/lib/trend-engine";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const date = searchParams.get("date") || undefined;

  try {
    let brief = getDailyBrief(date);
    if (!brief && (!date || date === new Date().toISOString().split("T")[0])) {
      brief = generateDailyBrief();
    }
    return NextResponse.json({
      ok: true,
      brief,
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "failed_to_fetch_daily_brief" },
      { status: 500 }
    );
  }
}
