import { NextResponse } from "next/server";
import { listSourceRetrievalStates } from "@/lib/admin-db";

export const dynamic="force-dynamic";

export async function GET(){
  const sources=listSourceRetrievalStates();
  return NextResponse.json({data:{sources,summary:{
    healthy:sources.filter((source)=>source.healthStatus==="Healthy").length,
    degraded:sources.filter((source)=>source.healthStatus==="Degraded").length,
    failing:sources.filter((source)=>source.healthStatus==="Failing").length,
    paused:sources.filter((source)=>source.healthStatus==="Paused").length,
    extractionFailures:sources.reduce((total,source)=>total+source.extractionFailures,0),
    imageFailures:sources.reduce((total,source)=>total+source.imageFailures,0),
    httpErrors:sources.reduce((total,source)=>total+source.httpErrors,0)
  }}});
}
