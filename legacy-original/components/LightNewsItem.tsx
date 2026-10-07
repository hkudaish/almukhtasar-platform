import Image from "next/image";
import Link from "next/link";
import type { Story } from "@/lib/data";
import { categoryFallbackUrl } from "@/lib/image-fallback";

export default function LightNewsItem({story,index,mobileLimit,showTime,showBadges}:{story:Story;index:number;mobileLimit:number;showTime:boolean;showBadges:boolean}){
  const image=story.imageUrl||categoryFallbackUrl(story.category);
  return <Link
    href={`/news/${story.id}`}
    prefetch={index<2}
    className={`light-news-item${index>=mobileLimit?" light-mobile-extra":""}`}
  >
    <span className="light-thumbnail">
      <Image src={image} alt={story.imageAlt||story.title} fill sizes="(max-width: 700px) 88px, 104px" loading="lazy" quality={55}/>
    </span>
    <span className="light-item-copy">
      <strong>{story.title}</strong>
      {(showTime||(showBadges&&story.badge))&&<small>
        {showBadges&&story.badge?<em className={story.badge==="عاجل"?"breaking-badge":""}>{story.badge}</em>:null}
        {showTime?<time dateTime={story.publishedAt}>{story.time}</time>:null}
      </small>}
    </span>
  </Link>;
}
