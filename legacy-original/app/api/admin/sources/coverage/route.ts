import { NextResponse } from "next/server";
import { listRecords } from "@/lib/admin-db";
import { APPROVED_CATEGORY_SOURCES, NEWS_CATEGORIES } from "@/lib/source-policy";

export const runtime="nodejs";
function hasWebsiteConnector(value:unknown){const method=String(value||"");return method.includes("موقع")||method.includes("صفحة أخبار رسمية");}

export async function GET(){
  const sources=listRecords("sources",{limit:100}).data;
  const data=NEWS_CATEGORIES.map((category)=>{
    const approvedNames=APPROVED_CATEGORY_SOURCES[category];
    const records=sources.filter((source)=>approvedNames.includes(source.title)||String(source.data.categories||"").split(/[،,\n]+/).map((value)=>value.trim()).includes(category));
    const eligible=records.filter((source)=>source?.status==="نشط"&&source.data.approved===true&&source.data.verificationStatus==="معتمد"&&Number(source.data.trust)>=80);
    const connected=eligible.filter((source)=>Boolean(source?.data.feedUrl||source?.data.apiUrl||(hasWebsiteConnector(source?.data.fetchMethod)&&source?.data.url)));
    return {category,approved:approvedNames.length,eligible:eligible.length,connected:connected.length,sources:records.map((source)=>({name:source!.title,status:source!.status,trust:Number(source!.data.trust)||0,connected:Boolean(source!.data.feedUrl||source!.data.apiUrl||(hasWebsiteConnector(source!.data.fetchMethod)&&source!.data.url))}))};
  });
  return NextResponse.json({data,meta:{complete:data.every((item)=>item.eligible>0&&item.connected>0)}});
}
