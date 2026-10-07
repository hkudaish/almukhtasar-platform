import { NextRequest, NextResponse } from "next/server";
import { createPhysicalBackup, createRecord, isAdminResource, listRecords } from "@/lib/admin-db";
import { revalidatePath } from "next/cache";
import { recoverHomepageContent } from "@/lib/homepage-recovery";
export const runtime = "nodejs";

export async function GET(request: NextRequest, { params }: { params: Promise<{ resource: string }> }) {
  const { resource } = await params; if (!isAdminResource(resource)) return NextResponse.json({ error:"RESOURCE_NOT_FOUND" }, { status:404 });
  const query = request.nextUrl.searchParams;
  return NextResponse.json(listRecords(resource, { search:query.get("q") || "", status:query.get("status") || "", page:Number(query.get("page")) || 1, limit:Number(query.get("limit")) || 20, deleted:query.get("deleted") === "true" }));
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ resource: string }> }) {
  const { resource } = await params; if (!isAdminResource(resource)) return NextResponse.json({ error:"RESOURCE_NOT_FOUND" }, { status:404 });
  try { const body = await request.json(); if (typeof body.title !== "string" || body.title.trim().length < 2) return NextResponse.json({ error:"VALIDATION_ERROR", fields:{title:"العنوان مطلوب"} }, { status:400 });
    const actor=request.headers.get("x-admin-user") || "مدير النظام";
    let data=body.data&&typeof body.data==="object"?body.data:{};
    if(resource==="sources"){
      let officialDomain="";try{officialDomain=new URL(String(data.url||"")).hostname.replace(/^www\./,"");}catch{officialDomain="";}
      data={...data,approved:data.approved!==false,verificationStatus:String(data.verificationStatus||"معتمد"),officialDomain:String(data.officialDomain||officialDomain),copyrightMode:String(data.copyrightMode||"ملخص أصلي ورابط المصدر"),mediaPolicy:String(data.mediaPolicy||"استخدام صور التغذية مع الإسناد")};
    }
    const record=resource==="backups"?createPhysicalBackup(body.title.trim(),data.type||"قاعدة البيانات",actor):createRecord(resource, { title:body.title.trim(), status:body.status, data }, actor);
    if(resource==="content"){recoverHomepageContent("post_created");revalidatePath("/");revalidatePath("/search");}
    return NextResponse.json({ data:record }, { status:201 });
  } catch { return NextResponse.json({ error:"INVALID_BODY" }, { status:400 }); }
}
