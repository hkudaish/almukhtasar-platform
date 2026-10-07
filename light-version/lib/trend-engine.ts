import { normalizeArabic } from "./content-policy";
import type { Article, SocialPost, TrendTopic, DailyBrief } from "@/types/news";
import {
  database as db,
  insertSocialPost,
  listSocialPosts,
  upsertTrend,
  listTrends,
  saveDailyBrief,
  getDailyBrief
} from "@/database/database";

export interface TrendCalculationParams {
  corroborationWeight?: number; // W_c (default 25.0)
  xEngagementWeight?: number;   // W_x (default 15.0)
  igEngagementWeight?: number;  // W_ig (default 12.0)
  velocityWeight?: number;      // W_v (default 20.0)
  gravity?: number;             // gamma (default 1.6)
  sourceReliabilityBonus?: number; // R_source (1.0 to 1.5)
}

/**
 * Calculates trend score according to Almokhtasar's multi-signal formula:
 * Score = [ W_c * ln(1 + C_sources) + W_x * ln(1 + Eng_X) + W_ig * ln(1 + Eng_IG) + W_v * Velocity ]
 *         / (Age_hours + 1.5)^gamma * R_source
 */
export function calculateTrendScore(
  signals: {
    sourceCount: number;
    xEngagement: number;
    igEngagement: number;
    velocity: number;
    publishedAt: string | Date;
    sourceReliability?: number;
  },
  params: TrendCalculationParams = {}
): number {
  const {
    corroborationWeight = 25.0,
    xEngagementWeight = 15.0,
    igEngagementWeight = 12.0,
    velocityWeight = 20.0,
    gravity = 1.6,
    sourceReliabilityBonus = 1.0,
  } = params;

  const now = Date.now();
  const pubTime = typeof signals.publishedAt === "string" ? Date.parse(signals.publishedAt) : signals.publishedAt.getTime();
  const ageHours = Math.max(0.1, (now - pubTime) / 3600000);

  const cScore = corroborationWeight * Math.log(1 + Math.max(0, signals.sourceCount));
  const xScore = xEngagementWeight * Math.log(1 + Math.max(0, signals.xEngagement));
  const igScore = igEngagementWeight * Math.log(1 + Math.max(0, signals.igEngagement));
  const vScore = velocityWeight * Math.max(0, signals.velocity);

  const rawScore = cScore + xScore + igScore + vScore;
  const timeDecay = Math.pow(ageHours + 1.5, gravity);
  const reliability = signals.sourceReliability || sourceReliabilityBonus;

  const finalScore = (rawScore / timeDecay) * reliability;
  return Math.round(finalScore * 10) / 10;
}

/**
 * Normalizes hashtag (removes '#' and normalizes Arabic)
 */
