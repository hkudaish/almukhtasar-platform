import Image from "next/image";
import Link from "next/link";
import type { Article } from "@/types/news";

export default function CategoryNewsRow({article,index,timezone,variant="row"}:{article:Article;index:number;timezone:string;variant?:"row"|"grid"}){
  const image=article.imageUrl||`/api/media/fallback/${encodeURIComponent(article.category)}`;
  const imageAlt=!article.imageAlt||["undefined","null"].includes(article.imageAlt.toLowerCase())?article.title:article.imageAlt;
  const published=new Date(article.sourcePublishedAt).toLocaleString("ar-SA",{timeZone:timezone,day:"numeric",month:"long",year:"numeric",hour:"numeric",minute:"2-digit"});
  return <Link href={`/news/${article.slug}`} prefetch={index<2} className={`category-news-row${variant==="grid"?" article-card":""}`}>
    <span className="category-news-thumb"><Image src={image} alt={imageAlt} fill sizes="(max-width:600px) 112px,(max-width:900px) 50vw,25vw" quality={55} priority={index<2} unoptimized={article.imageStatus!=="valid" || image.startsWith("http")}/></span>
    <span className="category-news-copy">
      <span className="category-news-labels"><em>{article.subcategory||article.category}</em>{article.badge?<b>{article.badge}</b>:["أولوية قصوى","مهم"].includes(article.importanceLevel)?<b>{article.importanceLevel}</b>:null}</span>
      <strong>{article.title}</strong>
      {article.tags.length?<span className="category-card-tags">{article.tags.slice(0,2).map((tag)=><i key={tag}>{tag}</i>)}</span>:null}
      {article.summary?<p>{article.summary}</p>:null}
      <span className="category-news-meta"><time dateTime={article.sourcePublishedAt}>{published}</time>{article.sourceName?<span>المصدر: {article.sourceName}</span>:null}</span>
    </span>
  </Link>;
}
