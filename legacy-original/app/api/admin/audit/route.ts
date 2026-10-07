import { NextRequest, NextResponse } from "next/server"; import { listAuditLogs } from "@/lib/admin-db";
export const runtime="nodejs";
export async function GET(request:NextRequest){return NextResponse.json({data:listAuditLogs(request.nextUrl.searchParams.get("q")||"",Math.min(Number(request.nextUrl.searchParams.get("limit"))||100,200))});}
