import { NextResponse } from "next/server";
import { listRetrievalRuns } from "@/lib/admin-db";
export const dynamic="force-dynamic";
export async function GET(){return NextResponse.json({data:listRetrievalRuns(50)});}
