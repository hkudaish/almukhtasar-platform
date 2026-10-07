import { NextResponse } from "next/server";
import { runArchiveLifecycle } from "@/database/database";
export const runtime="nodejs";
export async function GET(request:Request){const secret=process.env.CRON_SECRET;if(secret&&request.headers.get("authorization")!==`Bearer ${secret}`)return NextResponse.json({error:"unauthorized"},{status:401});return NextResponse.json({archived:runArchiveLifecycle()});}
