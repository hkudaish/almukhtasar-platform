import Header from "@/components/Header";
import Footer from "@/components/Footer";
import CategoryNewsRow from "@/components/CategoryNewsRow";
import Pagination from "@/components/Pagination";
import ArchivePeriodFilter from "@/components/ArchivePeriodFilter";
import { archiveFacets, getSettings, listArchivedArticles, type ArchivePeriodScope } from "@/database/database";
import type { Metadata } from "next";

export const dynamic="force-dynamic";
export const metadata:Metadata={title:"أرشيف الأخبار",description:"أرشيف المختصر للأخبار المنشورة، مرتب حسب تاريخ المصدر الأصلي.",alternates:{canonical:"/archive"}};
export default async function ArchivePage({searchParams}:{searchParams:Promise<{page?:string;scope?:string;date?:string}>}){const query=await searchParams,page=Math.max(1,Number(query.page)||1),scope=(["all","year","day","week","month"].includes(String(query.scope))?query.scope:"all") as ArchivePeriodScope,date=String(query.date||""),settings=getSettings(),facets=archiveFacets().map((item)=>({year:String(item.year),month:String(item.month),day:String(item.day),count:Number(item.count)})),result=listArchivedArticles(page,20,{scope,date}),filterSuffix=`${scope!=="all"?`&scope=${scope}`:""}${date?`&date=${encodeURIComponent(date)}`:""}`;return <><Header homepage/><main id="main-content" className="listing-page showcase-page"><div className="container showcase-content"><header className="showcase-heading"><span aria-hidden="true">▤</span><div><h1>أرشيف الأخبار</h1><p>الأخبار السابقة مرتبة حسب تاريخ النشر الأصلي من الأحدث إلى الأقدم</p></div></header><ArchivePeriodFilter facets={facets}/><section className="article-card-grid" aria-label="أرشيف الأخبار">{result.data.length?result.data.map((article,index)=><CategoryNewsRow key={article.id} article={article} index={index} timezone={settings.timezone} variant="grid"/>):<p className="empty-section">لا توجد أخبار مؤرشفة في الفترة المحددة.</p>}</section><Pagination page={page} pages={result.pages} href={(target)=>`/archive?page=${target}${filterSuffix}`}/></div></main><Footer/></>;}
