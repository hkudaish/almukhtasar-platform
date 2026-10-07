import { NextRequest, NextResponse } from "next/server";
import { listRetrievalSchedules, saveRetrievalSchedule } from "@/lib/admin-db";
import { nextScheduledRun } from "@/lib/retrieval-scheduler";

export const dynamic="force-dynamic";
export async function GET(){return NextResponse.json({data:listRetrievalSchedules()});}
export async function POST(request:NextRequest){const body=await request.json(),draft={...body,enabled:Boolean(body.enabled),intervalHours:Number(body.intervalHours||1),weekdays:Array.isArray(body.weekdays)?body.weekdays:[]};const saved=saveRetrievalSchedule({...draft,nextRunAt:nextScheduledRun(draft)});return NextResponse.json({data:saved},{status:201});}
