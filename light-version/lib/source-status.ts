export type SourcePageStatus="Active"|"Updated"|"Removed"|"Unavailable"|"Redirected"|"Temporarily Unreachable";

export type SourcePageObservation={
  httpStatus:number|null;
  originalUrl:string;
  finalUrl:string;
  html?:string;
  etag?:string;
  lastModified?:string;
  previousEtag?:string;
  previousLastModified?:string;
  networkError?:string;
};

export type SourcePageDecision={status:SourcePageStatus;reason:string;contentChanged:boolean;sourceUpdatedAt:string|null};

function explicitRemovalPage(html:string){
  const title=html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.replace(/<[^>]+>/g," ").replace(/\s+/g," ").trim()||"";
  const marker=html.match(/<(?:h1|main)[^>]*>([\s\S]{0,700}?)<\/(?:h1|main)>/i)?.[1]?.replace(/<[^>]+>/g," ").replace(/\s+/g," ").trim()||"";
  return /(?:404|410|page\s+not\s+found|content\s+(?:was\s+)?removed|article\s+(?:was\s+)?removed|الصفحة\s+غير\s+موجودة|الصفحة\s+المطلوبة\s+غير\s+موجودة|تم\s+حذف\s+(?:الخبر|المحتوى)|هذا\s+الخبر\s+غير\s+متاح)/iu.test(`${title} ${marker}`);
}

export function classifySourcePage(input:SourcePageObservation):SourcePageDecision{
  if(input.networkError)return {status:"Temporarily Unreachable",reason:`temporary_network_error: ${input.networkError}`,contentChanged:false,sourceUpdatedAt:null};
  const code=input.httpStatus||0;
  if(code===404||code===410)return {status:"Removed",reason:`source_confirmed_removed_http_${code}`,contentChanged:false,sourceUpdatedAt:null};
  if(code===429||code>=500)return {status:"Temporarily Unreachable",reason:`temporary_http_${code}`,contentChanged:false,sourceUpdatedAt:null};
  if(code===401||code===403||(code>=400&&code<500))return {status:"Unavailable",reason:`source_access_unavailable_http_${code}`,contentChanged:false,sourceUpdatedAt:null};
  if(code<200||code>=400)return {status:"Temporarily Unreachable",reason:`unexpected_http_${code||"none"}`,contentChanged:false,sourceUpdatedAt:null};
  if(explicitRemovalPage(input.html||""))return {status:"Removed",reason:"source_page_explicitly_reports_removal",contentChanged:false,sourceUpdatedAt:null};
  const etagChanged=Boolean(input.previousEtag&&input.etag&&input.previousEtag!==input.etag),modifiedChanged=Boolean(input.previousLastModified&&input.lastModified&&input.previousLastModified!==input.lastModified),contentChanged=etagChanged||modifiedChanged;
  const redirected=Boolean(input.finalUrl&&input.originalUrl&&input.finalUrl!==input.originalUrl);
  return {status:contentChanged?"Updated":redirected?"Redirected":"Active",reason:contentChanged?"source_content_changed":redirected?"source_redirect_followed":"source_article_available",contentChanged,sourceUpdatedAt:input.lastModified||null};
}
