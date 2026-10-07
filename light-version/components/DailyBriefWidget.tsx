"use client";

import Link from "next/link";
import type { DailyBrief } from "@/types/news";

export default function DailyBriefWidget({ brief }: { brief: DailyBrief | null }) {
  if (!brief) return null;

  const formattedDate = new Intl.DateTimeFormat("ar-SA", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(new Date(brief.date || brief.publishedAt));

  return (
    <section className="daily-brief-container" aria-labelledby="daily-brief-heading">
      <div className="daily-brief-card">
        <header className="daily-brief-header">
          <div className="daily-brief-title-wrap">
            <span className="daily-brief-badge">
              <span aria-hidden="true">📋</span>
              <span id="daily-brief-heading">مختصر اليوم</span>
            </span>
            <time className="daily-brief-date" dateTime={brief.date}>
              {formattedDate}
            </time>
          </div>

          <Link href="/brief" className="view-all" title="أرشيف الملخصات اليومية">
            عرض أرشيف الموجز ›
          </Link>
        </header>

        <p className="daily-brief-summary">{brief.summary}</p>

        {brief.stats ? (
          <div className="daily-brief-stats" aria-label="مؤشرات اليوم الإخبارية">
            {brief.stats.topHashtag ? (
              <div className="brief-stat-pill">
                <span>الوسم الأكثر تفاعلاً:</span>
                <strong>{brief.stats.topHashtag}</strong>
              </div>
            ) : null}
            {brief.stats.dominantCategory ? (
              <div className="brief-stat-pill">
                <span>القطاع المتصدر:</span>
                <strong>{brief.stats.dominantCategory}</strong>
              </div>
            ) : null}
            {brief.stats.totalArticles ? (
              <div className="brief-stat-pill">
                <span>أخبار مرصودة ومحللة:</span>
                <strong>{brief.stats.totalArticles} خبر</strong>
              </div>
            ) : null}
          </div>
        ) : null}

        {brief.topStories && brief.topStories.length > 0 ? (
          <div className="daily-brief-stories">
            {brief.topStories.slice(0, 3).map((story, idx) => (
              <Link
                key={story.id || idx}
                href={`/news/${encodeURIComponent(story.slug || story.id)}`}
                className="brief-story-item"
              >
                <span className="brief-story-index" aria-hidden="true">
                  {idx + 1}
                </span>
                <div className="brief-story-content">
                  <strong>{story.title}</strong>
                  <div className="brief-story-meta">
                    <span>{story.sourceName}</span>
                    <span>•</span>
                    <span>{story.category}</span>
                    {story.publishedAt ? (
                      <>
                        <span>•</span>
                        <time dateTime={story.publishedAt}>
                          {new Date(story.publishedAt).toLocaleString("ar-SA", {
                            timeZone: "Asia/Riyadh",
                            day: "numeric",
                            month: "short",
                            hour: "numeric",
                            minute: "2-digit",
                          })}
                        </time>
                      </>
                    ) : null}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        ) : null}
      </div>
    </section>
  );
}
