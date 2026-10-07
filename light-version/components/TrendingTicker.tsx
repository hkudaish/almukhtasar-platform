"use client";

import Link from "next/link";
import { useRef } from "react";
import type { TrendTopic } from "@/types/news";

export default function TrendingTicker({ trends }: { trends: TrendTopic[] }) {
  const scrollRef = useRef<HTMLDivElement>(null);

  if (!trends || trends.length === 0) return null;

  const scroll = (direction: "left" | "right") => {
    if (!scrollRef.current) return;
    const offset = direction === "left" ? -240 : 240;
    scrollRef.current.scrollBy({ left: offset, behavior: "smooth" });
  };

  return (
    <section className="trending-ticker-bar" aria-label="المواضيع المتداولة الآن">
      <div className="container trending-ticker-shell">
        <Link href="/trends" className="trending-ticker-badge" title="عرض كافة مؤشرات الترند">
          <span aria-hidden="true">🔥</span>
          <span>الترند الآن</span>
        </Link>

        <div className="trending-ticker-scroll" ref={scrollRef}>
          {trends.map((trend) => {
            const isHashtag = trend.topic.startsWith("#");
            const cleanTag = trend.topic.replace(/^#/, "");
            const href = isHashtag
              ? `/tag/${encodeURIComponent(cleanTag)}`
              : `/trends?topic=${encodeURIComponent(trend.topic)}`;

            return (
              <Link
                key={trend.id}
                href={href}
                className="trending-chip"
                title={`${trend.topic} — رصيد التداول: ${Math.round(trend.trendScore)}`}
              >
                <span className="chip-topic">{trend.topic}</span>
                {trend.velocity > 0 ? (
                  <span className="chip-velocity" aria-label={`معدل التسارع ${trend.velocity}`}>
                    ▲ +{Math.round(trend.velocity * 20)}%
                  </span>
                ) : null}
                <span className="chip-platform" aria-hidden="true">
                  {trend.platform === "x" ? "𝕏" : trend.platform === "instagram" ? "📸" : "📰"}
                </span>
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}
