import { NextRequest, NextResponse } from "next/server";
import { refreshAllSocialPlatforms } from "@/lib/social-retrieval";

export const dynamic="force-dynamic";

export async function POST(request:NextRequest){
  const secret=process.env.SOCIAL_CRON_SECRET;
  if(!secret||request.headers.get("authorization")!==`Bearer ${secret}`)return NextResponse.json({error:"غير مصرح"},{status:401});
  return NextResponse.json({results:await refreshAllSocialPlatforms()});
}
