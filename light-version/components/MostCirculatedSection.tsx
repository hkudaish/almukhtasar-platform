"use client";

import Link from "next/link";
import NewsImage from "@/components/NewsImage";
import type { Article } from "@/types/news";

export default function MostCirculatedSection({
  articles,
  timezone = "Asia/Riyadh",
}: {
  articles: Article[];
  timezone?: string;
}) {
  if (!articles || articles.length === 0) return null;

  return (
    <section className="circulated-section" aria-labelledby="circulated-title">
      <div className="section-head">
        <div className="section-head-title">
          <span className="icon" aria-hidden="true">📈</span>
          <h2 id="circulated-title">الأكثر تداولاً</h2>
        </div>
        <Link href="/trends" className="view-all">
          استكشف المواضيع المتداولة ›
        </Link>
      </div>

      <div className="circulated-grid">
        {articles.slice(0, 4).map((article, index) => {
          const thumbnail = article.imageUrl || article.imageOriginalUrl || "";

          return (
            <Link
              key={article.id}
              href={`/news/${encodeURIComponent(article.slug || article.id)}`}
              className="circulated-card"
            >
              <div className="circulated-thumb-wrap">
                <NewsImage
                  src={thumbnail}
                  alt=""
                  category={article.category}
                  fill
                  sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
                  loading="lazy"
                />
                <span className="circulated-rank-badge" aria-label={`المرتبة ${index + 1}`}>
                  #{index + 1}
                </span>
              </div>

              <div className="circulated-body">
                <div className="circulated-meta-top">
                  <span className="circulated-rank-pill">الأكثر قراءة</span>
                  <span className="circulated-category-pill">{article.category}</span>
                </div>

                <strong className="circulated-title">{article.title}</strong>

                <div className="circulated-footer">
                  <span className="circulated-source">{article.sourceName}</span>
                  <time dateTime={article.sourcePublishedAt}>
                    {new Date(article.sourcePublishedAt).toLocaleString("ar-SA", {
                      timeZone: timezone,
                      day: "numeric",
                      month: "short",
                      hour: "numeric",
                      minute: "2-digit",
                    })}
                  </time>
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
