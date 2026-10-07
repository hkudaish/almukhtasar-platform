import Header from "@/components/Header";
import Footer from "@/components/Footer";
import SocialStreamSection from "@/components/SocialStreamSection";
import TrendingNewsStoriesSection from "@/components/TrendingNewsStoriesSection";
import SocialHashtagsSection from "@/components/SocialHashtagsSection";
import {
  getSettings,
  listTrends,
  listSocialPosts,
  listTrendingNewsArticles,
} from "@/database/database";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "الترند والمنصات المتداولة | المختصر",
  description: "رصد وتصنيف منفصل للأخبار المتداولة الأكثر قراءة ووسوم وترند شبكات التواصل الاجتماعي (إكس وإنستغرام).",
};

export default function TrendsPage() {
  const settings = getSettings();
  const allTrends = listTrends({ limit: 60, platform: "all" });
  const allSocial = listSocialPosts({ limit: 30, platform: "all" });
  const trendingNews = listTrendingNewsArticles(8);

  // Categorize trending items separately:
  // 1. Social platform hashtags (starting with # or type: 'hashtag')
  // 2. Verified news stories and editorial topics
  const hashtagTrends = allTrends.filter((t) => t.type === "hashtag" || t.topic.startsWith("#"));
  const newsStoryTopics = allTrends.filter((t) => t.type !== "hashtag" && !t.topic.startsWith("#"));

  return (
    <>
      <Header />
      <main id="main-content" className="listing-page trends-page">
        <div className="container">
          <header className="listing-title trends-hero">
            <span className="trends-hero-kicker">رصد تحليلي مصنّف</span>
            <h1>الترند والمنصات المتداولة</h1>
            <p>
              تصنيف دقيق يفصل بين <strong>الأخبار والموضوعات الصحفية المتداولة</strong> عبر المصادر المعتمدة، وبين <strong>وسوم وترند شبكات التواصل الاجتماعي</strong> (إكس وإنستغرام).
            </p>
            <div className="trends-stats-pills">
              <span className="stat-pill">
                📰 <b>{trendingNews.length + newsStoryTopics.length}</b> مادة إخبارية متداولة
              </span>
              <span className="stat-pill">
                📱 <b>{hashtagTrends.length}</b> وسم تواصل نشط
              </span>
              <span className="stat-pill">
                ⚡ رصد فوري: 𝕏 إكس، إنستغرام، الوكالات المعتمدة
              </span>
            </div>
          </header>

          {/* القسم الأول: الأخبار والموضوعات الإخبارية الأكثر تداولاً */}
          <TrendingNewsStoriesSection
            articles={trendingNews}
            topics={newsStoryTopics}
            timezone={settings.timezone}
          />

          {/* القسم الثاني: وسوم وترند شبكات التواصل الاجتماعي */}
          <SocialHashtagsSection hashtags={hashtagTrends} />

          {/* نبض المنشورات المباشرة عبر المنصات */}
          <SocialStreamSection initialPosts={allSocial} />
        </div>
      </main>
      <Footer />
    </>
  );
}
