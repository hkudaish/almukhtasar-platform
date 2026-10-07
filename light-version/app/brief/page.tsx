import Header from "@/components/Header";
import Footer from "@/components/Footer";
import Link from "next/link";
import { getDailyBrief, getSettings } from "@/database/database";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "مختصر اليوم | التقرير الإخباري اليومي",
  description: "ملخص يومي تنفيذي يجمع أبرز أحداث ومستجدات الساحة السعودية والإقليمية في دقائق معدودة.",
};

export default function BriefPage() {
  const settings = getSettings();
  const brief = getDailyBrief();

  const formattedDate = brief
    ? new Intl.DateTimeFormat("ar-SA", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      }).format(new Date(brief.date || brief.publishedAt))
    : "";

  return (
    <>
      <Header />
      <main id="main-content" className="listing-page">
        <div className="container" style={{ maxWidth: "860px" }}>
          <header className="listing-title">
            <span>الموجز التنفيذي الذكي</span>
            <h1>مختصر اليوم</h1>
            <p>
              تحليل شامل لأهم الأخبار والملفات المتداولة يختصر يومك الإخباري بدقة وموثوقية.
            </p>
          </header>

          {brief ? (
            <article
              style={{
                background: "var(--surface)",
                border: "1px solid var(--line)",
                borderRadius: "16px",
                padding: "28px",
                boxShadow: "var(--shadow)",
                marginBottom: "32px",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  borderBottom: "1px solid var(--line)",
                  paddingBottom: "16px",
                  marginBottom: "20px",
                }}
              >
                <div>
                  <h2 style={{ fontSize: "22px", margin: "0 0 6px", color: "var(--navy)" }}>
                    {brief.title}
                  </h2>
                  <time style={{ color: "var(--muted)", fontSize: "13px" }}>
                    📅 {formattedDate}
                  </time>
                </div>

                <span
                  style={{
                    background: "rgba(36, 168, 230, 0.12)",
                    color: "#24a8e6",
                    fontWeight: "800",
                    padding: "4px 12px",
                    borderRadius: "999px",
                    fontSize: "12px",
                  }}
                >
                  ✓ موجز معتمد
                </span>
              </div>

              <div
                style={{
                  fontSize: "16px",
                  lineHeight: "2",
                  color: "var(--text)",
                  marginBottom: "24px",
                  background: "var(--surface-2)",
                  padding: "18px 20px",
                  borderRadius: "12px",
                  borderRight: "4px solid #24a8e6",
                }}
              >
                {brief.summary}
              </div>

              {brief.stats ? (
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                    gap: "12px",
                    marginBottom: "28px",
                  }}
                >
                  <div
                    style={{
                      background: "var(--surface-2)",
                      padding: "14px",
                      borderRadius: "10px",
                      border: "1px solid var(--line)",
                    }}
                  >
                    <small style={{ color: "var(--muted)", display: "block", fontSize: "11px" }}>
                      الوسم الأبرز تفاعلاً
                    </small>
                    <strong style={{ fontSize: "16px", color: "var(--navy)" }}>
                      {brief.stats.topHashtag || "—"}
                    </strong>
                  </div>

                  <div
                    style={{
                      background: "var(--surface-2)",
                      padding: "14px",
                      borderRadius: "10px",
                      border: "1px solid var(--line)",
                    }}
                  >
                    <small style={{ color: "var(--muted)", display: "block", fontSize: "11px" }}>
                      القطاع الأكثر نشاطاً
                    </small>
                    <strong style={{ fontSize: "16px", color: "var(--navy)" }}>
                      {brief.stats.dominantCategory || "—"}
                    </strong>
                  </div>

                  <div
                    style={{
                      background: "var(--surface-2)",
                      padding: "14px",
                      borderRadius: "10px",
                      border: "1px solid var(--line)",
                    }}
                  >
                    <small style={{ color: "var(--muted)", display: "block", fontSize: "11px" }}>
                      الأخبار المرصودة في الرادار
                    </small>
                    <strong style={{ fontSize: "16px", color: "var(--navy)" }}>
                      {brief.stats.totalArticles || 0} خبر
                    </strong>
                  </div>
                </div>
              ) : null}

              <h3 style={{ fontSize: "18px", margin: "0 0 14px", color: "var(--navy)" }}>
                أبرز القصص الإخبارية في هذا الموجز:
              </h3>

              <div style={{ display: "grid", gap: "12px" }}>
                {brief.topStories.map((story, i) => (
                  <Link
                    key={story.id || i}
                    href={`/news/${encodeURIComponent(story.slug || story.id)}`}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "14px",
                      padding: "12px 16px",
                      background: "var(--surface)",
                      border: "1px solid var(--line)",
                      borderRadius: "10px",
                      textDecoration: "none",
                      transition: "transform 0.15s ease",
                    }}
                  >
                    <span
                      style={{
                        width: "32px",
                        height: "32px",
                        borderRadius: "50%",
                        background: "#11181e",
                        color: "#fff",
                        display: "grid",
                        placeItems: "center",
                        fontSize: "14px",
                        fontWeight: "800",
                        flexShrink: 0,
                      }}
                    >
                      {i + 1}
                    </span>
                    <div style={{ flex: 1 }}>
                      <strong style={{ fontSize: "14px", color: "var(--text)", display: "block" }}>
                        {story.title}
                      </strong>
                      <small style={{ color: "var(--muted)", fontSize: "11px", display: "flex", gap: "6px", alignItems: "center", flexWrap: "wrap", marginTop: "3px" }}>
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
                      </small>
                    </div>
                    <span style={{ color: "#24a8e6", fontWeight: "700", fontSize: "14px" }}>
                      ‹
                    </span>
                  </Link>
                ))}
              </div>
            </article>
          ) : (
            <p className="empty-section">
              جاري توليد التقرير اليومي بالذكاء الاصطناعي... يُرجى العودة بعد قليل.
            </p>
          )}
        </div>
      </main>
      <Footer />
    </>
  );
}
