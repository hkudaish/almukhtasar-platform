"use client";

import { useState } from "react";
import NewsImage from "@/components/NewsImage";
import PostVideoPlayer from "@/components/PostVideoPlayer";
import type { SocialPost } from "@/types/news";

export default function SocialStreamSection({
  initialPosts = [],
}: {
  initialPosts: SocialPost[];
}) {
  const [activeTab, setActiveTab] = useState<"all" | "x" | "instagram">("all");

  const filteredPosts = initialPosts.filter((post) => {
    if (activeTab === "all") return true;
    return post.platform === activeTab;
  });

  if (!initialPosts || initialPosts.length === 0) return null;

  return (
    <section className="social-stream-section" aria-labelledby="social-stream-title">
      <div className="section-head">
        <div className="section-head-title">
          <span className="icon" aria-hidden="true">⚡</span>
          <h2 id="social-stream-title">نبض المنصات والأكثر تفاعلاً</h2>
        </div>
        <span className="text-muted" style={{ fontSize: "12px", color: "var(--muted)" }}>
          تحديث تلقائي للمنشورات الأكثر رواجاً
        </span>
      </div>

      <div className="social-tabs-nav" role="tablist" aria-label="منصات التواصل">
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "all"}
          className={`social-tab-btn ${activeTab === "all" ? "active" : ""}`}
          onClick={() => setActiveTab("all")}
        >
          <span>🔥 جميع المنصات</span>
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "x"}
          className={`social-tab-btn x-tab ${activeTab === "x" ? "active" : ""}`}
          onClick={() => setActiveTab("x")}
        >
          <span>𝕏 ترند إكس</span>
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "instagram"}
          className={`social-tab-btn ig-tab ${activeTab === "instagram" ? "active" : ""}`}
          onClick={() => setActiveTab("instagram")}
        >
          <span>📸 ترند إنستغرام</span>
        </button>
      </div>

      <div className="social-posts-grid">
        {filteredPosts.slice(0, 4).map((post) => {
          const isX = post.platform === "x";
          const mediaUrl = post.mediaUrls?.[0] || post.thumbnailUrl;

          return (
            <article key={post.id} className="social-card">
              <div>
                <header className="social-card-head">
                  <div className="social-author-info">
                    <div className="social-author-avatar">
                      {post.authorAvatarUrl ? (
                        <NewsImage
                          src={post.authorAvatarUrl}
                          alt={post.authorName}
                          width={42}
                          height={42}
                          fallbackSrc="/images/placeholder.svg"
                          category="منصات"
                          style={{ borderRadius: "50%", objectFit: "cover" }}
                        />
                      ) : (
                        <span>{post.authorName ? post.authorName.charAt(0) : "𝕏"}</span>
                      )}
                    </div>
                    <div className="social-author-meta">
                      <span className="social-author-name">
                        {post.authorName}
                        {post.authorVerified ? (
                          <span className="verified-icon" title="حساب موثق" aria-label="موثق">
                            ✓
                          </span>
                        ) : null}
                      </span>
                      <span className="social-author-handle">
                        {isX ? `@${post.authorUsername}` : post.authorUsername}
                      </span>
                      {post.publishedAt ? (
                        <time dateTime={post.publishedAt} style={{ fontSize: "10px", color: "var(--muted)", display: "block", marginTop: "2px" }}>
                          نُشر: {new Date(post.publishedAt).toLocaleString("ar-SA", {
                            timeZone: "Asia/Riyadh",
                            day: "numeric",
                            month: "short",
                            hour: "numeric",
                            minute: "2-digit",
                          })}
                        </time>
                      ) : null}
                    </div>
                  </div>

                  <span
                    className={`social-platform-badge ${isX ? "x-badge" : "ig-badge"}`}
                    aria-label={isX ? "منصة إكس" : "منصة إنستغرام"}
                  >
                    {isX ? "𝕏" : "Instagram"}
                  </span>
                </header>

                <p className="social-card-text">{post.content}</p>

                {mediaUrl ? (
                  <div className="social-card-media">
                    {post.mediaType === "video" ? (
                      <PostVideoPlayer
                        videoUrl={post.videoUrl || mediaUrl}
                        posterUrl={post.thumbnailUrl || mediaUrl}
                        alt={post.content.slice(0, 50)}
                        category="منصات"
                        title={post.content.slice(0, 40)}
                      />
                    ) : (
                      <>
                        <NewsImage
                          src={mediaUrl}
                          alt={post.content.slice(0, 50)}
                          width={500}
                          height={260}
                          loading="lazy"
                          category="منصات"
                          fallbackSrc="/api/media/fallback/منصات"
                          style={{ objectFit: "cover", width: "100%", height: "100%" }}
                        />
                        {post.mediaType === "album" ? (
                          <span className="media-type-tag">📷 ألبوم صور</span>
                        ) : null}
                      </>
                    )}
                  </div>
                ) : null}

                {post.hashtags && post.hashtags.length > 0 ? (
                  <div className="social-card-hashtags">
                    {post.hashtags.map((tag, i) => (
                      <a
                        key={i}
                        href={`/tag/${encodeURIComponent(tag.replace(/^#/, ""))}`}
                        title={`أخبار ووسم ${tag}`}
                      >
                        {tag.startsWith("#") ? tag : `#${tag}`}
                      </a>
                    ))}
                  </div>
                ) : null}
              </div>

              <footer className="social-card-footer">
                <div className="social-stats-group">
                  {post.repostsCount > 0 ? (
                    <span className="social-stat-item" title="إعادة النشر">
                      <span className="icon">🔁</span>
                      <span>{post.repostsCount.toLocaleString("ar-SA")}</span>
                    </span>
                  ) : null}

                  {post.likesCount > 0 ? (
                    <span className="social-stat-item" title="الإعجابات">
                      <span className="icon">❤️</span>
                      <span>{post.likesCount.toLocaleString("ar-SA")}</span>
                    </span>
                  ) : null}

                  {post.repliesCount > 0 ? (
                    <span className="social-stat-item" title="الردود والتعليقات">
                      <span className="icon">💬</span>
                      <span>{post.repliesCount.toLocaleString("ar-SA")}</span>
                    </span>
                  ) : null}
                </div>

                <a
                  href={post.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="social-link-btn"
                >
                  فتح المنشور الأصلي ↗
                </a>
              </footer>
            </article>
          );
        })}
      </div>
    </section>
  );
}
