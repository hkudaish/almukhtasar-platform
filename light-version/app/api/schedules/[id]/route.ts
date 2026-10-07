import { NextResponse } from "next/server";
import { deleteSchedule, saveSchedule } from "@/database/database";
export const runtime="nodejs";
export async function PUT(request:Request,{params}:{params:Promise<{id:string}>}){try{return NextResponse.json({data:saveSchedule({...await request.json(),id:(await params).id})});}catch(error){return NextResponse.json({error:error instanceof Error?error.message:"invalid_schedule"},{status:400});}}
export async function DELETE(_:Request,{params}:{params:Promise<{id:string}>}){return deleteSchedule((await params).id)?NextResponse.json({ok:true}):NextResponse.json({error:"not_found"},{status:404});}
