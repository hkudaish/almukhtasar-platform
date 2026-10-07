import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, CalendarCheck, FolderOpen } from "lucide-react";
import { notFound } from "next/navigation";
import Header from "@/components/Header"; import Footer from "@/components/Footer"; import Breadcrumbs from "@/components/Breadcrumbs"; import StoryCard from "@/components/StoryCard";
import { archivePath, dateKey, dayLabel, getArchiveDays, getArchiveMonths, getArchiveYears, getStoriesByDate, groupStoriesByCategory, monthLabel } from "@/lib/archive";
import { getPublishedImportedStories } from "@/lib/public-content";

export const dynamic="force-dynamic";

export function generateStaticParams(){const stories=getPublishedImportedStories(100);return getArchiveYears(stories).flatMap((year)=>getArchiveMonths(year,stories).flatMap((month)=>getArchiveDays(year,month,stories).map((day)=>({year:String(year),month:String(month).padStart(2,"0"),day:String(day).padStart(2,"0")}))));}
export async function generateMetadata({params}:{params:Promise<{year:string;month:string;day:string}>}):Promise<Metadata>{const {year:ry,month:rm,day:rd}=await params;const year=Number(ry),month=Number(rm),day=Number(rd);return {title:`أخبار ${dayLabel(month,day)} ${year} | المختصر`,description:`جميع الأخبار والتصنيفات المنشورة يوم ${dayLabel(month,day)} ${year}.`,alternates:{canonical:archivePath(year,month,day)}};}
export default async function ArchiveDayPage({params}:{params:Promise<{year:string;month:string;day:string}>}){const {year:ry,month:rm,day:rd}=await params;const year=Number(ry),month=Number(rm),day=Number(rd),stories=getPublishedImportedStories(100),items=getStoriesByDate(year,month,day,stories);if(!items.length)notFound();const groups=groupStoriesByCategory(items);const key=dateKey(year,month,day);return <><Header/><main id="main-content" className="archive-page"><div className="container">
  <Breadcrumbs items={[{label:"الرئيسية",href:"/"},{label:"أرشيف الأخبار",href:"/archive"},{label:monthLabel(year,month),href:archivePath(year,month)},{label:dayLabel(month,day),href:archivePath(year,month,day),current:true}]}/>
  <header className="archive-day-hero"><span><CalendarCheck/></span><div><small>{monthLabel(year,month)}</small><h1>أخبار {dayLabel(month,day)}</h1><p>{items.length} أخبار ضمن {Object.keys(groups).length} تصنيفات نُشرت في هذا اليوم.</p></div></header>
  <nav className="archive-category-jump" aria-label="تصنيفات اليوم">{Object.keys(groups).map((category)=><a href={`#${encodeURIComponent(category)}`} key={category}>{category}<b>{groups[category].length}</b></a>)}</nav>
  <div className="archive-category-groups">{Object.entries(groups).map(([category,categoryStories])=><section id={category} key={category}><div className="archive-category-head"><div><FolderOpen/><h2>{category}</h2><span>{categoryStories.length} أخبار</span></div><Link href={`/category/${encodeURIComponent(category)}`}>صفحة التصنيف <ArrowLeft/></Link></div><div className="cards-grid">{categoryStories.map((story)=><StoryCard story={story} href={`/news/${story.id}?archive=${key}`} key={story.id}/>)}</div></section>)}</div>
 </div></main><Footer/></>}
