import Image from "next/image";
import Link from "next/link";
import type { Article } from "@/types/news";

function articleImage(article:Article){return article.imageStatus==="valid"?article.imageUrl:"";}
function articleAlt(article:Article){return !article.imageAlt||["undefined","null"].includes(article.imageAlt.toLowerCase())?article.title:article.imageAlt;}
function articleTime(article:Article,timezone:string){return new Date(article.sourcePublishedAt).toLocaleString("ar-SA",{timeZone:timezone,day:"numeric",month:"long",year:"numeric"});}
function editorialBadge(article:Article){return article.badge||(["أولوية قصوى","مهم"].includes(article.importanceLevel)?article.importanceLevel:null);}

export function HomeHero({article,timezone}:{article:Article;timezone:string}){
  const image=articleImage(article);
  return <Link href={`/news/${article.slug}`} className={`home-hero-card${image?"":" no-image"}`}>
    {image?<Image src={image} alt={articleAlt(article)} fill sizes="(max-width: 760px) 100vw, 75vw" quality={75} priority unoptimized={image.startsWith("http")}/>:<span className="home-image-placeholder"/>}
    <span className="home-hero-shade"/>
    <span className="home-hero-copy"><span className="home-card-meta"><em>{article.category}</em>{editorialBadge(article)?<b>{editorialBadge(article)}</b>:null}<time dateTime={article.sourcePublishedAt}>{articleTime(article,timezone)}</time></span><strong>{article.title}</strong></span>
  </Link>;
}

export function HomeSideStory({article,index,timezone}:{article:Article;index:number;timezone:string}){
  const image=articleImage(article);
  return <Link href={`/news/${article.slug}`} prefetch={index<2} className="home-side-story">
    <span className="home-side-copy"><span className="home-category-tag">{article.category}</span><strong>{article.title}</strong><time dateTime={article.sourcePublishedAt}>{articleTime(article,timezone)}</time></span>
    {image?<span className="home-side-image"><Image src={image} alt={articleAlt(article)} fill sizes="150px" quality={55} unoptimized={image.startsWith("http")}/></span>:<span className="home-side-image home-image-placeholder"/>}
  </Link>;
}

export function HomeGridCard({article,index,timezone}:{article:Article;index:number;timezone:string}){
  const image=articleImage(article);
  return <Link href={`/news/${article.slug}`} prefetch={index<2} className="home-grid-card">
    <span className={`home-grid-image${image?"":" home-image-placeholder"}`}>{image?<Image src={image} alt={articleAlt(article)} fill sizes="(max-width: 620px) 100vw, (max-width: 980px) 50vw, 25vw" quality={55} unoptimized={image.startsWith("http")}/>:null}</span>
    <span className="home-grid-copy"><span className="home-card-meta"><em>{article.category}</em>{editorialBadge(article)?<b>{editorialBadge(article)}</b>:null}</span><strong>{article.title}</strong>{article.summary?<p>{article.summary}</p>:null}<time dateTime={article.sourcePublishedAt}>{articleTime(article,timezone)}</time></span>
  </Link>;
}
