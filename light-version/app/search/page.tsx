import Header from "@/components/Header";
import Footer from "@/components/Footer";
import CategoryNewsRow from "@/components/CategoryNewsRow";
import Pagination from "@/components/Pagination";
import { getSettings, listCurrentArticles, searchArticles } from "@/database/database";
import type { Metadata } from "next";

export const dynamic="force-dynamic";
export const metadata:Metadata={robots:{index:false,follow:true}};
export default async function SearchPage({searchParams}:{searchParams:Promise<{q?:string;page?:string}>}){const query=await searchParams,q=String(query.q||"").trim(),page=Math.max(1,Number(query.page)||1),settings=getSettings(),result=q?searchArticles(q,page,20):listCurrentArticles(page,20);return <><Header homepage/><main id="main-content" className="listing-page showcase-page"><div className="container showcase-content"><header className="showcase-heading"><span aria-hidden="true">▤</span><div><h1>{q?"نتائج البحث":"جميع الأخبار"}</h1><p>{q?`نتائج لعبارة «${q}»`:"نشر كل الأخبار المضافة مرتبة من الأحدث إلى الأقدم"}</p></div></header><form className="showcase-search"><input name="q" defaultValue={q} placeholder="اكتب عنوانًا أو تصنيفًا أو مصدرًا…"/><button>بحث</button></form><section className="article-card-grid" aria-label="آخر الأخبار">{result.data.length?result.data.map((article,index)=><CategoryNewsRow key={article.id} article={article} index={index} timezone={settings.timezone} variant="grid"/>):<p className="empty-section">لا توجد أخبار مطابقة.</p>}</section><Pagination page={page} pages={result.pages} href={(target)=>`/search?q=${encodeURIComponent(q)}&page=${target}`}/></div></main><Footer/></>;}
