"use client";

import { useEffect, useRef } from "react";

export default function ArticleAd(){
  const publisher=process.env.NEXT_PUBLIC_ADSENSE_PUBLISHER_ID,slot=process.env.NEXT_PUBLIC_ADSENSE_ARTICLE_SLOT_ID,ref=useRef<HTMLModElement>(null);
  useEffect(()=>{if(!publisher||!slot||!ref.current?.dataset.loaded){try{if(ref.current)ref.current.dataset.loaded="true";(window.adsbygoogle=window.adsbygoogle||[]).push({});}catch{}}},[publisher,slot]);
  if(!publisher||!slot)return null;
  return <aside className="article-ad" aria-label="إعلان"><small>إعلان</small><ins ref={ref} className="adsbygoogle" style={{display:"block"}} data-ad-client={publisher} data-ad-slot={slot} data-ad-format="auto" data-full-width-responsive="true"/></aside>;
}
