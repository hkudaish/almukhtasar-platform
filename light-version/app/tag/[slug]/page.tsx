import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import CategoryNewsRow from "@/components/CategoryNewsRow";
import Pagination from "@/components/Pagination";
import { getSettings, listTagArticles, tagArticleCount } from "@/database/database";

export const dynamic="force-dynamic";
export async function generateMetadata({params}:{params:Promise<{slug:string}>}):Promise<Metadata>{const tag=decodeURIComponent((await params).slug),count=tagArticleCount(tag);return {title:`${tag} - الأخبار والموضوعات ذات الصلة`,description:`أحدث الأخبار والتقارير المرتبطة بموضوع ${tag}.`,robots:count>=3?{index:true,follow:true}:{index:false,follow:true},alternates:{canonical:`/tag/${encodeURIComponent(tag)}`}};}
export default async function TagPage({params,searchParams}:{params:Promise<{slug:string}>;searchParams:Promise<{page?:string}>}){const tag=decodeURIComponent((await params).slug);const page=Math.max(1,Number((await searchParams).page)||1),result=listTagArticles(tag,page,20),settings=getSettings();return <><Header homepage/><main id="main-content" className="listing-page showcase-page"><div className="container showcase-content"><header className="showcase-heading"><span aria-hidden="true">#</span><div><h1>{tag}</h1><p>{result.total} خبرًا وتقريرًا مرتبطًا بهذا الموضوع</p></div></header><section className="article-card-grid" aria-label={`أخبار ${tag}`}>{result.data.length?result.data.map((article,index)=><CategoryNewsRow key={article.id} article={article} index={index} timezone={settings.timezone} variant="grid"/>):<p className="empty-section">لا توجد أخبار مرتبطة بهذا الوسم حالياً.</p>}</section><Pagination page={page} pages={result.pages} href={(target)=>`/tag/${encodeURIComponent(tag)}?page=${target}`}/></div></main><Footer/></>}
