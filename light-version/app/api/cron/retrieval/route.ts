import { NextResponse } from "next/server";
import { runDueRetrievalSchedules } from "@/services/retrieval-scheduler";
export const runtime="nodejs";export const maxDuration=300;
export async function GET(request:Request){const secret=process.env.CRON_SECRET;if(secret&&request.headers.get("authorization")!==`Bearer ${secret}`)return NextResponse.json({error:"unauthorized"},{status:401});return NextResponse.json(await runDueRetrievalSchedules());}
