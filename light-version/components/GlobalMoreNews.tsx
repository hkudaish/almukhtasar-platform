"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { HomeGridCard } from "@/components/HomeNewsCard";
import type { Article } from "@/types/news";

type Cursor={sourcePublishedAt:string;id:string};
type Result={data:Article[];hasMore:boolean;nextCursor:Cursor|null};

export default function GlobalMoreNews(){
  const [available,setAvailable]=useState(false),[open,setOpen]=useState(false),[loading,setLoading]=useState(false),[articles,setArticles]=useState<Article[]>([]),[cursor,setCursor]=useState<Cursor|null>(null),[hasMore,setHasMore]=useState(true);
  useEffect(()=>{fetch("/api/news/more?limit=1",{cache:"no-store"}).then((response)=>response.ok?response.json():null).then((result:Result|null)=>setAvailable(Boolean(result?.data.length))).catch(()=>setAvailable(false));},[]);
  async function loadMore(initial=false){
    if(loading||(!initial&&!hasMore))return;
    setLoading(true);
    try{const query=initial?"?limit=12":cursor?`?limit=12&publishedAt=${encodeURIComponent(cursor.sourcePublishedAt)}&id=${encodeURIComponent(cursor.id)}`:"?limit=12",response=await fetch(`/api/news/more${query}`,{cache:"no-store"});if(!response.ok)throw new Error("load_failed");const result=await response.json() as Result;setArticles((current)=>initial?result.data:[...current,...result.data.filter((article)=>!current.some((known)=>known.id===article.id))]);setCursor(result.nextCursor);setHasMore(result.hasMore);setAvailable(Boolean(result.data.length)||!initial);}catch{}finally{setLoading(false);}}
  function show(){setOpen(true);if(!articles.length)void loadMore(true);}
  if(!available)return null;
  return <><button className="global-more-news" type="button" onClick={show}><span aria-hidden="true">＋</span><b>المزيد من الأخبار</b><small>آخر 7 أيام</small></button>{open?<div className="more-news-overlay" role="dialog" aria-modal="true" aria-label="المزيد من الأخبار"><div className="more-news-sheet"><header><div><small>آخر 7 أيام</small><h2>المزيد من الأخبار</h2></div><button type="button" onClick={()=>setOpen(false)} aria-label="إغلاق">×</button></header>{articles.length?<div className="more-news-grid">{articles.map((article,index)=><HomeGridCard key={article.id} article={article} index={index} timezone="Asia/Riyadh"/>)}</div>:<p className="empty-section">{loading?"جارٍ تحميل الأخبار…":"لا توجد أخبار إضافية."}</p>}{hasMore?<button type="button" className="more-news-load" onClick={()=>loadMore()} disabled={loading}>{loading?"جارٍ التحميل…":"تحميل المزيد"}</button>:<Link className="more-news-archive" href="/archive" onClick={()=>setOpen(false)}>عرض الأرشيف الكامل ←</Link>}</div></div>:null}</>;
}
