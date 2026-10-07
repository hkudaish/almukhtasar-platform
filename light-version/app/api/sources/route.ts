import { NextResponse } from "next/server";
import { createSource, listSources } from "@/database/database";
export const runtime="nodejs";
export async function GET(){return NextResponse.json({data:listSources()});}
export async function POST(request:Request){try{return NextResponse.json({data:createSource(await request.json())},{status:201});}catch(error){return NextResponse.json({error:error instanceof Error?error.message:"invalid_body"},{status:400});}}
