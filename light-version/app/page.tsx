import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { HomeHero, HomeSideStory } from "@/components/HomeNewsCard";
import HomeMoreNews from "@/components/HomeMoreNews";
import CategoryRibbon from "@/components/CategoryRibbon";
import TrendingTicker from "@/components/TrendingTicker";
import DailyBriefWidget from "@/components/DailyBriefWidget";
import MostCirculatedSection from "@/components/MostCirculatedSection";
import SocialStreamSection from "@/components/SocialStreamSection";
import {
  getSettings,
  listBreakingArticles,
  listCurrentArticles,
  listHomepageMoreArticles,
  listHomepagePriorityArticles,
  listTrends,
  getDailyBrief,
  listTrendingNewsArticles,
  listSocialPosts,
} from "@/database/database";

export const dynamic = "force-dynamic";

export default function HomePage() {
  const settings = getSettings();
  const current = listCurrentArticles(1, 40);
  const breaking = listBreakingArticles(4);
  const priority = listHomepagePriorityArticles(5);
  const recentAvailable = listHomepageMoreArticles(undefined, 1).data.length > 0;
  const categories = settings.homepageCategories.filter(
    (category) => !settings.hiddenCategories.includes(category)
  );

  const featured = priority.length ? priority : current.data.slice(0, 5);
  const [lead, ...sideStories] = featured;
  const featuredIds = new Set(featured.map((article) => article.id));
  const allNews = current.data.filter((article) => !featuredIds.has(article.id));

  // Retrieve multi-signal trends, daily brief, and social feeds
  const trends = listTrends({ limit: 12, platform: "all" });
  const dailyBrief = getDailyBrief();
  const circulatedArticles = listTrendingNewsArticles(4);
  const socialPosts = listSocialPosts({ limit: 8, platform: "all" });

  return (
    <>
      <Header homepage />
      <TrendingTicker trends={trends} />
      <main id="main-content" className="home-page sabq-home">
        <CategoryRibbon categories={categories} showBreaking={breaking.length > 0} />
        <div className="container home-content">
          {breaking.length ? (
            <section className="breaking-home-section" aria-labelledby="breaking-home-title">
              <header>
                <div>
                  <h2 id="breaking-home-title">الأخبار العاجلة</h2>
                  <p>مصنفة عاجلة من مصادرها الأصلية وموثقة على مدار الساعة</p>
                </div>
                <a href={`/category/${encodeURIComponent("الأخبار العاجلة")}`}>عرض الكل</a>
              </header>
              <div className="home-side-list">
                {breaking.map((article, index) => (
                  <HomeSideStory
                    key={article.id}
                    article={article}
                    index={index}
                    timezone={settings.timezone}
                  />
                ))}
              </div>
            </section>
          ) : null}

          {dailyBrief ? <DailyBriefWidget brief={dailyBrief} /> : null}

          {lead ? (
            <section className="home-lead" aria-label="أبرز الأخبار">
              <HomeHero article={lead} timezone={settings.timezone} />
              <div className="home-side-list">
                {sideStories.map((article, index) => (
                  <HomeSideStory
                    key={article.id}
                    article={article}
                    index={index}
                    timezone={settings.timezone}
                  />
                ))}
              </div>
            </section>
          ) : (
            <p className="empty-section">
              لا توجد أخبار صالحة ضمن نافذة الأيام السبعة الحالية. يعمل مجدول السيرفر على استكمال التغطية في الخلفية.
            </p>
          )}

          {circulatedArticles.length > 0 ? (
            <MostCirculatedSection articles={circulatedArticles} timezone={settings.timezone} />
          ) : null}

          {socialPosts.length > 0 ? (
            <SocialStreamSection initialPosts={socialPosts} />
          ) : null}

          {current.data.length || recentAvailable ? (
            <section className="home-all-news" aria-labelledby="all-news-title">
              <header>
                <span className="home-section-icon" aria-hidden="true">
                  ▤
                </span>
                <div>
                  <h1 id="all-news-title">أحدث الأخبار</h1>
                  <p>تسلسل زمني وفق وقت النشر الأصلي من جميع التصنيفات</p>
                </div>
              </header>
              <HomeMoreNews
                initialArticles={allNews}
                initialCursor={
                  current.data.at(-1)
                    ? {
                        sourcePublishedAt: current.data.at(-1)!.sourcePublishedAt,
                        id: current.data.at(-1)!.id,
                      }
                    : null
                }
                timezone={settings.timezone}
              />
            </section>
          ) : null}
        </div>
      </main>
      <Footer />
    </>
  );
}
