import Link from "next/link";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import Breadcrumbs from "@/components/Breadcrumbs";
import ArchiveListing from "@/features/archive/ArchiveListing";
import { archiveArticles, archiveFacets, getSettings } from "@/database/database";

export const dynamic="force-dynamic";
export default async function ArchiveYearPage({params}:{params:Promise<{year:string}>}){const {year}=await params,articles=archiveArticles(year),months=[...new Set(archiveFacets().filter((item)=>item.year===year).map((item)=>item.month))],settings=getSettings();return <><Header homepage dark/><main id="main-content" className="listing-page category-listing-page category-dark"><header className="category-page-hero"><div className="container category-page-hero-inner"><Breadcrumbs items={[{label:"الأرشيف",href:"/archive"},{label:year}]}/><span className="category-page-kicker">أرشيف السنة</span><h1>{year}</h1></div></header><div className="container category-page-content"><nav className="filters category-filters">{months.map((month)=><Link key={month} href={`/archive/${year}/${month}`}>{new Date(2026,Number(month)-1).toLocaleDateString("ar-SA",{month:"long"})}</Link>)}</nav><ArchiveListing articles={articles} timezone={settings.timezone}/></div></main><Footer/></>;}
