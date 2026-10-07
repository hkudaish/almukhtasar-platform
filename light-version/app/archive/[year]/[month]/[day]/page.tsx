import Header from "@/components/Header";
import Footer from "@/components/Footer";
import Breadcrumbs from "@/components/Breadcrumbs";
import ArchiveListing from "@/features/archive/ArchiveListing";
import { archiveArticles, getSettings } from "@/database/database";

export const dynamic="force-dynamic";
export default async function ArchiveDayPage({params,searchParams}:{params:Promise<{year:string;month:string;day:string}>;searchParams:Promise<{category?:string;subcategory?:string;source?:string;region?:string}>}){const {year,month,day}=await params,filters=await searchParams,name=new Date(Number(year),Number(month)-1,Number(day)).toLocaleDateString("ar-SA",{day:"numeric",month:"long",year:"numeric"}),articles=archiveArticles(year,month,day,filters),settings=getSettings();return <><Header homepage dark/><main id="main-content" className="listing-page category-listing-page category-dark"><header className="category-page-hero"><div className="container category-page-hero-inner"><Breadcrumbs items={[{label:"الأرشيف",href:"/archive"},{label:year,href:`/archive/${year}`},{label:month,href:`/archive/${year}/${month}`},{label:name}]}/><span className="category-page-kicker">أرشيف اليوم</span><h1>{name}</h1><p>يمكن تصفية الرابط بمعلمات category وsubcategory وsource وregion.</p></div></header><div className="container category-page-content"><ArchiveListing articles={articles} timezone={settings.timezone}/></div></main><Footer/></>;}
