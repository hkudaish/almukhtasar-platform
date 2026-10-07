import { NextResponse } from "next/server";
import { listHomepageRecoveryLogs } from "@/lib/admin-db";
import { recoverHomepageContent } from "@/lib/homepage-recovery";

export const dynamic="force-dynamic";
export async function GET(){const recovery=recoverHomepageContent("admin_check"),report=recovery.report as Record<string,unknown>,{blocked:_,...summary}=report,workflowBlocked=recovery.blocked.filter((item)=>!item.reasons.some((reason)=>reason.startsWith("Missing required content")||reason==="Missing category mapping"||reason==="Retrieved item did not pass validation")&&item.reasons.some((reason)=>reason.startsWith("Invalid publication status")||reason.includes("Automatic publishing")||reason.startsWith("Scheduled post"))).slice(0,20),logs=listHomepageRecoveryLogs(20).map((log)=>{const {blocked:__,...logSummary}=log.report;return {...log,report:logSummary};});return NextResponse.json({data:{report:summary,blocked:workflowBlocked,selected:recovery.eligible[0]?.id||null,logs}});}
