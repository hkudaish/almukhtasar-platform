import { NextResponse } from "next/server";
import { setArticlePublicationStatus, updateArticleEditorial } from "@/database/database";
import { requireAdmin } from "@/lib/admin-auth";

export async function PATCH(request:Request,{params}:{params:Promise<{id:string}>}){
  const access=requireAdmin(request);if(!access.ok)return access.response;
  try{const body=await request.json(),id=(await params).id;let result:{ok:boolean;error?:string}={ok:true};if(body.status!==undefined){const status=String(body.status);if(!["published","review","rejected"].includes(status))return NextResponse.json({error:"invalid_status"},{status:400});result=setArticlePublicationStatus(id,status as "published"|"review"|"rejected");}
    const editorial:Record<string,unknown>={};for(const key of ["category","subcategory","region","importanceLevel","homepagePinned","homepageExcluded"])if(body[key]!==undefined)editorial[key]=body[key];
    if(body.manualPriorityOverride!==undefined){const score=body.manualPriorityOverride===null||body.manualPriorityOverride===""?null:Number(body.manualPriorityOverride);if(score!==null&&(!Number.isFinite(score)||score<0||score>100))return NextResponse.json({error:"invalid_priority_override"},{status:400});editorial.manualPriorityOverride=score;}
    if(Object.keys(editorial).length)result=updateArticleEditorial(id,editorial);if(body.status===undefined&&!Object.keys(editorial).length)return NextResponse.json({error:"no_changes"},{status:400});return NextResponse.json(result,{status:result.ok?200:400});
  }catch{return NextResponse.json({error:"invalid_request"},{status:400});}
}
