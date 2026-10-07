"use client";

import { Bookmark } from "lucide-react";
import { useEffect, useState } from "react";
import Link from "next/link";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import StoryCard from "@/components/StoryCard";
import { stories } from "@/lib/data";
import type { Story } from "@/lib/data";

export default function SavedPage() {
  const [ids, setIds] = useState<string[]>([]);
  const [availableStories,setAvailableStories]=useState<Story[]>(stories);
  useEffect(() => {
    const load = () => setIds(JSON.parse(localStorage.getItem("almukhtasar-saved") || "[]"));
    load();
    fetch("/api/articles?limit=50").then((response)=>response.ok?response.json():null).then((result)=>{if(result?.data)setAvailableStories(result.data)}).catch(()=>undefined);
    window.addEventListener("saved-articles-changed", load); return () => window.removeEventListener("saved-articles-changed", load);
  }, []);
  const saved = availableStories.filter((story) => ids.includes(story.id));
  return <><Header/><main id="main-content" className="search-page"><div className="container"><div className="page-title"><span className="eyebrow">للقراءة لاحقًا</span><h1>أخبارك المحفوظة</h1><p>تُحفظ اختياراتك على هذا الجهاز في النسخة التجريبية.</p></div>{saved.length ? <div className="cards-grid">{saved.map((story) => <StoryCard story={story} key={story.id}/>)}</div> : <div className="empty-state"><Bookmark size={40}/><h2>لا توجد أخبار محفوظة بعد</h2><p>اضغط رمز الحفظ في أي بطاقة لتعود إليها هنا.</p><Link className="primary-btn" href="/search">استكشف الأخبار</Link></div>}</div></main><Footer/></>;
}
