import type { Metadata } from "next";
import Link from "next/link";
import { CalendarDays, ChevronLeft } from "lucide-react";
import { notFound } from "next/navigation";
import Header from "@/components/Header"; import Footer from "@/components/Footer"; import Breadcrumbs from "@/components/Breadcrumbs";
import { archivePath, getArchiveDays, getArchiveMonths, getArchiveYears, monthLabel } from "@/lib/archive";
import { getPublishedImportedStories } from "@/lib/public-content";

export const dynamic="force-dynamic";

export function generateStaticParams(){return getArchiveYears(getPublishedImportedStories(100)).map((year)=>({year:String(year)}));}
export async function generateMetadata({params}:{params:Promise<{year:string}>}):Promise<Metadata>{const {year}=await params;return {title:`أرشيف أخبار ${year} | المختصر`,description:`تصفح أخبار المختصر المنشورة خلال عام ${year}.`,alternates:{canonical:`/archive/${year}`}};}
export default async function ArchiveYearPage({params}:{params:Promise<{year:string}>}){const {year:raw}=await params;const year=Number(raw),stories=getPublishedImportedStories(100),months=getArchiveMonths(year,stories);if(!months.length)notFound();return <><Header/><main id="main-content" className="archive-page"><div className="container">
  <Breadcrumbs items={[{label:"الرئيسية",href:"/"},{label:"أرشيف الأخبار",href:"/archive"},{label:String(year),href:archivePath(year),current:true}]}/>
  <header className="archive-title"><span className="eyebrow">أرشيف السنة</span><h1>أخبار عام {year}</h1><p>اختر شهرًا لعرض أيام النشر والتصنيفات والأخبار.</p></header>
  <div className="archive-month-grid large">{months.map((month)=>{const count=stories.filter((story)=>story.publishedAt.startsWith(`${year}-${String(month).padStart(2,"0")}`)).length;return <Link href={archivePath(year,month)} key={month}><CalendarDays/><div><strong>{monthLabel(year,month)}</strong><small>{count} أخبار · {getArchiveDays(year,month,stories).length} أيام نشر</small></div><ChevronLeft/></Link>})}</div>
 </div></main><Footer/></>}
