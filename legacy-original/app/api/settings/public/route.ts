import { NextResponse } from "next/server";
import { getSettings } from "@/lib/admin-db";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export async function GET(){const allowed=new Set(["general","appearance","homepage","light_version"]);const data=Object.fromEntries(getSettings().filter(item=>allowed.has(String(item.section))).map(item=>[item.section,item.value]));return NextResponse.json({data},{headers:{"Cache-Control":"public, max-age=60, stale-while-revalidate=300"}});}
