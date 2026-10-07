"use client";

import { Search, SlidersHorizontal, TrendingUp } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import StoryCard from "@/components/StoryCard";
import { categories, trendingTopics } from "@/lib/data";
import type { Story } from "@/lib/data";

export default function SearchPage() {
  return <Suspense fallback={<div className="search-page"><div className="container empty-state">جارٍ تجهيز البحث...</div></div>}><SearchContent /></Suspense>;
}

function SearchContent() {
  const params = useSearchParams();
  const [query, setQuery] = useState(params.get("q") || "");
  const [category, setCategory] = useState(params.get("category") || "الكل");
  const [stories,setStories]=useState<Story[]>([]);
  useEffect(()=>{fetch("/api/articles?limit=50").then((response)=>response.ok?response.json():null).then((result)=>{if(result?.data)setStories(result.data)}).catch(()=>undefined)},[]);
  const normalized=query.trim().toLocaleLowerCase("ar");
  const results=stories.filter((story)=>(category==="الكل"||story.category===category)&&(!normalized||[story.title,story.summary,story.category,story.source,...story.tags].join(" ").toLocaleLowerCase("ar").includes(normalized)));
  return <><Header/><main id="main-content" className="search-page"><div className="container">
    <div className="page-title"><span className="eyebrow">ابحث في المختصر</span><h1>وصل إلى المعلومة بسرعة</h1><p>ابحث في العناوين والملخصات والمصادر والوسوم.</p></div>
    <div className="search-box"><Search/><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="مثال: الذكاء الاصطناعي أو حماية الحسابات" autoFocus/><button>بحث</button></div>
    <div className="search-controls"><span><SlidersHorizontal size={17}/> تصفية:</span><button className={category === "الكل" ? "active" : ""} onClick={() => setCategory("الكل")}>الكل</button>{categories.slice(1).map((item) => <button className={category === item ? "active" : ""} onClick={() => setCategory(item)} key={item}>{item}</button>)}</div>
    {!query && <div className="suggestions"><strong><TrendingUp size={17}/> موضوعات مقترحة</strong>{trendingTopics.map((item) => <button key={item} onClick={() => setQuery(item)}>{item}</button>)}</div>}
    <div className="results-head"><h2>{query ? `نتائج البحث عن «${query}»` : "أحدث الأخبار"}</h2><span>{results.length} نتيجة</span></div>
    {results.length ? <div className="cards-grid">{results.map((story) => <StoryCard story={story} key={story.id}/>)}</div> : <div className="empty-state"><Search size={38}/><h2>لم نجد نتائج مطابقة</h2><p>جرّب كلمة أقصر أو اختر تصنيفًا آخر.</p><button onClick={() => { setQuery(""); setCategory("الكل"); }}>مسح عوامل البحث</button></div>}
  </div></main><Footer/></>;
}
