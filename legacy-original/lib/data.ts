export type Story = {
  id: string;
  title: string;
  summary: string;
  category: string;
  subcategory?: string;
  time: string;
  publishedAt: string;
  readTime: string;
  source: string;
  sources?: Array<{ name:string; url:string; role:"أساسي"|"داعم"; type:string; publishedAt:string }>;
  confidence: number;
  accent: string;
  featured?: boolean;
  trending?: number;
  tags: string[];
  bullets: string[];
  details?: string[];
  whyItMatters: string;
  expected?: string;
  imageUrl?: string;
  imageAlt?: string;
  imageCredit?: string;
  badge?: "عاجل" | "محدّث";
};

export const categories = [
  "الرئيسية", "السياسة", "الاقتصاد", "المجتمع", "الرياضة", "التقنية",
  "الذكاء الاصطناعي", "الصحة", "الثقافة", "السيارات", "السفر", "التعليم"
];

export const stories: Story[] = [
  {
    id: "ai-public-services",
    title: "جهات خدمية توسّع استخدام الذكاء الاصطناعي لتحسين تجربة المستفيد",
    summary: "تطبيقات جديدة تركز على تسريع الاستجابة وتخصيص الخدمات وتحليل البيانات، مع ضوابط للخصوصية والمراجعة البشرية.",
    category: "الذكاء الاصطناعي", time: "منذ 18 دقيقة", publishedAt: "2026-07-14T18:20:00+03:00", readTime: "3 دقائق",
    source: "مصادر رسمية متعددة", sources:[{name:"وكالة الأنباء السعودية (واس)",url:"https://www.spa.gov.sa",role:"أساسي",type:"وكالة أنباء رسمية",publishedAt:"14 يوليو 2026، 6:20 م"},{name:"قناة الإخبارية السعودية",url:"https://www.alekhbariya.net",role:"داعم",type:"قناة رسمية",publishedAt:"14 يوليو 2026، 6:31 م"}], confidence: 94, accent: "linear-gradient(135deg,#16324f,#0e7490)", featured: true, trending: 98,
    tags: ["الذكاء الاصطناعي", "الخدمات الرقمية", "الخصوصية"],
    bullets: ["توسّع تدريجي في الحلول الذكية داخل الخدمات اليومية.", "التركيز على السرعة والتخصيص وتحسين تجربة المستفيد.", "المراجعة البشرية مطلوبة للقرارات الحساسة."],
    whyItMatters: "قد تختصر هذه الأدوات وقت إنجاز الخدمات، وتزيد في المقابل أهمية الشفافية وحماية البيانات.",
    expected: "تتوسع الجهات تدريجيًا في التجارب التشغيلية، مع نشر ضوابط أوضح للحوكمة وقياس الأثر قبل تعميم الحلول."
  },
  {
    id: "markets-week", title: "الأسواق تترقب بيانات اقتصادية مؤثرة خلال الأسبوع",
    summary: "المستثمرون يراقبون مؤشرات التضخم والنمو وقرارات البنوك المركزية قبل تحديد اتجاهاتهم الجديدة.",
    category: "الاقتصاد", time: "منذ 42 دقيقة", publishedAt: "2026-07-14T17:56:00+03:00", readTime: "2 د", source: "تقارير اقتصادية رسمية", sources:[{name:"الاقتصادية",url:"https://www.aleqt.com",role:"أساسي",type:"صحيفة اقتصادية",publishedAt:"14 يوليو 2026، 5:56 م"},{name:"الشرق للأعمال مع بلومبرغ",url:"https://www.asharqbusiness.com",role:"داعم",type:"مصدر اقتصادي متخصص",publishedAt:"14 يوليو 2026، 6:05 م"}], confidence: 91,
    accent: "linear-gradient(135deg,#3f3cbb,#7158e2)", trending: 92, tags: ["الأسواق", "التضخم", "الاستثمار"],
    bullets: ["بيانات التضخم في صدارة اهتمام المستثمرين.", "الأسواق تتوقع تذبذبًا قصير المدى.", "القرارات المقبلة مرتبطة بوضوح مسار الفائدة."],
    whyItMatters: "حركة المؤشرات قد تنعكس على تكلفة التمويل والادخار وقرارات الاستثمار.",
    expected: "تظل حركة الأسواق مرتبطة بنتائج بيانات التضخم والنمو المقبلة وما ستشير إليه البنوك المركزية بشأن الفائدة."
  },
  {
    id: "health-digital", title: "حلول صحية رقمية توسع خدمات المتابعة عن بُعد",
    summary: "منصات جديدة تعزز الوقاية والمتابعة المستمرة للحالات المزمنة وفق ضوابط خصوصية صحية أوضح.",
    category: "الصحة", time: "منذ ساعة", publishedAt: "2026-07-14T17:35:00+03:00", readTime: "4 د", source: "جهات صحية", sources:[{name:"قناة الإخبارية السعودية",url:"https://www.alekhbariya.net",role:"أساسي",type:"قناة رسمية",publishedAt:"14 يوليو 2026، 5:35 م"}], confidence: 96,
    accent: "linear-gradient(135deg,#047857,#34d399)", trending: 88, tags: ["الصحة الرقمية", "الوقاية", "الطب عن بعد"],
    bullets: ["توسيع المتابعة عن بعد للحالات المزمنة.", "تنبيهات مبكرة تدعم الوقاية.", "القرار الطبي النهائي يبقى للمختص."],
    whyItMatters: "تتيح المتابعة المبكرة تدخلًا أسرع وتخفف الزيارات غير الضرورية.",
    expected: "يتوقع توسيع نطاق المتابعة عن بُعد بعد تقييم النتائج، مع تشديد متطلبات الخصوصية واعتماد الحلول من الجهات الصحية المختصة."
  },
  {
    id: "sports-final", title: "استعدادات مكثفة قبل المواجهة النهائية المرتقبة",
    summary: "الفرق تضع اللمسات الأخيرة وسط اهتمام جماهيري واسع، والاتحاد يعلن الترتيبات التنظيمية للمباراة.",
    category: "الرياضة", time: "منذ ساعتين", publishedAt: "2026-07-14T16:40:00+03:00", readTime: "2 د", source: "الاتحاد الرسمي", sources:[{name:"الرياضية",url:"https://arriyadiyah.com",role:"داعم",type:"صحيفة رياضية",publishedAt:"14 يوليو 2026، 4:40 م"}], confidence: 89,
    accent: "linear-gradient(135deg,#9f1239,#fb7185)", trending: 95, tags: ["رياضة", "المباراة النهائية"],
    bullets: ["اكتمال الاستعدادات الفنية.", "تحديث تعليمات دخول الجماهير.", "مؤتمر صحفي قبل المواجهة."],
    whyItMatters: "المباراة تحظى بمتابعة جماهيرية كبيرة وتتطلب معرفة التعليمات التنظيمية المحدثة.",
    expected: "تُعلن القوائم النهائية والتعليمات التنظيمية وأي تغييرات في مواعيد الدخول عبر حسابات الاتحاد والأندية الرسمية قبل المباراة."
  },
  {
    id: "travel-season", title: "وجهات قريبة تتصدر خيارات السفر القصير هذا الموسم",
    summary: "الإقبال يتجه نحو الرحلات المرنة والتجارب المحلية منخفضة التكلفة مع نمو الحجوزات القصيرة.",
    category: "السفر", time: "أمس", publishedAt: "2026-07-13T15:30:00+03:00", readTime: "3 د", source: "تقارير سياحية", confidence: 87,
    accent: "linear-gradient(135deg,#b45309,#fbbf24)", trending: 76, tags: ["السفر", "السياحة", "الحجوزات"],
    bullets: ["ارتفاع الطلب على الرحلات القصيرة.", "المرونة عامل أساسي في الحجز.", "التجارب المحلية تستقطب مزيدًا من المسافرين."],
    whyItMatters: "يساعد فهم اتجاهات الطلب في اختيار توقيت وتكلفة أفضل للرحلة.",
    expected: "قد ترتفع أسعار الحجوزات القصيرة مع اقتراب فترات الذروة، فيما تستمر الوجهات المحلية والقريبة في جذب الباحثين عن خيارات مرنة."
  },
  {
    id: "cyber-guide", title: "دليل مبسط لحماية الحسابات من أساليب الاحتيال الحديثة",
    summary: "خطوات عملية تشمل المصادقة الثنائية وإدارة كلمات المرور والتحقق من الروابط والرسائل العاجلة.",
    category: "التقنية", time: "أمس", publishedAt: "2026-07-13T14:20:00+03:00", readTime: "5 د", source: "مركز توعوي رسمي", confidence: 98,
    accent: "linear-gradient(135deg,#111827,#475569)", trending: 90, tags: ["الأمن السيبراني", "الاحتيال", "حماية الحسابات"],
    bullets: ["فعّل المصادقة الثنائية.", "لا تستخدم كلمة مرور واحدة لأكثر من خدمة.", "تحقق من عنوان الرابط قبل إدخال بياناتك."],
    whyItMatters: "معظم محاولات الاحتيال تستغل الاستعجال والثقة، وخطوات بسيطة تقلل الخطر بوضوح."
  },
  {
    id: "education-skills", title: "برامج تعليمية جديدة تركز على المهارات الرقمية والمهنية",
    summary: "مسارات مرنة تربط التعلم بالمشروعات التطبيقية وتمنح المتدربين أدوات أقرب إلى احتياجات سوق العمل.",
    category: "التعليم", time: "1 يوليو", publishedAt: "2026-07-01T13:15:00+03:00", readTime: "4 د", source: "جهات تعليمية رسمية", confidence: 93,
    accent: "linear-gradient(135deg,#4338ca,#38bdf8)", trending: 74, tags: ["التعليم", "المهارات الرقمية", "التدريب"],
    bullets: ["تعلّم قائم على المشروعات.", "مسارات قصيرة ومرنة.", "شراكات مع جهات مهنية."],
    whyItMatters: "تزيد البرامج التطبيقية فرص اكتساب مهارات قابلة للقياس والاستخدام في العمل.",
    expected: "تُعلن الجهات التعليمية تباعًا مواعيد التسجيل ومتطلبات القبول وتفاصيل الشراكات المهنية لكل مسار."
  },
  {
    id: "culture-season", title: "موسم ثقافي يجمع الأدب والفنون في برنامج متنوع",
    summary: "فعاليات جديدة تشمل لقاءات وورشًا ومعارض لدعم المبدعين وتوسيع وصول الجمهور إلى الإنتاج المحلي.",
    category: "الثقافة", time: "28 يونيو", publishedAt: "2026-06-28T12:10:00+03:00", readTime: "3 د", source: "الجهة المنظمة", confidence: 95,
    accent: "linear-gradient(135deg,#7c2d12,#ea580c)", trending: 70, tags: ["الثقافة", "الفنون", "فعاليات"],
    bullets: ["برنامج يمتد لعدة أسابيع.", "ورش للمواهب الناشئة.", "تذاكر لبعض الفعاليات متاحة إلكترونيًا."],
    whyItMatters: "البرنامج يفتح مساحة أوسع للمبدعين ويقدم خيارات ثقافية متنوعة للجمهور.",
    expected: "تُنشر الجداول التفصيلية وورش العمل وآلية حجز التذاكر عبر القنوات الرسمية للجهة المنظمة."
  }
];

