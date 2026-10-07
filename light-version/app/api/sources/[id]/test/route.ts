import { NextResponse } from "next/server";
import { getSource } from "@/database/database";
import { testSourceConfiguration } from "@/services/adapters";
export const runtime="nodejs";export const maxDuration=120;
export async function POST(_:Request,{params}:{params:Promise<{id:string}>}){const source=getSource((await params).id);if(!source)return NextResponse.json({error:"source_not_found"},{status:404});const result=await testSourceConfiguration(source);return NextResponse.json(result,{status:result.ok?200:422});}
