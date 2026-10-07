import { NextResponse } from "next/server";
import { getSocialTrendsPayload } from "@/lib/social-retrieval";

export const dynamic="force-dynamic";

export async function GET(){
  return NextResponse.json(getSocialTrendsPayload(),{headers:{"Cache-Control":"no-store, max-age=0"}});
}
