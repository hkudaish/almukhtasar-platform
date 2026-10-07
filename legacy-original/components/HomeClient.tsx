"use client";

import Link from "next/link";
import Image from "next/image";
import { ArrowLeft, CheckCircle2, Headphones, Pause, Share2 } from "lucide-react";
import { useEffect, useState } from "react";
import Header from "./Header";
import Footer from "./Footer";
import StoryCard from "./StoryCard";
import SocialTrends from "./SocialTrends";
import { categories } from "@/lib/data";
import type { Story } from "@/lib/data";
import { categoryFallbackUrl, embeddedCategoryFallback } from "@/lib/image-fallback";

export default function HomeClient({stories}:{stories:Story[]}) {
  const featured = stories[0];
  const brief=stories.slice(0,7).map((story)=>story.bullets[0]).filter(Boolean);
  const [playing, setPlaying] = useState(false);
  const [briefExpanded, setBriefExpanded] = useState(false);
  const [featuredImageFailed,setFeaturedImageFailed]=useState(false),[featuredFallbackFailed,setFeaturedFallbackFailed]=useState(false);
  const featuredFallback=featured?categoryFallbackUrl(featured.category):"",featuredImage=featuredFallbackFailed&&featured?embeddedCategoryFallback(featured.category):featuredImageFailed?featuredFallback:featured?.imageUrl||featuredFallback;
  const showFeaturedImage=Boolean(featured&&featuredImage);
  const visibleBrief = briefExpanded ? brief : brief.slice(0, 4);
  useEffect(()=>{setFeaturedImageFailed(false);setFeaturedFallbackFailed(false)},[featured?.id,featured?.imageUrl]);
  useEffect(()=>{if(stories.length>=5)return;void fetch("/api/homepage/urgent-retrieval",{method:"POST",headers:{"Content-Type":"application/json"},body:"{}"}).catch(()=>undefined);},[stories.length]);

  function listen() {
    if (!("speechSynthesis" in window)) return;
    if (playing) {
      speechSynthesis.cancel();
      setPlaying(false);
      return;
    }
    const voice = new SpeechSynthesisUtterance(`مختصر اليوم. ${brief.join(". ")}`);
    voice.lang = "ar-SA";
    voice.onend = () => setPlaying(false);
    speechSynthesis.speak(voice);
    setPlaying(true);
  }

  async function shareBrief() {
    const text = `مختصر اليوم\n${brief.map((item, index) => `${index + 1}. ${item}`).join("\n")}`;
    if (navigator.share) await navigator.share({ title: "مختصر اليوم", text });
    else await navigator.clipboard.writeText(text);
  }

  return (
    <>
      <Header />
      <main id="main-content" className="focused-home">
        <section className="focused-hero" aria-labelledby="featured-title">
          <div className="container">
            {featured?<div className={`focused-hero-card${showFeaturedImage?" has-image":""}`}>
              {showFeaturedImage&&<>
                <img className="focused-hero-image-backdrop" src={featuredImage} alt="" aria-hidden="true"/>
                <Image fill sizes="100vw" className="focused-hero-image" src={featuredImage} alt={featuredImageFailed||featuredFallbackFailed?`صورة افتراضية لتصنيف ${featured.category}`:featured.imageAlt||featured.title} priority unoptimized={featuredImage.startsWith("/api/media/category-fallback/")||featuredImage.startsWith("data:")} onError={()=>{if(featuredFallbackFailed)return;if(featuredImageFailed||featuredImage===featuredFallback)setFeaturedFallbackFailed(true);else setFeaturedImageFailed(true)}}/>
              </>}
              <div className="focused-hero-copy">
                <span className="focused-kicker">الأهم الآن · {featured.category}</span>
                <h1 id="featured-title">{featured.title}</h1>
                <p>{featured.summary}</p>
                <div className="focused-meta">
                  <span>{featured.time}</span>
                  <span>{featured.readTime}</span>
                  <span><CheckCircle2 size={15} /> {featured.confidence}% موثوقية</span>
                </div>
                <Link href={`/news/${featured.id}`} className="focused-primary-action">
                  اقرأ المختصر <ArrowLeft size={18} />
                </Link>
              </div>
              <div className="focused-hero-mark" aria-hidden="true">م</div>
            </div>:null}
          </div>
        </section>

        <nav className="focused-category-nav container" aria-label="الأقسام الشائعة">
          <span>انتقل إلى:</span>
          {categories.slice(1, 7).map((category) => (
            <Link key={category} href={`/category/${encodeURIComponent(category)}`}>{category}</Link>
          ))}
          <Link className="all-categories" href="/search">كل الأخبار <ArrowLeft size={14} /></Link>
        </nav>

        <section className="focused-brief" aria-labelledby="daily-brief-title">
          <div className="container focused-brief-inner">
            <div className="focused-section-intro">
              <span>في أقل من دقيقتين</span>
              <h2 id="daily-brief-title">مختصر اليوم</h2>
              <p>أهم ما تحتاج معرفته، دون تفاصيل زائدة.</p>
              <div className="focused-brief-actions">
                <button type="button" onClick={listen} disabled={!brief.length}>
                  {playing ? <Pause size={17} /> : <Headphones size={17} />}
                  {playing ? "إيقاف" : "استمع"}
                </button>
                <button type="button" onClick={shareBrief} disabled={!brief.length}><Share2 size={17} /> مشاركة</button>
              </div>
            </div>
            <div>
              {visibleBrief.length?<ol className="focused-brief-list">
                {visibleBrief.map((item, index) => <li key={`${index}-${item}`}><span>{index + 1}</span><p>{item}</p></li>)}
              </ol>:<div className="focused-content-empty"><strong>لا توجد نقاط موجزة بعد.</strong><p>سيُبنى مختصر اليوم تلقائياً من الأخبار المنشورة.</p></div>}
              {brief.length>4&&<button className="focused-text-action" type="button" onClick={() => setBriefExpanded(!briefExpanded)}>
                {briefExpanded ? "عرض أقل" : `عرض ${brief.length - visibleBrief.length} نقاط أخرى`}
              </button>}
            </div>
          </div>
        </section>

        <section className="focused-latest" aria-labelledby="latest-title">
          <div className="container">
            <div className="focused-section-heading">
              <div><span>مختارة بعناية</span><h2 id="latest-title">آخر الأخبار</h2></div>
              <Link href="/search">عرض الكل <ArrowLeft size={16} /></Link>
            </div>
            {stories.length>1?<div className="focused-story-grid">{stories.slice(1, 5).map((story) => <StoryCard key={story.id} story={story} compact />)}</div>:<div className="focused-content-empty"><strong>لا توجد أخبار إضافية منشورة.</strong><p>المواد المسودة أو المحتاجة إلى مراجعة لا تظهر في الموقع العام.</p></div>}
          </div>
        </section>

        <SocialTrends />
      </main>
      <Footer />
    </>
  );
}
