import { createHash } from "node:crypto";
import { articlesDueForSourceCheck, finishRun, prepareHomepageSnapshot, recordArticleSourceCheck, startRun } from "@/database/database";
import { classifySourcePage } from "@/lib/source-status";
import { refreshTrackedArticle } from "@/services/retrieval-pipeline";

type MonitorOptions={breakingOnly?:boolean;limit?:number;intervalMinutes?:number};

function bodyFingerprint(html:string){
  const stable=html.replace(/<script[\s\S]*?<\/script>/gi,"").replace(/<style[\s\S]*?<\/style>/gi,"").replace(/\s+/g," ").slice(0,500000);
  return `body:${createHash("sha256").update(stable).digest("hex")}`;
}

async function fetchSourcePage(url:string,previousEtag="",previousLastModified=""){
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),15000);
  try{
    const headers:Record<string,string>={"User-Agent":"AlmukhtasarSourceMonitor/1.0","Accept":"text/html,application/xhtml+xml"};if(previousEtag&&!previousEtag.startsWith("body:"))headers["If-None-Match"]=previousEtag;if(previousLastModified)headers["If-Modified-Since"]=previousLastModified;
    const response=await fetch(url,{redirect:"follow",signal:controller.signal,headers,cache:"no-store"});
    const html=await response.text();
    return {httpStatus:response.status,finalUrl:response.url||url,html,etag:response.headers.get("etag")||previousEtag||(html?bodyFingerprint(html):""),lastModified:response.headers.get("last-modified")||previousLastModified,networkError:""};
  }catch(error){return {httpStatus:null,finalUrl:url,html:"",etag:"",lastModified:"",networkError:error instanceof Error?error.message:String(error)};}
  finally{clearTimeout(timer);}
}

export async function runSourceArticleMonitoring(options:MonitorOptions={}){
  const breakingOnly=Boolean(options.breakingOnly),limit=Math.max(1,options.limit||60),intervalMinutes=Math.max(1,options.intervalMinutes||(breakingOnly?5:120));
  const run=startRun("scheduled","verification",breakingOnly?"breaking":"regular"),rows=articlesDueForSourceCheck(limit,{breakingOnly,intervalMinutes}),counts={checked:0,active:0,updated:0,removed:0,temporary:0,redirected:0,restored:0,failed:0},errors:string[]=[];
  for(let index=0;index<rows.length;index+=4)await Promise.all(rows.slice(index,index+4).map(async(row)=>{
    const articleId=String(row.id),sourceId=String(row.source_id),url=String(row.source_url),wasRemoved=String(row.source_status)==="Removed"||Boolean(row.source_previous_publication_status),previousEtag=String(row.last_source_etag||""),previousLastModified=String(row.last_source_modified||"");
    try{
      let observed=await fetchSourcePage(url,previousEtag,previousLastModified),decision=classifySourcePage({...observed,originalUrl:url,previousEtag,previousLastModified});
      if(decision.status==="Temporarily Unreachable"){observed=await fetchSourcePage(url,previousEtag,previousLastModified);decision=classifySourcePage({...observed,originalUrl:url,previousEtag,previousLastModified});}
      let refreshOk=true;
      if((decision.contentChanged||wasRemoved)&&!["Removed","Unavailable","Temporarily Unreachable"].includes(decision.status)){const refreshed=await refreshTrackedArticle(articleId,run.id);refreshOk=refreshed.ok;if(!refreshOk)errors.push(`${articleId}: ${"error" in refreshed?refreshed.error:"article_refresh_failed"}`);}
      const result=recordArticleSourceCheck({articleId,sourceId,status:decision.status,httpStatus:observed.httpStatus,reason:decision.reason,finalUrl:observed.finalUrl,contentChanged:decision.contentChanged,sourceUpdatedAt:decision.sourceUpdatedAt,etag:observed.etag,lastModified:observed.lastModified,restorePublication:refreshOk});
      counts.checked++;if(decision.status==="Removed")counts.removed++;else if(decision.status==="Updated")counts.updated++;else if(decision.status==="Redirected")counts.redirected++;else if(decision.status==="Unavailable"||decision.status==="Temporarily Unreachable")counts.temporary++;else counts.active++;if(result.restored)counts.restored++;
    }catch(error){counts.failed++;errors.push(`${articleId}: ${error instanceof Error?error.message:String(error)}`);}
  }));
  if(counts.removed||counts.restored||counts.updated)prepareHomepageSnapshot();
  finishRun(run.id,{processed:counts.checked,failed:counts.failed,sourcesProcessed:new Set(rows.map((row)=>String(row.source_id))).size,known:counts.active+counts.redirected,published:counts.restored,rejected:counts.removed},errors.join(" | "));
  return {id:run.id,breakingOnly,...counts,errors};
}