export function normalizeHashtag(tag: string): string {
  return tag.replace(/^[#＃]/, "").replace(/_/g, " ").trim();
}

/**
 * Extracts hashtags from text
 */
export function extractHashtags(text: string): string[] {
  const matches = text.match(/#([\p{L}\p{N}_]+)/gu);
  if (!matches) return [];
  return [...new Set(matches.map((m) => m.replace(/^#/, "").trim()))].filter(Boolean);
}

/**
 * Aggregates topics from recent news and social posts, calculates velocities and scores,
 * and updates the `trends` table in the database.
 */
export function syncTrendEngine(): {
  analyzedArticles: number;
  analyzedSocialPosts: number;
  updatedTrends: number;
} {
  const now = new Date().toISOString();
  const cutoff = new Date(Date.now() - 48 * 3600000).toISOString();

  // 1. Fetch recent articles
  const articles = db.prepare(`
    SELECT id, title, main_category, tags, keyphrases, source_published_at, view_count, share_count, priority_score
    FROM articles
    WHERE publication_status = 'published' AND source_published_at >= ?
    ORDER BY source_published_at DESC
  `).all(cutoff) as Array<Record<string, unknown>>;

  // 2. Fetch recent social posts
  const socialPosts = listSocialPosts({ limit: 100 });

  // 3. Cluster into topics/hashtags
  const topicMap = new Map<string, {
    topic: string;
    slug: string;
    category: string;
    sources: Set<string>;
    articles: string[];
    socialPosts: string[];
    xEngagement: number;
    igEngagement: number;
    firstPublished: string;
    latestPublished: string;
  }>();

  // Cluster from articles
  for (const art of articles) {
    const title = String(art.title);
    const category = String(art.main_category);
    const tags: string[] = typeof art.tags === "string" ? JSON.parse(art.tags || "[]") : (art.tags as string[] || []);
    const pubDate = String(art.source_published_at);
    const artId = String(art.id);

    // Group candidates from title keywords and tags
    const candidates = tags.slice(0, 3);
    for (const cand of candidates) {
      if (!cand || cand.length < 3) continue;
      const key = normalizeArabic(cand);
      if (!topicMap.has(key)) {
        topicMap.set(key, {
          topic: cand,
          slug: `trend-${encodeURIComponent(key.replace(/\s+/g, "-"))}`,
          category,
          sources: new Set(),
          articles: [],
          socialPosts: [],
          xEngagement: 0,
          igEngagement: 0,
          firstPublished: pubDate,
          latestPublished: pubDate,
        });
      }
      const entry = topicMap.get(key)!;
      entry.articles.push(artId);
      entry.sources.add(artId);
      if (Date.parse(pubDate) < Date.parse(entry.firstPublished)) entry.firstPublished = pubDate;
      if (Date.parse(pubDate) > Date.parse(entry.latestPublished)) entry.latestPublished = pubDate;
    }
  }

  // Cluster from social posts
  for (const post of socialPosts) {
    const postTags = post.hashtags || extractHashtags(post.content);
    for (const tag of postTags) {
      const cleanTag = normalizeHashtag(tag);
      const key = normalizeArabic(cleanTag);
      if (!topicMap.has(key)) {
        topicMap.set(key, {
          topic: `#${cleanTag}`,
          slug: `tag-${encodeURIComponent(key.replace(/\s+/g, "-"))}`,
          category: "منصات",
          sources: new Set(),
          articles: [],
          socialPosts: [],
          xEngagement: 0,
          igEngagement: 0,
          firstPublished: post.publishedAt,
          latestPublished: post.publishedAt,
        });
      }
      const entry = topicMap.get(key)!;
      entry.socialPosts.push(post.id);
      if (post.platform === "x") {
        entry.xEngagement += (post.likesCount * 0.5 + post.repostsCount * 2.0 + post.repliesCount);
      } else {
        entry.igEngagement += (post.likesCount * 0.5 + post.repliesCount * 2.0 + post.viewsCount * 0.1);
      }
      if (Date.parse(post.publishedAt) < Date.parse(entry.firstPublished)) entry.firstPublished = post.publishedAt;
      if (Date.parse(post.publishedAt) > Date.parse(entry.latestPublished)) entry.latestPublished = post.publishedAt;
    }
  }

  let updatedCount = 0;

  // 4. Calculate trend scores and save to DB
  for (const [key, cluster] of topicMap.entries()) {
    const sourceCount = cluster.articles.length;
    const socialCount = cluster.socialPosts.length;
    const totalMentions = sourceCount + socialCount;

    if (totalMentions < 1) continue;

    // Velocity: mentions per 6 hours window
    const ageHours = Math.max(1, (Date.now() - Date.parse(cluster.firstPublished)) / 3600000);
    const velocity = Math.round((totalMentions / ageHours) * 10) / 10;

    const trendScore = calculateTrendScore({
      sourceCount,
      xEngagement: cluster.xEngagement,
      igEngagement: cluster.igEngagement,
      velocity,
      publishedAt: cluster.latestPublished,
      sourceReliability: sourceCount >= 2 ? 1.3 : 1.0,
    });

    const isHashtag = cluster.topic.startsWith("#");

    upsertTrend({
      topic: cluster.topic,
      slug: cluster.slug,
      type: isHashtag ? "hashtag" : "story",
      platform: cluster.socialPosts.length && !cluster.articles.length ? "x" : "all",
      mentionCount: totalMentions,
      sourceCount: Math.max(1, sourceCount),
      xEngagement: Math.round(cluster.xEngagement),
      igEngagement: Math.round(cluster.igEngagement),
      velocity,
      trendScore,
      category: cluster.category,
      relatedArticleIds: cluster.articles.slice(0, 10),
      relatedSocialPostIds: cluster.socialPosts.slice(0, 10),
      firstDetectedAt: cluster.firstPublished,
      peakAt: cluster.latestPublished,
      isActive: true,
    });

    updatedCount++;
  }

  return {
    analyzedArticles: articles.length,
    analyzedSocialPosts: socialPosts.length,
    updatedTrends: updatedCount,
  };
}

/**
 * Generates and stores the daily AI executive brief («مختصر اليوم»)
 */
export function generateDailyBrief(): DailyBrief {
  const today = new Date().toISOString().split("T")[0];
  const existing = getDailyBrief(today);
  if (existing) return existing;

  const topTrends = listTrends({ limit: 5 });
  const topArticles = db.prepare(`
    SELECT id, slug, title, main_category, source_name, priority_score, canonical_url, source_published_at
    FROM articles
    WHERE publication_status = 'published' AND source_published_at >= datetime('now', '-24 hours')
    ORDER BY priority_score DESC, (view_count + share_count * 2) DESC
    LIMIT 5
  `).all() as Array<Record<string, unknown>>;

  const topStories = topArticles.map((a) => ({
    id: String(a.id),
    slug: String(a.slug || `news-${a.id}`),
    title: String(a.title),
    category: String(a.main_category),
    sourceName: String(a.source_name),
    trendScore: Number(a.priority_score || 80),
    url: String(a.canonical_url || `/news/${a.slug || a.id}`),
    publishedAt: String(a.source_published_at || new Date().toISOString()),
  }));

  const dominantCategory = topStories[0]?.category || "أخبار السعودية";
  const topHashtag = topTrends.find((t) => t.type === "hashtag")?.topic || "#المختصر";

  const summary = topStories.length
    ? `أبرز مجريات اليوم الإخبارية: تصدر قطاع ${dominantCategory} اهتمامات المتابعين في المملكة والمنطقة، مع تغطية متسارعة لمستجدات ${topStories[0]?.title || "الأحداث الرئيسية"} وارتفاع التفاعل الرقمي حول ${topHashtag}.`
    : "ملخص يومي لأهم الأخبار والقصص المتداولة في المملكة والمنطقة عبر منصات الإعلام والتواصل الاجتماعي.";

  const brief: DailyBrief = {
    id: `brief-${today}`,
    date: today,
    title: `مختصر اليوم — ${today}`,
    summary,
    topStories,
    stats: {
      totalArticles: topArticles.length,
      trendingCount: topTrends.length,
      topHashtag,
      dominantCategory,
    },
    publishedAt: new Date().toISOString(),
  };

  saveDailyBrief(brief);
  return brief;
}
