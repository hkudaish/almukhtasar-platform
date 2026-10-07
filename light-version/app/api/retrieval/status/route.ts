import { NextResponse } from "next/server";
import { retrievalFreshness, retrievalSessionActive } from "@/database/database";

export const runtime="nodejs";
export const dynamic="force-dynamic";

export function GET(){
  const freshness=retrievalFreshness(),active=retrievalSessionActive();
  return NextResponse.json({...freshness,active},{headers:{"Cache-Control":"no-store"}});
}
