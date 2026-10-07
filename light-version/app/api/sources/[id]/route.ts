import { NextResponse } from "next/server";
import { deleteSource, updateSource } from "@/database/database";
export const runtime="nodejs";
export async function PUT(request:Request,{params}:{params:Promise<{id:string}>}){try{const body=await request.json();if(body.status&&!['active','paused','disabled'].includes(String(body.status)))return NextResponse.json({error:"invalid_status"},{status:400});const source=updateSource((await params).id,body);return source?NextResponse.json({data:source}):NextResponse.json({error:"not_found"},{status:404});}catch(error){return NextResponse.json({error:error instanceof Error?error.message:"invalid_body"},{status:400});}}
export async function DELETE(_:Request,{params}:{params:Promise<{id:string}>}){return deleteSource((await params).id)?NextResponse.json({ok:true}):NextResponse.json({error:"not_found"},{status:404});}
