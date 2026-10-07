import Image from "next/image";
import Link from "next/link";
import type { Article } from "@/types/news";

export default function NewsRow({article,index=5,mobileLimit=99,tabletLimit=99,showTime=true,showBadges=true,priority=false,timezone="Asia/Riyadh"}:{article:Article;index?:number;mobileLimit?:number;tabletLimit?:number;showTime?:boolean;showBadges?:boolean;priority?:boolean;timezone?:string}){
  const image=article.imageStatus==="valid"?article.imageUrl:"",imageAlt=!article.imageAlt||["undefined","null"].includes(article.imageAlt.toLowerCase())?article.title:article.imageAlt,visibleBadge=showBadges&&article.badge&&article.badge!=="عاجل"?article.badge:null;
  return <Link href={`/news/${article.slug}`} prefetch={index<2} className={`news-row${image?"":" without-thumbnail"}${index>=mobileLimit?" mobile-extra":""}${index>=tabletLimit?" tablet-extra":""}`}>
    {image?<span className="thumbnail"><Image src={image} alt={imageAlt} fill sizes="(max-width:700px) 88px,(max-width:1000px) 96px,104px" quality={55} priority={priority} unoptimized={image.startsWith("http")}/></span>:null}
    <span className="row-copy"><strong>{article.title}</strong>{(showTime||visibleBadge)&&<small>{visibleBadge?<em>{visibleBadge}</em>:null}{showTime?<time dateTime={article.sourcePublishedAt}>{new Date(article.sourcePublishedAt).toLocaleString("ar-SA",{timeZone:timezone,day:"numeric",month:"short",hour:"numeric",minute:"2-digit"})}</time>:null}</small>}</span>
  </Link>;
}
