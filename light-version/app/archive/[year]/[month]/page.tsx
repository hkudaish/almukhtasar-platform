import Link from "next/link";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import Breadcrumbs from "@/components/Breadcrumbs";
import ArchiveListing from "@/features/archive/ArchiveListing";
import { archiveArticles, archiveFacets, getSettings } from "@/database/database";

export const dynamic="force-dynamic";
export default async function ArchiveMonthPage({params}:{params:Promise<{year:string;month:string}>}){const {year,month}=await params,name=new Date(2026,Number(month)-1).toLocaleDateString("ar-SA",{month:"long"}),articles=archiveArticles(year,month),days=[...new Set(archiveFacets().filter((item)=>item.year===year&&item.month===month.padStart(2,"0")).map((item)=>item.day))],settings=getSettings();return <><Header homepage dark/><main id="main-content" className="listing-page category-listing-page category-dark"><header className="category-page-hero"><div className="container category-page-hero-inner"><Breadcrumbs items={[{label:"الأرشيف",href:"/archive"},{label:year,href:`/archive/${year}`},{label:name}]}/><span className="category-page-kicker">أرشيف الشهر</span><h1>{name} {year}</h1></div></header><div className="container category-page-content"><nav className="filters category-filters">{days.map((day)=><Link key={day} href={`/archive/${year}/${month}/${day}`}>{Number(day)} {name}</Link>)}</nav><ArchiveListing articles={articles} timezone={settings.timezone}/></div></main><Footer/></>;}
