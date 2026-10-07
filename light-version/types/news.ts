export type PublicationStatus="draft"|"review"|"published"|"rejected";
export type ArchiveStatus="current"|"recent"|"archived";
export type SourceHealth="Healthy"|"Degraded"|"Failing"|"Paused"|"Misconfigured"|"Rate limited";
export type RetrievalMethod="api"|"rss"|"atom"|"sitemap"|"jsonld"|"html"|"dynamic";
export type QueueName="source-discovery"|"article-hydration"|"image-resolution"|"content-validation"|"duplicate-check"|"classification"|"summarization"|"publication"|"archive"|"cache-refresh";
export type GeographicRelevance="saudi_national"|"saudi_region"|"gulf_arab"|"international"|"unspecified";
export type ImportanceLevel="عاجل"|"أولوية قصوى"|"مهم"|"عادي"|"منخفض الأولوية";
export type BreakingDetectionMethod="rss"|"api"|"category"|"metadata"|"source_badge";
export type BreakingEvidence={verified:boolean;detectedBy:BreakingDetectionMethod|null;sourceValue:string};
export type FeaturedImageCandidate={url:string;origin:"og"|"twitter"|"structured"|"featured"|"content"|"api";alt:string;caption:string;credit:string};

export type Article={
  id:string;slug:string;title:string;summary:string;content:string[];category:string;subcategory:string;
  sourceName:string;sourceUrl:string;canonicalUrl:string;author:string;region:string;
  sourcePublishedAt:string;sourceUpdatedAt:string|null;retrievedAt:string;
  imageUrl:string;imageOriginalUrl:string;imageAlt:string;imageCaption:string;imageCredit:string;imageWidth:number|null;imageHeight:number|null;imageStatus:string;
  publicationStatus:PublicationStatus;archiveStatus:ArchiveStatus;badge:string|null;updatedAt:string;
  geographicRelevance:GeographicRelevance;importanceLevel:ImportanceLevel;priorityScore:number;manualPriorityOverride:number|null;homepagePinned:boolean;homepageExcluded:boolean;
  isBreaking:boolean;breakingSource:string;breakingDetectedBy:BreakingDetectionMethod|null;breakingVerifiedAt:string|null;breakingExpiresAt:string|null;
  tags:string[];keyphrases:string[];
  sourceStatus:"Active"|"Updated"|"Removed"|"Unavailable"|"Redirected"|"Temporarily Unreachable";lastSourceCheckAt:string|null;lastSourceHttpStatus:number|null;sourceStatusReason:string;
  freshnessLabel?:"من الأسبوع الماضي"|"من الأرشيف القريب";
};

export type Source={
  id:string;name:string;domain:string;sourceType:string;country:string;language:string;
  reliabilityScore:number;priority:number;status:string;health:SourceHealth;
  apiEndpoint:string;rssEndpoint:string;listingUrl:string;
  sitemapEndpoint:string;region:string;retrievalFrequencyMinutes:number;scheduleEnabled:boolean;
  mainCategories:string[];subcategories:string[];keywords:string[];excludedKeywords:string[];
  retrievalMethod:RetrievalMethod;fallbackMethods:RetrievalMethod[];
  lastSuccessfulFetch:string|null;lastSeenArticleId:string;lastSeenGuid:string;lastSeenUrl:string;
  lastSeenPublishedAt:string|null;lastSeenModifiedAt:string|null;etag:string;lastModified:string;
  automaticPublicationEnabled:boolean;requiresEditorialReview:boolean;
  consecutiveFailures:number;lastError:string;updatedAt:string;
  lastBreakingCheck?:string|null;lastBreakingDetectedAt?:string|null;lastBreakingImportedAt?:string|null;breakingLatencySeconds?:number|null;breakingHealth?:"Healthy"|"Delayed"|"Out of Sync"|"Failed"|"Rate Limited";
};

export type DiscoveredArticle={
  sourceId:string;sourceArticleId:string;guid:string;url:string;title:string;publishedAt:string|null;modifiedAt?:string|null;
  breakingEvidence?:BreakingEvidence;
};

export type HydratedArticle=DiscoveredArticle&{
  title:string;body:string[];imageUrl:string;imageAlt:string;imageCaption:string;imageCredit:string;imageCandidates:FeaturedImageCandidate[];publishedAt:string|null;modifiedAt:string|null;
  author:string;sourceName:string;canonicalUrl:string;structuredMetadata:Record<string,unknown>;
};

export type SiteSettings={
  siteName:string;tagline:string;timezone:string;homepageCategories:string[];hiddenCategories:string[];priorityCategories:string[];
  desktopCount:number;tabletCount:number;mobileCount:number;showTime:boolean;showBadges:boolean;
  breakingHours:number;homepageHours:number;categoryHours:number;latestDays:number;recentDays:number;archiveDays:number;
  minimumFreshHomepagePosts:number;minimumFreshPriorityPosts:number;minimumValidatedReservePosts:number;recoveryDays:number;
  maxHomepageItemsPerCategory:number;recencyWeight:number;saudiRelevanceWeight:number;breakingNewsWeight:number;sourceQualityWeight:number;publicImpactWeight:number;officialSourceWeight:number;corroborationWeight:number;categoryPriorityWeights:Record<string,number>;
};

export type SocialPlatform = "x" | "instagram" | "news";

export type SocialPost = {
  id: string;
  platform: "x" | "instagram";
  postId: string;
  authorUsername: string;
  authorName: string;
  authorAvatarUrl: string;
  authorVerified: boolean;
  content: string;
  url: string;
  publishedAt: string;
  mediaType: "text" | "image" | "video" | "album";
  mediaUrls: string[];
  thumbnailUrl: string;
  likesCount: number;
  repostsCount: number;
  repliesCount: number;
  viewsCount: number;
  engagementScore: number;
  trendScore: number;
  hashtags: string[];
  language: string;
  sentiment: "positive" | "negative" | "neutral";
  status: "published" | "hidden" | "flagged";
  articleId?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type TrendTopic = {
  id: string;
  topic: string;
  slug: string;
  type: "story" | "hashtag" | "keyword";
  platform: "all" | "news" | "x" | "instagram";
  mentionCount: number;
  sourceCount: number;
  xEngagement: number;
  igEngagement: number;
  velocity: number;
  trendScore: number;
  summary: string;
  category: string;
  relatedArticleIds: string[];
  relatedSocialPostIds: string[];
  firstDetectedAt: string;
  peakAt: string;
  lastUpdatedAt: string;
  isActive: boolean;
};

export type DailyBrief = {
  id: string;
  date: string;
  title: string;
  summary: string;
  topStories: Array<{
    id: string;
    slug?: string;
    title: string;
    category: string;
    sourceName: string;
    trendScore: number;
    url: string;
    publishedAt?: string;
  }>;
  stats: {
    totalArticles: number;
    trendingCount: number;
    topHashtag: string;
    dominantCategory: string;
  };
  publishedAt: string;
};

