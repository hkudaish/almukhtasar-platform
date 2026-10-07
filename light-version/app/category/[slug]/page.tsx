import type { Metadata } from "next";
import { after } from "next/server";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import Breadcrumbs from "@/components/Breadcrumbs";
import CategoryNewsRow from "@/components/CategoryNewsRow";
import CategoryFilters from "@/components/CategoryFilters";
import Pagination from "@/components/Pagination";
import CategoryRibbon from "@/components/CategoryRibbon";
import { getSettings, listBreakingArticles, listBreakingPage, listCategoryArticles, listCategorySubcategories, type CategoryPeriodFilter, type CategorySort, type CategoryStatusFilter } from "@/database/database";
import { triggerCategoryRetrieval } from "@/services/retrieval-freshness";

export const dynamic="force-dynamic";
export async function generateMetadata({params}:{params:Promise<{slug:string}>}):Promise<Metadata>{const name=decodeURIComponent((await params).slug),path=`/category/${encodeURIComponent(name)}`;return {title:`أخبار ${name}`,description:`أحدث أخبار ${name} المنشورة والموثقة من المصادر المعتمدة في المختصر.`,alternates:{canonical:path},openGraph:{title:`أخبار ${name} | المختصر`,description:`أحدث أخبار ${name} المنشورة والموثقة.`,url:path,locale:"ar_SA",type:"website"}};}
export default async function CategoryPage({params,searchParams}:{params:Promise<{slug:string}>;searchParams:Promise<{page?:string;sub?:string;status?:string;period?:string;sort?:string}>}){
  const name=decodeURIComponent((await params).slug),query=await searchParams,page=Math.max(1,Number(query.page)||1),subcategory=String(query.sub||""),status=(['all','urgent','new'].includes(String(query.status))?query.status:'all') as CategoryStatusFilter,period=(['auto','today','3d','7d','30d','all'].includes(String(query.period))?query.period:'auto') as CategoryPeriodFilter,sort=(['latest','views','shares'].includes(String(query.sort))?query.sort:'latest') as CategorySort,settings=getSettings();
  after(()=>triggerCategoryRetrieval(name));
  const breaking=name==="الأخبار العاجلة",result=breaking?{...listBreakingPage(page,20),freshnessWindowUsed:`${settings.breakingHours}h`}:listCategoryArticles(name,{page,limit:20,subcategory,status,period,sort}),subcategories=breaking?[]:listCategorySubcategories(name);
  const href=(target:number)=>{const params=new URLSearchParams();params.set('page',String(target));if(subcategory)params.set('sub',subcategory);if(status!=='all')params.set('status',status);if(period!=='auto')params.set('period',period);if(sort!=='latest')params.set('sort',sort);return `/category/${encodeURIComponent(name)}?${params}`;};
  return <><Header homepage dark/><main id="main-content" className="listing-page category-listing-page category-dark">
    <CategoryRibbon categories={settings.homepageCategories.filter((category)=>!settings.hiddenCategories.includes(category))} activeCategory={name} showBreaking={listBreakingArticles(1).length>0}/>
    <header className="category-page-hero"><div className="container category-page-hero-inner"><Breadcrumbs items={[{label:"التصنيفات",href:"/"},{label:name}]}/><span className="category-page-kicker">التصنيف</span><h1>{name}</h1><p>أحدث أخبار وتقارير {name}</p></div></header>
    <div className="container category-page-content">
      {!breaking?<CategoryFilters subcategory={subcategory} subcategories={subcategories}/>:<p className="evidence-note">لا يظهر هنا إلا الخبر الذي يحمل إثباتًا من المصدر الأصلي، ويغادر القائمة تلقائيًا بعد {settings.breakingHours} ساعة.</p>}
      <div className="category-results-heading"><div><h2>{breaking?"العاجل النشط":"آخر الأخبار"}</h2><p>{breaking?"مرتبة وفق وقت النشر الأصلي":result.freshnessWindowUsed==="7d"?"تتضمن أحدث مواد الأسبوع الماضي":result.freshnessWindowUsed==="30d"?"تتضمن مواد من الأرشيف القريب":result.freshnessWindowUsed==="all"?"تتضمن أحدث المواد المنشورة من هذا التصنيف":"تغطية متجددة ومختصرة"}</p></div><span>{result.total}</span></div>
      <section className="category-news-list" aria-label={`أخبار ${name}`}>{result.data.length?result.data.map((article,index)=><CategoryNewsRow key={article.id} article={article} index={index} timezone={settings.timezone}/>):<p className="empty-section">لا توجد نتائج منشورة حالياً في هذا التصنيف.</p>}</section>
      <Pagination page={page} pages={result.pages} href={href}/>
    </div>
  </main><Footer/></>;
}
