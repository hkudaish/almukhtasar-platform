import { NextResponse } from "next/server";
import { buildWatchdogReport } from "@/lib/source-monitor";

export const dynamic="force-dynamic";
export const runtime="nodejs";

export async function GET(){
  return NextResponse.json({data:buildWatchdogReport()});
}
