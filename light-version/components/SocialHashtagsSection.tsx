"use client";

import { useState } from "react";
import Link from "next/link";
import type { TrendTopic } from "@/types/news";

export default function SocialHashtagsSection({
  hashtags = [],
}: {
  hashtags: TrendTopic[];
}) {
  const [platformFilter, setPlatformFilter] = useState<"all" | "x" | "instagram">("all");

  const filteredHashtags = hashtags.filter((item) => {
    if (platformFilter === "all") return true;
    return item.platform === platformFilter;
  });

  if (!hashtags || hashtags.length === 0) return null;

  return (
    <section className="trends-category-block" aria-labelledby="social-hashtags-title">
      <div className="trends-category-header">
        <div className="trends-category-title-wrap">
          <span className="trends-category-badge social-badge">
            <span aria-hidden="true">📱</span> وسوم شبكات التواصل
          </span>
          <h2 id="social-hashtags-title">ترند وهاشتاغات منصات التواصل الاجتماعي</h2>
          <p className="trends-category-desc">
            رصد لحظي لأبرز الوسوم والهاشتاغات الأكثر تفاعلاً وانتشاراً عبر منصتي إكس (𝕏) وإنستغرام.
          </p>
        </div>

        <div className="trends-platform-pills" role="tablist" aria-label="تصفية المنصات">
          <button
            type="button"
            role="tab"
            aria-selected={platformFilter === "all"}
            className={`platform-pill ${platformFilter === "all" ? "active" : ""}`}
            onClick={() => setPlatformFilter("all")}
          >
            🔥 جميع المنصات ({hashtags.length})
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={platformFilter === "x"}
            className={`platform-pill x-pill ${platformFilter === "x" ? "active" : ""}`}
            onClick={() => setPlatformFilter("x")}
          >
            𝕏 منصة إكس ({hashtags.filter((h) => h.platform === "x").length})
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={platformFilter === "instagram"}
            className={`platform-pill ig-pill ${platformFilter === "instagram" ? "active" : ""}`}
            onClick={() => setPlatformFilter("instagram")}
          >
            📸 إنستغرام ({hashtags.filter((h) => h.platform === "instagram").length})
          </button>
        </div>
      </div>

      <div className="hashtags-grid">
        {filteredHashtags.map((trend, idx) => {
          const cleanTag = trend.topic.replace(/^#/, "");
          const isX = trend.platform === "x";

          return (
            <div key={trend.id} className="hashtag-trend-card">
              <div className="hashtag-card-top">
                <span className="hashtag-rank">#{idx + 1}</span>
                <span className={`hashtag-platform-tag ${isX ? "platform-x" : "platform-ig"}`}>
                  {isX ? "𝕏 إكس" : "📸 إنستغرام"}
                </span>
                <span className="hashtag-score" title="رصيد التداول والتفاعل">
                  🔥 {Math.round(trend.trendScore)}
                </span>
              </div>

              <div className="hashtag-card-main">
                <strong className="hashtag-title">{trend.topic}</strong>
                {trend.category ? (
                  <span className="hashtag-category">{trend.category}</span>
                ) : null}
              </div>

              <div className="hashtag-card-footer">
                <span className="hashtag-velocity">
                  تسارع: <b>+{Math.round(trend.velocity * 25)}%</b>
                </span>
                <Link
                  href={`/tag/${encodeURIComponent(cleanTag)}`}
                  className="hashtag-link"
                  title={`تصفح تغطيات ${trend.topic}`}
                >
                  تصفح الأخبار ›
                </Link>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
