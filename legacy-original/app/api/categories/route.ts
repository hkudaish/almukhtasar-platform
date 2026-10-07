import { NextResponse } from "next/server"; import { categories, stories } from "@/lib/data";
export async function GET() { return NextResponse.json({ data: categories.slice(1).map((name) => ({ name, slug: encodeURIComponent(name), articleCount: stories.filter((story) => story.category === name).length })) }); }
