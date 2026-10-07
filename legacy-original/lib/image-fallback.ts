const palette:Record<string,[string,string]>={
  "السياسة":["#17324d","#315f7d"],"الاقتصاد":["#25386b","#1f7a75"],"المجتمع":["#713f5b","#b76e79"],
  "الرياضة":["#7f1d3f","#d14d72"],"التقنية":["#17364d","#28708c"],"الذكاء الاصطناعي":["#312e81","#0e7490"],
  "الصحة والجمال":["#16624a","#49a078"],"الثقافة":["#78350f","#c46b2d"],"السيارات":["#273444","#64748b"],
  "السفر":["#075985","#38bdf8"],"التعليم":["#3730a3","#4f8edc"]
};

export function categoryFallbackUrl(category:string){return `/api/media/category-fallback/${encodeURIComponent(category||"عام")}`;}

/** Last-resort image that cannot fail because it is embedded directly in the document. */
export function embeddedCategoryFallback(category:string){
  const [start,end]=palette[category]||["#17364d","#28708c"];
  const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="675" viewBox="0 0 1200 675"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop stop-color="${start}"/><stop offset="1" stop-color="${end}"/></linearGradient></defs><rect width="1200" height="675" fill="url(#g)"/><circle cx="1040" cy="120" r="220" fill="white" opacity=".06"/><circle cx="170" cy="610" r="270" fill="white" opacity=".05"/></svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}
