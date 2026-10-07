import type { Metadata } from "next";
import Link from "next/link";
import { Archive, CalendarDays, ChevronLeft, FolderOpen } from "lucide-react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import Breadcrumbs from "@/components/Breadcrumbs";
import { archivePath, getArchiveDays, getArchiveMonths, getArchiveYears, monthLabel } from "@/lib/archive";
import { getPublishedImportedStories } from "@/lib/public-content";

export const dynamic="force-dynamic";

export const metadata: Metadata = {
  title: "أرشيف الأخبار | المختصر",
  description: "تصفح أخبار المختصر حسب السنة والشهر واليوم والتصنيف.",
  alternates: { canonical: "/archive" }
};

export default function ArchivePage() {
  const stories=getPublishedImportedStories(100),years = getArchiveYears(stories);
  return <><Header/><main id="main-content" className="archive-page"><div className="container">
    <Breadcrumbs items={[{ label:"الرئيسية", href:"/" }, { label:"أرشيف الأخبار", href:"/archive", current:true }]}/>
    <header className="archive-hero"><span><Archive/></span><div><small>كل التغطيات في مكان واحد</small><h1>أرشيف الأخبار</h1><p>اختر سنة، ثم شهرًا ويومًا، للوصول إلى الأخبار والتصنيفات المنشورة في ذلك التاريخ.</p></div></header>
    <section className="archive-section"><div className="archive-section-head"><div><span className="eyebrow">حسب السنة</span><h2>استعرض الأعوام</h2></div><strong>{stories.length} أخبار مؤرشفة</strong></div>
      <div className="archive-years">{years.map((year)=><Link href={archivePath(year)} key={year}><span className="archive-year-icon"><FolderOpen/></span><div><strong>{year}</strong><small>{getArchiveMonths(year,stories).length} أشهر · {getArchiveMonths(year,stories).reduce((total,month)=>total+getArchiveDays(year,month,stories).length,0)} أيام نشر</small></div><ChevronLeft/></Link>)}</div>
    </section>
    {years[0] && <section className="archive-section"><div className="archive-section-head"><div><span className="eyebrow">وصول سريع</span><h2>أحدث الأشهر</h2></div></div><div className="archive-month-grid">{getArchiveMonths(years[0],stories).map((month)=><Link href={archivePath(years[0],month)} key={month}><CalendarDays/><div><strong>{monthLabel(years[0],month)}</strong><small>{getArchiveDays(years[0],month,stories).length} أيام تتضمن أخبارًا</small></div><ChevronLeft/></Link>)}</div></section>}
  </div></main><Footer/></>;
}
