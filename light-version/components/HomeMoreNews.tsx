"use client";

import { useState } from "react";
import Link from "next/link";
import { HomeGridCard } from "@/components/HomeNewsCard";
import type { Article } from "@/types/news";

type Cursor={sourcePublishedAt:string;id:string};
type MoreNewsResponse={data:Article[];hasMore:boolean;nextCursor:Cursor|null};

export default function HomeMoreNews({initialArticles,initialCursor,timezone}:{initialArticles:Article[];initialCursor:Cursor|null;timezone:string}){
  const [articles,setArticles]=useState(initialArticles),[cursor,setCursor]=useState<Cursor|null>(initialCursor),[hasMore,setHasMore]=useState(true),[loading,setLoading]=useState(false);
  async function loadMore(){
    if(loading||!hasMore)return;
    setLoading(true);
    try{
      const query=cursor?`?publishedAt=${encodeURIComponent(cursor.sourcePublishedAt)}&id=${encodeURIComponent(cursor.id)}`:"";
      const response=await fetch(`/api/news/more${query}`,{cache:"no-store"});
      if(!response.ok)throw new Error("Unable to load more news");
      const next=await response.json() as MoreNewsResponse;
      const known=new Set(articles.map((article)=>article.id));
      const unique=next.data.filter((article)=>!known.has(article.id));
      setArticles((current)=>[...current,...unique]);
      setCursor(next.nextCursor);
      setHasMore(next.hasMore);
    }catch{
      // Keep the control available so a temporary network failure can be retried.
    }finally{setLoading(false);}
  }
  return <><div className="home-news-grid">{articles.map((article,index)=><HomeGridCard key={article.id} article={article} index={index} timezone={timezone}/>)}</div>
    {hasMore?<button type="button" className="home-more-link" onClick={loadMore} disabled={loading}>{loading?<><i className="more-spinner" aria-hidden="true"/>جارٍ تحميل الأخبار…</>:<><small>اكتشف المزيد</small><b>المزيد من الأخبار</b><span aria-hidden="true">↓</span></>}</button>:<Link className="home-more-link" href="/archive"><small>تصفح الأخبار السابقة</small><b>عرض الأرشيف</b><span aria-hidden="true">←</span></Link>}
  </>;
}
