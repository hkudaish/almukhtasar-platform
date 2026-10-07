import Header from "@/components/Header";
import Footer from "@/components/Footer";
import StoryCard from "@/components/StoryCard";
import { AlertCircle, Clock3, ExternalLink, ShieldCheck } from "lucide-react";
import { notFound } from "next/navigation";
import ArticleActions from "@/components/ArticleActions";
import type { Metadata } from "next";
import Breadcrumbs from "@/components/Breadcrumbs";
import { archivePath, dayLabel, monthLabel, parseArchiveDate, storyDate } from "@/lib/archive";
import { getPublishedImportedStories, getPublishedImportedStory } from "@/lib/public-content";
import ArticleCover from "@/components/ArticleCover";

export const dynamic="force-dynamic";
export function generateStaticParams() { return []; }
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const story = getPublishedImportedStory(slug);
  return story ? { title: `${story.title} | المختصر`, description: story.summary, alternates: { canonical: `/news/${story.id}` }, openGraph: { title: story.title, description: story.summary, type: "article", publishedTime: story.publishedAt, images:story.imageUrl?[{url:story.imageUrl,alt:story.imageAlt||story.title}]:[] }, twitter:{card:"summary_large_image",title:story.title,description:story.summary,images:story.imageUrl?[story.imageUrl]:[]} } : {};
}

export default async function NewsPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ archive?: string | string[] }> }) {
  const { slug } = await params;
  const query = await searchParams;
  const story = getPublishedImportedStory(slug);
  if (!story) return notFound();
  const isImported=story.id.startsWith("imported-");
  const importedStories=getPublishedImportedStories(100);
  const relatedStories=[
    ...importedStories.filter((item)=>item.category===story.category),
    ...importedStories
  ].filter((item,index,all)=>item.id!==story.id&&Boolean(item.imageUrl)&&all.findIndex((candidate)=>candidate.id===item.id)===index).slice(0,3);
  const archiveValue = Array.isArray(query.archive) ? query.archive[0] : query.archive;
  const archiveDate = parseArchiveDate(archiveValue);
  const publishedDate = storyDate(story);
  const archiveContext = archiveDate?.key === publishedDate.key ? archiveDate : null;
  const breadcrumbItems = archiveContext ? [
    { label: "الرئيسية", href: "/" },
    { label: "أرشيف الأخبار", href: "/archive" },
    { label: monthLabel(archiveContext.year, archiveContext.month), href: archivePath(archiveContext.year, archiveContext.month) },
    { label: dayLabel(archiveContext.month, archiveContext.day), href: archivePath(archiveContext.year, archiveContext.month, archiveContext.day) },
    { label: story.category, href: `/category/${encodeURIComponent(story.category)}` },
    { label: story.title, href: `/news/${story.id}?archive=${archiveContext.key}`, current: true }
  ] : [
    { label: "الرئيسية", href: "/" },
    { label: story.category, href: `/category/${encodeURIComponent(story.category)}` },
    { label: "الخبر", href: `/news/${story.id}`, current: true }
  ];

  return (
    <>
      <Header />
      <main id="main-content" className="article-page">
        <div className="container article-layout">
          <article className="article-main">
            <Breadcrumbs items={breadcrumbItems}/>
            <span className="pill dark-pill">{story.category}</span>
            <h1>{story.title}</h1>
            {!isImported&&<p className="article-lead">{story.summary}</p>}
            <div className="article-info">
              <span>تحرير: فريق المختصر</span><span><Clock3 size={15}/> {story.time}</span>
              <span>آخر تحديث: اليوم</span><span>{story.readTime}</span>
            </div>
            <ArticleActions id={story.id} title={story.title} summary={story.summary}/>
            <ArticleCover imageUrl={story.imageUrl} imageAlt={story.imageAlt||story.title} imageCredit={story.imageCredit} source={story.source} accent={story.accent} category={story.category}/>

            <section className="quick-summary">
              <h2>باختصار</h2>
              {isImported?<p>{story.summary}</p>:<ul>{story.bullets.map((bullet) => <li key={bullet}>{bullet}</li>)}</ul>}
            </section>

            {(!isImported||Boolean(story.details?.length))&&<section className="article-copy">
              <h2>المضمون</h2>
              {isImported?story.details?.map((paragraph)=><p key={paragraph}>{paragraph}</p>):<><p>أعلنت جهات خدمية عن خطوات جديدة لتوظيف أدوات الذكاء الاصطناعي في تحسين عملياتها، ضمن مسار يستهدف اختصار الوقت ورفع دقة الاستجابة وتقديم خدمات أكثر ملاءمة لاحتياجات المستخدمين.</p><p>ويعتمد التوجه الجديد على تحليل البيانات، أتمتة الإجراءات المتكررة، وتوفير مساعدين رقميين، مع الإبقاء على المراجعة البشرية في القرارات الحساسة.</p></>}
              {story.whyItMatters&&story.whyItMatters!==story.summary&&<><h2>أهمية الخبر</h2><p>{story.whyItMatters}</p></>}
              {story.expected&&<><h2>المتوقع</h2><p>{story.expected}</p></>}
            </section>}

            <section className="source-box" aria-labelledby="article-sources-title">
              <ShieldCheck size={24}/><div><h3 id="article-sources-title">{story.sources?.length===1?"المصدر:":"المصادر:"}</h3>
                <div className="article-source-list">{story.sources?.length?story.sources.map((source)=><a key={`${source.name}-${source.role}`} href={source.url} target="_blank" rel="noopener noreferrer"><span><b>{source.name}</b><em>{source.role}</em></span><small>{source.type} · النشر الأصلي: {source.publishedAt}</small><ExternalLink/></a>):<div className="article-source-fallback"><b>{story.source}</b><small>بيانات الرابط الأصلي غير متاحة في هذه المادة التجريبية.</small></div>}</div>
                <small className="source-local-update">آخر تحديث لدى المختصر: {new Date(story.publishedAt).toLocaleString("ar-SA")}</small>
              </div>
            </section>
            <button className="report-btn"><AlertCircle size={17}/> الإبلاغ عن خطأ أو تحديث</button>
          </article>

          <aside className="article-aside">
            <div className="aside-card related-stories"><h3>موضوعات مرتبطة</h3><div className="related-stories-list">{relatedStories.map(s=><StoryCard key={s.id} story={s} compact/>)}</div></div>
          </aside>
        </div>
      </main>
      <Footer />
    </>
  );
}