export const brief = stories.slice(0, 7).map((story) => story.bullets[0]);

export const trendingTopics = ["الأمن السيبراني", "الذكاء الاصطناعي", "الأسواق", "الصحة الرقمية", "السفر القصير"];

export type SocialPlatform = "X" | "Instagram" | "TikTok" | "Snapchat" | "YouTube";

export type SocialTrend = {
  id: string;
  platform: SocialPlatform;
  account: string;
  handle: string;
  verified?: boolean;
  text: string;
  topic: string;
  time: string;
  metrics: Array<{ label: string; value: string }>;
  url: string;
  accent: string;
  source: string;
};

export const socialTrends: SocialTrend[] = [
  {
    id: "x-riyadh-air-tickets",
    platform: "X",
    account: "Entrepreneur العربية",
    handle: "@EntAlArabiya",
    verified: true,
    text: "«طيران الرياض» يطرح تذاكر الوجهات الجديدة ابتداءً من 1 يوليو 2026.",
    topic: "#طيران_الرياض",
    time: "يونيو 2026",
    metrics: [
      { label: "نوع المصدر", value: "منشور عام" },
      { label: "المنصة", value: "X" },
      { label: "حالة الرابط", value: "مباشر" }
    ],
    url: "https://x.com/EntAlArabiya/status/2057056282075681007",
    accent: "#111827",
    source: "X"
  },
  {
    id: "x-digital-saudi-ramadan",
    platform: "X",
    account: "السعودية الرقمية",
    handle: "@TheDigitalSaudi",
    verified: true,
    text: "تهنئة السعودية الرقمية بحلول شهر رمضان المبارك، ضمن المنشورات العامة للحساب الرسمي.",
    topic: "#رمضان",
    time: "17 فبراير 2026",
    metrics: [
      { label: "المشاهدات عند الرصد", value: "779" },
      { label: "نوع المصدر", value: "منشور عام" },
      { label: "حالة الرابط", value: "مباشر" }
    ],
    url: "https://x.com/TheDigitalSaudi/status/2023780286975406495",
    accent: "#111827",
    source: "X"
  },
  {
    id: "instagram-jeddah-sightscape",
    platform: "Instagram",
    account: "روح السعودية",
    handle: "@visitsaudi",
    verified: true,
    text: "مغامرات جدة البحرية مع SightScape وتجارب مائية متنوعة للمستكشفين.",
    topic: "#VisitSaudi · جدة",
    time: "6 يونيو 2026",
    metrics: [
      { label: "الإعجابات عند الرصد", value: "39" },
      { label: "التعليقات عند الرصد", value: "1" },
      { label: "متابعو الحساب", value: "617 ألف" }
    ],
    url: "https://www.instagram.com/visitsaudi/",
    accent: "#d62976",
    source: "فهرس Instagram العام"
  },
  {
    id: "instagram-black-gold-museum",
    platform: "Instagram",
    account: "روح السعودية",
    handle: "@visitsaudi",
    verified: true,
    text: "رحلة تفاعلية في قصة النفط وتطور الطاقة والصناعة داخل متحف الذهب الأسود بالرياض.",
    topic: "#VisitSaudi · الرياض",
    time: "3 يونيو 2026",
    metrics: [
      { label: "الإعجابات عند الرصد", value: "120" },
      { label: "التعليقات عند الرصد", value: "4" },
      { label: "المشاهدات عند الرصد", value: "1,479" }
    ],
    url: "https://www.instagram.com/visitsaudi/",
    accent: "#d62976",
    source: "فهرس Instagram العام"
  },
  {
    id: "tiktok-alula-trend",
    platform: "TikTok",
    account: "TikTok Creative Center",
    handle: "#alula",
    text: "العلا تتصدر الانتشار الإقليمي لهذا الوسم، والسعودية هي المنطقة الأولى في شعبيته.",
    topic: "#alula",
    time: "رصد عام 2026",
    metrics: [
      { label: "إجمالي المنشورات", value: "117 ألف" },
      { label: "منشورات آخر 7 أيام", value: "17" },
      { label: "الترتيب الإقليمي", value: "السعودية #1" }
    ],
    url: "https://ads.tiktok.com/business/creativecenter/hashtag/alula/mobile/en?countryCode=SA&period=7",
    accent: "#00a9b8",
    source: "TikTok Creative Center"
  },
  {
    id: "youtube-ark-falcons",
    platform: "YouTube",
    account: "صالح - oPiiLz",
    handle: "ترتيب السعودية #3 عند الرصد",
    text: "«أرك فالكونز #3» ضمن قائمة الفيديوهات الرائجة في السعودية عند الرصد.",
    topic: "أرك فالكونز #3",
    time: "بيانات الرصد العامة",
    metrics: [
      { label: "المشاهدات عند الرصد", value: "253,198" },
      { label: "الإعجابات عند الرصد", value: "37,152" },
      { label: "التعليقات عند الرصد", value: "2,474" }
    ],
    url: "https://www.youtube.com/results?search_query=%D8%A3%D8%B1%D9%83+%D9%81%D8%A7%D9%84%D9%83%D9%88%D9%86%D8%B2+%233",
    accent: "#ff0033",
    source: "قائمة YouTube الرائجة للسعودية"
  }
];

