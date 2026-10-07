import { NextRequest, NextResponse } from "next/server";
import { deleteRetrievalSchedule, getRetrievalSchedule, saveRetrievalSchedule } from "@/lib/admin-db";
import { nextScheduledRun } from "@/lib/retrieval-scheduler";

export async function PATCH(request:NextRequest,{params}:{params:Promise<{id:string}>}){const {id}=await params,current=getRetrievalSchedule(id);if(!current)return NextResponse.json({error:"NOT_FOUND"},{status:404});const body=await request.json(),draft={...current,...body,enabled:body.enabled===undefined?current.enabled:Boolean(body.enabled),weekdays:Array.isArray(body.weekdays)?body.weekdays:current.weekdays};return NextResponse.json({data:saveRetrievalSchedule({...draft,nextRunAt:nextScheduledRun(draft)},id)});}
export async function DELETE(_:NextRequest,{params}:{params:Promise<{id:string}>}){const {id}=await params;return deleteRetrievalSchedule(id)?NextResponse.json({ok:true}):NextResponse.json({error:"NOT_FOUND"},{status:404});}
