import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import Breadcrumbs from "@/components/Breadcrumbs";
import LightNewsItem from "@/components/LightNewsItem";
import { getPublishedImportedStoriesByCategory } from "@/lib/public-content";
import { getLightVersionSettings } from "@/lib/light-version";
import { redirect } from "next/navigation";

export const dynamic="force-dynamic";

export async function generateMetadata({params}:{params:Promise<{slug:string}>}):Promise<Metadata>{
  const {slug}=await params,name=decodeURIComponent(slug);
  return {title:`${name} | النسخة الخفيفة | المختصر`,description:`أحدث أخبار ${name} في قائمة خفيفة وسريعة.`};
}

export default async function LightCategoryPage({params,searchParams}:{params:Promise<{slug:string}>;searchParams:Promise<{page?:string;sub?:string}>}){
  const settings=getLightVersionSettings();
  if(!settings.enabled)redirect("/");
  const {slug}=await params,{page:pageValue,sub:subValue}=await searchParams;
  const name=decodeURIComponent(slug),page=Math.max(1,Number(pageValue)||1),all=getPublishedImportedStoriesByCategory(name,100);
  const subcategory=String(subValue||""),subcategories=[...new Set(all.map((story)=>story.subcategory).filter((value):value is string=>Boolean(value)))];
  const filtered=subcategory?all.filter((story)=>story.subcategory===subcategory):all;
  const start=(page-1)*settings.pageSize,visible=filtered.slice(start,start+settings.pageSize),pages=Math.max(1,Math.ceil(filtered.length/settings.pageSize));
  const pageHref=(target:number)=>`/light/category/${encodeURIComponent(name)}?page=${target}${subcategory?`&sub=${encodeURIComponent(subcategory)}`:""}`;
  return <>
    <Header/>
    <main id="main-content" className="light-page light-category-page">
      <div className="container light-shell">
        <Breadcrumbs items={[{label:"النسخة الخفيفة",href:"/light"},{label:name,href:`/light/category/${encodeURIComponent(name)}`,current:true}]}/>
        <header className="light-category-title"><span>تصنيف</span><h1>{name}</h1><p>{filtered.length} خبرًا منشورًا وموثّقًا، مرتبة حسب تاريخ النشر الأصلي.</p></header>
        {subcategories.length?<nav className="light-subcategories" aria-label="التصنيفات الفرعية">
          <Link className={!subcategory?"active":""} href={`/light/category/${encodeURIComponent(name)}`}>الكل</Link>
          {subcategories.map((sub)=><Link className={subcategory===sub?"active":""} key={sub} href={`/light/category/${encodeURIComponent(name)}?sub=${encodeURIComponent(sub)}`}>{sub}</Link>)}
        </nav>:null}
        <section className="light-category light-category-list" aria-label={`أخبار ${name}`}>
          <div>{visible.map((story,index)=><LightNewsItem key={story.id} story={story} index={index} mobileLimit={settings.pageSize} showTime={settings.showTime} showBadges={settings.showBadges}/>)}</div>
        </section>
        {pages>1?<nav className="light-pagination" aria-label="صفحات الأخبار">
          {page>1?<Link href={pageHref(page-1)}><ChevronRight size={16}/> السابق</Link>:<span/>}
          <b>صفحة {Math.min(page,pages)} من {pages}</b>
          {page<pages?<Link href={pageHref(page+1)}>التالي <ChevronLeft size={16}/></Link>:<span/>}
        </nav>:null}
      </div>
    </main>
    <Footer/>
  </>;
}
