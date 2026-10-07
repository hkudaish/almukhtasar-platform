import { NextResponse } from "next/server";
import { categoryMonitoringRows, listRuns, listSources, monitoringSummary, rollingCoverageRows } from "@/database/database";
export const runtime="nodejs";
export async function GET(){return NextResponse.json({data:{...monitoringSummary(),categories:categoryMonitoringRows(),days:rollingCoverageRows(),sourceDetails:listSources(),runs:listRuns()}});}