export type PlatformHashtag = {
  tag: string;
  firstStoryId: Story["id"];
};

export const platformHashtags: Record<SocialPlatform, PlatformHashtag[]> = {
  X: [
    { tag: "#طيران_الرياض", firstStoryId: "travel-season" },
    { tag: "#الذكاء_الاصطناعي", firstStoryId: "ai-public-services" },
    { tag: "#الأمن_السيبراني", firstStoryId: "cyber-guide" },
    { tag: "#الدوري_السعودي", firstStoryId: "sports-final" },
    { tag: "#رؤية_السعودية_2030", firstStoryId: "ai-public-services" }
  ],
  Instagram: [
    { tag: "#VisitSaudi", firstStoryId: "travel-season" },
    { tag: "#جدة", firstStoryId: "travel-season" },
    { tag: "#الرياض", firstStoryId: "culture-season" },
    { tag: "#العلا", firstStoryId: "culture-season" },
    { tag: "#صيف_السعودية", firstStoryId: "travel-season" }
  ],
  TikTok: [
    { tag: "#alula", firstStoryId: "travel-season" },
    { tag: "#السعودية", firstStoryId: "ai-public-services" },
    { tag: "#ترند_السعودية", firstStoryId: "culture-season" },
    { tag: "#اكسبلور", firstStoryId: "travel-season" },
    { tag: "#sauditiktok", firstStoryId: "cyber-guide" }
  ],
  Snapchat: [
    { tag: "#سناب_السعودية", firstStoryId: "culture-season" },
    { tag: "#الرياض", firstStoryId: "culture-season" },
    { tag: "#جدة", firstStoryId: "travel-season" },
    { tag: "#أبها", firstStoryId: "travel-season" },
    { tag: "#فعاليات_السعودية", firstStoryId: "culture-season" }
  ],
  YouTube: [
    { tag: "#أرك_فالكونز", firstStoryId: "cyber-guide" },
    { tag: "#الدوري_السعودي", firstStoryId: "sports-final" },
    { tag: "#ألعاب", firstStoryId: "cyber-guide" },
    { tag: "#بودكاست_سعودي", firstStoryId: "culture-season" },
    { tag: "#السعودية", firstStoryId: "ai-public-services" }
  ]
};

export function searchStories(query: string, category = "الكل") {
  const needle = query.trim().toLocaleLowerCase("ar");
  return stories.filter((story) => {
    const matchesCategory = category === "الكل" || story.category === category;
    const haystack = [story.title, story.summary, story.category, story.source, ...story.tags].join(" ").toLocaleLowerCase("ar");
    return matchesCategory && (!needle || haystack.includes(needle));
  });
}
