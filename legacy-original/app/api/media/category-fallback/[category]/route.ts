import { NextResponse } from "next/server";
import { NEWS_CATEGORIES } from "@/lib/source-policy";

const palette:Record<string,[string,string]>={
  "السياسة":["#17324d","#315f7d"],"الاقتصاد":["#25386b","#1f7a75"],"المجتمع":["#713f5b","#b76e79"],
  "الرياضة":["#7f1d3f","#d14d72"],"التقنية":["#17364d","#28708c"],"الذكاء الاصطناعي":["#312e81","#0e7490"],
  "الصحة والجمال":["#16624a","#49a078"],"الثقافة":["#78350f","#c46b2d"],"السيارات":["#273444","#64748b"],
  "السفر":["#075985","#38bdf8"],"التعليم":["#3730a3","#4f8edc"]
};

function escapeXml(value:string){return value.replace(/[<>&"']/g,(character)=>({"<":"&lt;",">":"&gt;","&":"&amp;",'"':"&quot;","'":"&apos;"}[character]||character));}

export async function GET(_:Request,{params}:{params:Promise<{category:string}>}){
  const requested=decodeURIComponent((await params).category),category=NEWS_CATEGORIES.includes(requested as never)?requested:"عام";
  const [start,end]=palette[category]||["#17364d","#28708c"],label=escapeXml(category);
  const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="675" viewBox="0 0 1200 675" role="img" aria-label="صورة افتراضية لتصنيف ${label}"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop stop-color="${start}"/><stop offset="1" stop-color="${end}"/></linearGradient></defs><rect width="1200" height="675" fill="url(#g)"/><circle cx="1040" cy="120" r="220" fill="#fff" opacity=".06"/><circle cx="170" cy="610" r="270" fill="#fff" opacity=".05"/><text x="600" y="310" text-anchor="middle" fill="#fff" font-family="Arial,sans-serif" font-size="72" font-weight="700">المختصر</text><text x="600" y="395" text-anchor="middle" fill="#fff" opacity=".82" font-family="Arial,sans-serif" font-size="38">${label}</text><text x="600" y="605" text-anchor="middle" fill="#fff" opacity=".58" font-family="Arial,sans-serif" font-size="22">صورة تصنيف افتراضية</text></svg>`;
  return new NextResponse(svg,{headers:{"Content-Type":"image/svg+xml; charset=utf-8","Cache-Control":"public, max-age=86400, stale-while-revalidate=604800","X-Content-Type-Options":"nosniff"}});
}
