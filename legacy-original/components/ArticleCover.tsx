"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { categoryFallbackUrl, embeddedCategoryFallback } from "@/lib/image-fallback";

export default function ArticleCover({imageUrl,imageAlt,imageCredit,source,accent,category}:{imageUrl?:string;imageAlt:string;imageCredit?:string;source:string;accent:string;category:string}){
  const [failed,setFailed]=useState(false),[fallbackFailed,setFallbackFailed]=useState(false);
  const fallbackImage=categoryFallbackUrl(category),displayedImage=fallbackFailed?embeddedCategoryFallback(category):failed||!imageUrl?fallbackImage:imageUrl;
  useEffect(()=>{setFailed(false);setFallbackFailed(false)},[imageUrl,category]);
  const unoptimized=displayedImage.startsWith("/api/media/category-fallback/")||displayedImage.startsWith("data:");
  return <figure className="article-cover imported-cover" style={{background:accent}}><img className="article-cover-backdrop" src={displayedImage} alt="" aria-hidden="true"/><Image fill sizes="(max-width: 700px) 100vw, 900px" className="article-cover-image" src={displayedImage} alt={failed||fallbackFailed||!imageUrl?`صورة افتراضية لتصنيف ${category}`:imageAlt} priority unoptimized={unoptimized} onError={()=>{if(fallbackFailed)return;if(failed||!imageUrl)setFallbackFailed(true);else setFailed(true)}}/><figcaption>الصورة: {failed||fallbackFailed||!imageUrl?`المختصر — صورة افتراضية معتمدة لتصنيف ${category}`:imageCredit||source}</figcaption></figure>;
}
