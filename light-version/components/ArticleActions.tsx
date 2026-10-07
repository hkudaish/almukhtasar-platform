"use client";

import { useEffect, useMemo, useState } from "react";

type Props={slug:string;title:string;tags:string[]};

const icon={copy:"⧉",linkedin:"in",facebook:"f",telegram:"➤",x:"𝕏",whatsapp:"◔"};

export default function ArticleActions({slug,title,tags}:Props){
  const [liked,setLiked]=useState(false),[saved,setSaved]=useState(false),[copied,setCopied]=useState(false),[focused,setFocused]=useState(false);
  const url=typeof window === "undefined" ? `/news/${slug}` : window.location.href;
  const keys=useMemo(()=>tags.slice(0,8),[tags]);
  useEffect(()=>{const stored=localStorage.getItem(`article-actions:${slug}`);if(stored){try{const value=JSON.parse(stored);setLiked(Boolean(value.liked));setSaved(Boolean(value.saved));}catch{}}return ()=>document.documentElement.classList.remove("article-focus");},[slug]);
  function persist(nextLiked=liked,nextSaved=saved){localStorage.setItem(`article-actions:${slug}`,JSON.stringify({liked:nextLiked,saved:nextSaved}));}
  function toggleLike(){const next=!liked;setLiked(next);persist(next,saved);}
  function toggleSave(){const next=!saved;setSaved(next);persist(liked,next);}
  function toggleFocus(){const next=!focused;setFocused(next);document.documentElement.classList.toggle("article-focus",next);}
  async function copy(){try{await navigator.clipboard.writeText(url);setCopied(true);setTimeout(()=>setCopied(false),1800);}catch{window.prompt("انسخ الرابط",url);}}
  async function nativeShare(){if(navigator.share){try{await navigator.share({title,text:title,url});}catch{}}else copy();}
  const links=[
    ["linkedin",`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`],
    ["facebook",`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`],
    ["telegram",`https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(title)}`],
    ["x",`https://twitter.com/intent/tweet?url=${encodeURIComponent(url)}&text=${encodeURIComponent(title)}`],
    ["whatsapp",`https://wa.me/?text=${encodeURIComponent(`${title} ${url}`)}`]
  ] as const;
  return <section className="article-actions" aria-label="أدوات المشاركة والتفاعل">
    {keys.length?<div className="article-keywords"><b>الكلمات المفتاحية</b><div>{keys.map((key)=><span key={key}>{key}</span>)}</div></div>:null}
    <div className="article-action-panel"><div className="action-panel-head"><div><h2>شارك المقال</h2><p>تفاعل مع الخبر وشاركه مع غيرك</p></div><button className="share-main" type="button" onClick={nativeShare} aria-label="مشاركة المقال">⌯</button></div><div className="action-panel-body"><div className="article-preferences"><button type="button" className={liked?"active":""} onClick={toggleLike}>♡ <span>{liked?"أعجبك":"إعجاب"}</span></button><button type="button" className={saved?"active":""} onClick={toggleSave}>⌑ <span>{saved?"محفوظ":"حفظ"}</span></button><button type="button" className={focused?"active":""} onClick={toggleFocus}>◉ <span>{focused?"إنهاء التركيز":"وضع التركيز"}</span></button></div><div className="share-links"><button type="button" onClick={copy} title="نسخ الرابط" aria-label="نسخ الرابط">{copied?"✓":icon.copy}</button>{links.map(([name,href])=><a key={name} href={href} target="_blank" rel="noopener noreferrer" className={`share-${name}`} aria-label={`مشاركة عبر ${name}`}>{icon[name]}</a>)}</div></div></div>
  </section>;
}
