import type { SiteSettings } from "@/types/news";

export const DEFAULT_CATEGORIES=[
  "أخبار السعودية","المناطق","الاقتصاد","المجتمع","الصحة","التعليم","الرياضة","التقنية","الذكاء الاصطناعي",
  "السفر","السيارات","الثقافة","السياسة","الطاقة والصناعة","البيئة والمناخ","الوظائف وسوق العمل","العالم"
];

export const DEFAULT_SETTINGS:SiteSettings={
  siteName:"المختصر",tagline:"الأخبار اليومية .. باختصار",timezone:"Asia/Riyadh",
  homepageCategories:DEFAULT_CATEGORIES,hiddenCategories:[],priorityCategories:["أخبار السعودية","السياسة","الاقتصاد"],
  desktopCount:6,tabletCount:5,mobileCount:4,showTime:true,showBadges:true,
  breakingHours:12,homepageHours:48,categoryHours:48,latestDays:3,recentDays:7,archiveDays:8,
  minimumFreshHomepagePosts:20,minimumFreshPriorityPosts:3,minimumValidatedReservePosts:10,recoveryDays:30,
  maxHomepageItemsPerCategory:3,recencyWeight:22,saudiRelevanceWeight:20,breakingNewsWeight:16,sourceQualityWeight:10,publicImpactWeight:13,officialSourceWeight:9,corroborationWeight:4,
  categoryPriorityWeights:{"أخبار السعودية":12,"المناطق":10,"الاقتصاد":8,"المجتمع":6,"الصحة":7,"التعليم":7,"الرياضة":5,"التقنية":4,"الذكاء الاصطناعي":4,"العالم":3}
};

export const PIPELINE_QUEUES=[
  "source-discovery","article-hydration","image-resolution","content-validation","duplicate-check",
  "classification","summarization","publication","archive","cache-refresh"
] as const;
