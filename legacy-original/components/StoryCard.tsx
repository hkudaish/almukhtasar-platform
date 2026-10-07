"use client";

import Link from "next/link";
import Image from "next/image";
import { Bookmark, Clock3, ShieldCheck } from "lucide-react";
import { useEffect, useState } from "react";
import type { Story } from "@/lib/data";
import { categoryFallbackUrl, embeddedCategoryFallback } from "@/lib/image-fallback";

const storageKey = "almukhtasar-saved";

export default function StoryCard({ story, compact = false, href }: { story: Story; compact?: boolean; href?: string }) {
  const [saved, setSaved] = useState(false);
  const [imageFailed,setImageFailed]=useState(false),[fallbackFailed,setFallbackFailed]=useState(false);
  const storyHref = href || `/news/${story.id}`;
  const fallbackImage=story.id.startsWith("imported-")?categoryFallbackUrl(story.category):undefined;
  const emergencyImage=embeddedCategoryFallback(story.category);
  const displayedImage=fallbackFailed?emergencyImage:imageFailed?(fallbackImage||emergencyImage):(story.imageUrl||fallbackImage||emergencyImage);
  const showImage=Boolean(story.imageUrl||fallbackImage);

  useEffect(() => {
    const ids: string[] = JSON.parse(localStorage.getItem(storageKey) || "[]");
    setSaved(ids.includes(story.id));
  }, [story.id]);
  useEffect(()=>{setImageFailed(false);setFallbackFailed(false)},[story.imageUrl,story.category]);

  function toggleSaved() {
    const ids: string[] = JSON.parse(localStorage.getItem(storageKey) || "[]");
    const next = ids.includes(story.id) ? ids.filter((id) => id !== story.id) : [...ids, story.id];
    localStorage.setItem(storageKey, JSON.stringify(next));
    setSaved(next.includes(story.id));
    window.dispatchEvent(new Event("saved-articles-changed"));
  }

  return (
    <article className={compact ? "story-card compact" : "story-card"}>
      <Link href={storyHref} className={`story-visual${showImage?" has-image":""}`} style={{ background: story.accent }} aria-label={story.title}>
        {showImage&&<>
          <img className="story-source-image-backdrop" src={displayedImage!} alt="" aria-hidden="true" loading="lazy"/>
          <Image fill sizes={compact?"(max-width: 700px) 105px, 128px":"(max-width: 700px) 100vw, 50vw"} className="story-source-image" src={displayedImage} alt={imageFailed||fallbackFailed?`صورة افتراضية لتصنيف ${story.category}`:story.imageAlt||story.title} loading="lazy" unoptimized={displayedImage.startsWith("/api/media/category-fallback/")||displayedImage.startsWith("data:")} onError={()=>{if(fallbackFailed)return;if(imageFailed||displayedImage===fallbackImage)setFallbackFailed(true);else setImageFailed(true)}}/>
        </>}
        <span className="story-category">{story.category}</span>
        <span className="visual-word">المختصر</span>
      </Link>
      <div className="story-body">
        <div className="story-meta">
          <span><Clock3 size={14}/>{story.time}</span>
          <span><ShieldCheck size={14}/>{story.confidence}% موثوقية</span>
        </div>
        <Link href={storyHref}><h3>{story.title}</h3></Link>
        {!compact && <p>{story.summary}</p>}
        <div className="story-footer">
          <span>{story.source}</span>
          <button className={saved ? "saved" : ""} onClick={toggleSaved} aria-label={saved ? "إزالة الخبر من المحفوظات" : "حفظ الخبر"} title={saved ? "محفوظ" : "حفظ"}>
            <Bookmark size={17} fill={saved ? "currentColor" : "none"}/>
          </button>
        </div>
      </div>
    </article>
  );
}
