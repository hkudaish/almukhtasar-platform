"use client";

import Link from "next/link";
import Image from "next/image";
import type { Article, TrendTopic } from "@/types/news";

export default function TrendingNewsStoriesSection({
  articles = [],
  topics = [],
  timezone = "Asia/Riyadh",
}: {
  articles: Article[];
  topics: TrendTopic[];
  timezone?: string;
}) {
  return (
    <section className="trends-category-block" aria-labelledby="trending-news-title">
      <div className="trends-category-header">
        <div className="trends-category-title-wrap">
          <span className="trends-category-badge news-badge">
            <span aria-hidden="true">📰</span> الأخبار المتداولة
          </span>
          <h2 id="trending-news-title">الأخبار والموضوعات الإخبارية الأكثر تداولاً</h2>
          <p className="trends-category-desc">
            رصد تحليلي للمقالات والقصص الصحفية الأكثر قراءة وتفاعلاً عبر الوكالات والصحف المعتمدة.
          </p>
        </div>
      </div>

      {/* Grid of Trending News Articles */}
      {articles.length > 0 ? (
        <div className="trending-articles-subblock">
          <h3 className="trending-subblock-title">
            <span>🔥</span> الأخبار الأكثر قراءة وتفاعلاً اليوم
          </h3>
          <div className="circulated-grid">
            {articles.slice(0, 8).map((article, index) => {
              const thumbnail = article.imageUrl || article.imageOriginalUrl || "/images/placeholder.svg";

              return (
                <Link
                  key={article.id}
                  href={`/news/${encodeURIComponent(article.slug || article.id)}`}
                  className="circulated-card"
                >
                  <div className="circulated-thumb-wrap">
                    <Image
                      src={thumbnail}
                      alt={article.title}
                      width={340}
                      height={190}
                      loading="lazy"
                      unoptimized={thumbnail.startsWith("http")}
                    />
                    <span className="circulated-rank-badge">#{index + 1}</span>
                  </div>

                  <div className="circulated-body">
                    <strong>{article.title}</strong>

                    <div className="circulated-footer">
                      <span className="circulated-source">{article.sourceName} • {article.category}</span>
                      <time dateTime={article.sourcePublishedAt}>
                        {new Date(article.sourcePublishedAt).toLocaleString("ar-SA", {
                          timeZone: timezone,
                          day: "numeric",
                          month: "short",
                          hour: "numeric",
                          minute: "numeric",
                        })}
                      </time>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      ) : null}

      {/* Topics & Issues Section */}
      {topics.length > 0 ? (
        <div className="trending-topics-subblock">
          <h3 className="trending-subblock-title">
            <span>📊</span> القضايا والموضوعات الإخبارية المتصدرة
          </h3>
          <div className="news-topics-grid">
            {topics.slice(0, 16).map((topic, idx) => (
              <div key={topic.id} className="news-topic-card">
                <div className="news-topic-top">
                  <span className="news-topic-rank">#{idx + 1}</span>
                  <span className="news-topic-category">{topic.category || "عام"}</span>
                  <span className="news-topic-score">زخم: {Math.round(topic.trendScore * 10) / 10}</span>
                </div>

                <strong className="news-topic-title">{topic.topic}</strong>

                <div className="news-topic-bottom">
                  <span className="news-topic-velocity">
                    معدل التغطية: <b>+{Math.max(5, Math.round(topic.velocity * 30))}%</b>
                  </span>
                  <Link
                    href={`/search?q=${encodeURIComponent(topic.topic)}`}
                    className="news-topic-link"
                    title={`ابحث عن كافة أخبار ${topic.topic}`}
                  >
                    أخبار الموضوع ›
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}
