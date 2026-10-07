import type { Metadata } from "next";
import Link from "next/link";
import { Calendar, ChevronLeft, Newspaper } from "lucide-react";
import { notFound } from "next/navigation";
import Header from "@/components/Header"; import Footer from "@/components/Footer"; import Breadcrumbs from "@/components/Breadcrumbs";
import { archivePath, dayLabel, getArchiveDays, getArchiveMonths, getArchiveYears, getStoriesByDate, groupStoriesByCategory, monthLabel } from "@/lib/archive";
import { getPublishedImportedStories } from "@/lib/public-content";

export const dynamic="force-dynamic";

export function generateStaticParams(){const stories=getPublishedImportedStories(100);return getArchiveYears(stories).flatMap((year)=>getArchiveMonths(year,stories).map((month)=>({year:String(year),month:String(month).padStart(2,"0")})));}
export async function generateMetadata({params}:{params:Promise<{year:string;month:string}>}):Promise<Metadata>{const {year:rawYear,month:rawMonth}=await params;const year=Number(rawYear),month=Number(rawMonth);return {title:`أرشيف ${monthLabel(year,month)} | المختصر`,description:`الأخبار المنشورة في ${monthLabel(year,month)} مرتبة حسب اليوم.`,alternates:{canonical:archivePath(year,month)}};}
export default async function ArchiveMonthPage({params}:{params:Promise<{year:string;month:string}>}){const {year:rawYear,month:rawMonth}=await params;const year=Number(rawYear),month=Number(rawMonth),stories=getPublishedImportedStories(100),days=getArchiveDays(year,month,stories);if(!days.length)notFound();return <><Header/><main id="main-content" className="archive-page"><div className="container">
  <Breadcrumbs items={[{label:"الرئيسية",href:"/"},{label:"أرشيف الأخبار",href:"/archive"},{label:String(year),href:archivePath(year)},{label:monthLabel(year,month),href:archivePath(year,month),current:true}]}/>
  <header className="archive-title"><span className="eyebrow">أرشيف الشهر</span><h1>{monthLabel(year,month)}</h1><p>اختر يومًا لعرض التصنيفات والأخبار التي نُشرت خلاله.</p></header>
  <div className="archive-days">{days.map((day)=>{const items=getStoriesByDate(year,month,day,stories);const categories=Object.keys(groupStoriesByCategory(items));return <Link href={archivePath(year,month,day)} key={day}><div className="archive-day-number"><Calendar/><strong>{day}</strong><small>{dayLabel(month,day)}</small></div><div className="archive-day-summary"><strong>{items.length} أخبار منشورة</strong><div>{categories.map((category)=><span key={category}>{category}</span>)}</div></div><span className="archive-open">فتح اليوم <ChevronLeft/></span></Link>})}</div>
  <div className="archive-note"><Newspaper/><p>تظهر فقط الأيام التي نُشر فيها محتوى. جميع الأخبار مرتبة داخل يومها حسب التصنيف.</p></div>
 </div></main><Footer/></>}
