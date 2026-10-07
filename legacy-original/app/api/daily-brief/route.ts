import { NextResponse } from "next/server"; import { brief } from "@/lib/data";
export async function GET() { return NextResponse.json({ data: { date: "2026-07-14", readingTimeSeconds: 90, items: brief }, meta: { reviewed: true, language: "ar" } }); }
