import { NextResponse } from "next/server";
import { listSchedules, saveSchedule } from "@/database/database";
export const runtime="nodejs";
export async function GET(){return NextResponse.json({data:listSchedules()});}
export async function POST(request:Request){try{return NextResponse.json({data:saveSchedule(await request.json())});}catch(error){return NextResponse.json({error:error instanceof Error?error.message:"invalid_schedule"},{status:400});}}
