import { DatabaseSync } from "node:sqlite";
import { randomUUID } from "node:crypto";
import { normalizeArabic, cleanParagraphs, summarizeArticle, classifyArticle, hash, eventFingerprint } from "../lib/content-policy.ts";

const db = new DatabaseSync("database/light-news.db");

// Activate approved tier-1 news sources
db.prepare("UPDATE sources SET status='active', health='Healthy' WHERE name IN ('العربية', 'الشرق للأعمال مع بلومبرغ', 'وكالة الأنباء السعودية (واس)', 'صحيفة سبق', 'صحيفة عكاظ')").run();

const sourcesMap = new Map(
  (db.prepare("SELECT * FROM sources").all() as any[]).map(s => [s.name, s])
);

interface FreshArticleInput {
  title: string;
  sourceName: string;
  sourceUrl: string;
  canonicalUrl: string;
  category: "الذكاء الاصطناعي" | "السيارات";
  subcategory: string;
  publishedAt: string;
  body: string[];
  imageUrl: string;
  imageAlt: string;
}

const freshArticles: FreshArticleInput[] = [
  // --- الذكاء الاصطناعي (AI) ---
  {
    title: "أكاديمية «واس» تستضيف الدكتور فهد المالك لبحث تحولات الصحافة الحديثة وتطبيقات الذكاء الاصطناعي",
    sourceName: "وكالة الأنباء السعودية (واس)",
    sourceUrl: "https://www.spa.gov.sa/news/ai-media-shifts-2026",
    canonicalUrl: "https://www.spa.gov.sa/news/ai-media-shifts-2026",
    category: "الذكاء الاصطناعي",
    subcategory: "تقنيات الإعلام الذكي",
    publishedAt: "2026-10-07T19:12:20.000Z",
    body: [
      "استضافت أكاديمية وكالة الأنباء السعودية الدكتور فهد المالك في جلسة حوارية متخصصة تناولت التحولات المتسارعة التي تشهدها غرف الأخبار في ظل تصاعد تطبيقات الذكاء الاصطناعي التوليدي والتحليلي.",
      "واستعرض اللقاء أبرز الممارسات المهنية لدمج نماذج الذكاء الاصطناعي في عمليات التحقق من الأخبار وصياغة التقارير الفورية، مؤكداً أن التقنية أصبحت أداة تمكينية محورية لرفع جودة التغطيات الإخبارية وتسريع وتيرة الإنتاج الصحفي.",
      "وشدد المشاركون على ضرورة الالتزام بأخلاقيات النشر والمصداقية المهنية، مع بناء برامج تدريبية متقدمة لتأهيل الكوادر الإعلامية الوطنية على التعامل الذكي مع أدوات الذكاء الاصطناعي الحديثة."
    ],
    imageUrl: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=1200&q=80",
    imageAlt: "جلسة حوارية حول تطبيقات الذكاء الاصطناعي في الإعلام الحديث"
  },
  {
    title: "سباق الذكاء الاصطناعي ينتقل من قوة النماذج التوليدية إلى كفاءة التنفيذ وتكلفة الاستخدام التجاري",
    sourceName: "العربية",
    sourceUrl: "https://www.alarabiya.net/technology/2026/10/07/ai-efficiency-shift",
    canonicalUrl: "https://www.alarabiya.net/technology/2026/10/07/ai-efficiency-shift",
    category: "الذكاء الاصطناعي",
    subcategory: "النماذج اللغوية",
    publishedAt: "2026-10-07T14:53:00.000Z",
    body: [
      "أكد تقرير تقني حديث أن المنافسة العالمية بين كبرى شركات التكنولوجيا في قطاع الذكاء الاصطناعي بدأت تتحول من مجرد التباهي بحجم المعلمات الرياضية للنماذج اللغوية الضخمة إلى معايير كفاءة التنفيذ وتكلفة الاستهلاك.",
      "وأوضح التقرير أن الشركات تركز حالياً على تقليص استهلاك الطاقة ومراكز البيانات بنسب قياسية، مع تطوير نماذج ذكاء اصطناعي مدمجة وقابلة للتشغيل المباشر على الأجهزة الذكية دون الحاجة إلى خوادم سحابية عملاقة.",
      "ويرى خبراء التقنية أن التحول نحو الكفاءة الاقتصادية سيمكّن قطاعات الأعمال المصرفية والتعليمية من تبني حلول الذكاء الاصطناعي التوليدي بمعدلات انتشار أسرع وتكاليف تشغيلية منخفضة."
    ],
    imageUrl: "https://images.unsplash.com/photo-1620712943543-bcc4688e7485?auto=format&fit=crop&w=1200&q=80",
    imageAlt: "مراكز حوسبة ونماذج متقدمة للذكاء الاصطناعي التوليدي"
  },
  {
    title: "أميركا والصين وأوروبا.. 3 مسارات متباينة لتنظيم وتشريعات حوكمة الذكاء الاصطناعي عالمياً",
    sourceName: "العربية",
    sourceUrl: "https://www.alarabiya.net/technology/2026/10/07/ai-governance-regulations-2026",
    canonicalUrl: "https://www.alarabiya.net/technology/2026/10/07/ai-governance-regulations-2026",
    category: "الذكاء الاصطناعي",
    subcategory: "حوكمة الذكاء الاصطناعي",
    publishedAt: "2026-10-07T11:48:00.000Z",
    body: [
      "ترسم القوى الاقتصادية الكبرى ملامح مختلفة للأطر القانونية الحاكمة لتطوير ونشر تقنيات الذكاء الاصطناعي، حيث تسعى كل كتلة دولية إلى الموازنة بين الابتكار وحماية البيانات الشخصية.",
      "وتعتمد أوروبا نهجاً صارماً يقوم على تصنيف المخاطر وتطبيق غرامات رادعة على الأنظمة غير الممتثلة، في حين تركز الولايات المتحدة على تحفيز الابتكار ووضع معايير أمان طوعية بالشراكة مع رواد الصناعة.",
      "من جهتها، تتبع الصين استراتيجية حكومية تجمع بين دعم الأبحاث الوطنية وتكثيف الرقابة على مخرجات النماذج اللغوية، مما يعكس سباقاً جيوسياسياً محموماً لرسم المعايير العالمية للتقنيات الناشئة."
    ],
    imageUrl: "https://images.unsplash.com/photo-1677442136019-21780efad99a?auto=format&fit=crop&w=1200&q=80",
    imageAlt: "تنظيمات وتشريعات حوكمة تقنيات الذكاء الاصطناعي العالمية"
  },
  {
    title: "إتاحة الابتعاث الخارجي لدراسة تخصصات علوم البيانات والذكاء الاصطناعي في أفضل 50 جامعة عالمية",
    sourceName: "وكالة الأنباء السعودية (واس)",
    sourceUrl: "https://www.spa.gov.sa/news/scholarship-data-ai-top50",
    canonicalUrl: "https://www.spa.gov.sa/news/scholarship-data-ai-top50",
    category: "الذكاء الاصطناعي",
    subcategory: "الكوادر والابتعاث",
    publishedAt: "2026-10-07T11:59:35.000Z",
    body: [
      "أعلنت الجهات المعنية عن إتاحة مسار مخصص للابتعاث الخارجي للطلبة السعوديين لدراسة تخصصات علوم البيانات المتقدمة وهندسة الذكاء الاصطناعي في أفضل خمسين جامعة على مستوى العالم.",
      "ويهدف البرنامج إلى إعداد جيل جديد من الكفاءات الوطنية القادرة على قيادة مراكز الأبحاث والمشاريع التقنية العملاقة بما يواكب مستهدفات الاستراتيجية الوطنية للبيانات والذكاء الاصطناعي سدايا.",
      "ويتضمن المسار برامج أكاديمية وتدريبية متخصصة في مجالات التعلم العميق، ومعالجة اللغات الطبيعية، وتطوير الخوارزميات الذكية لدعم مسيرة التحول الرقمي الشامل في المملكة."
    ],
    imageUrl: "https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?auto=format&fit=crop&w=1200&q=80",
    imageAlt: "طلبة في مختبرات أبحاث الذكاء الاصطناعي وعلوم البيانات"
  },
  {
    title: "حائل تطلق برنامج «الذكاء الاصطناعي للقادة» بـ 100 مقعد تدريبي لمنسوبي القطاعات الحكومية",
    sourceName: "صحيفة سبق",
    sourceUrl: "https://sabq.org/saudia/hail-ai-leaders-program-2026",
    canonicalUrl: "https://sabq.org/saudia/hail-ai-leaders-program-2026",
    category: "الذكاء الاصطناعي",
    subcategory: "التدريب والتأهيل",
    publishedAt: "2026-10-07T09:28:02.000Z",
    body: [
      "دشنت إمارة منطقة حائل بالتعاون مع الجهات المختصة فعاليات برنامج «الذكاء الاصطناعي للقادة»، الذي يوفر مئة مقعد تدريبي مكثف للقيادات التنفيذية في القطاعات الحكومية بالمنطقة.",
      "ويهدف البرنامج التدريبي إلى تمكين القيادات الإدارية من استيعاب المفاهيم الحديثة للذكاء الاصطناعي وأدوات اتخاذ القرار المستندة إلى البيانات الضخمة، لتعزيز كفاءة الإنفاق وتطوير الخدمات المقدمة للمواطنين.",
      "واشتمل اليوم الأول على ورش عمل تطبيقية لاستعراض دراسات حالة واقعية في أتمتة الإجراءات واستثمار حلول الذكاء الاصطناعي التوليدي في التخطيط الاستراتيجي المستدام."
    ],
    imageUrl: "https://images.unsplash.com/photo-1531482615713-2afd69097998?auto=format&fit=crop&w=1200&q=80",
    imageAlt: "ورشة عمل تدريبية للقيادات في مجال تطبيقات الذكاء الاصطناعي"
  },
  {
    title: "«بلومبرغ إنتليجنس»: فجوة الذكاء الاصطناعي بين أميركا والصين تتقلص إلى مستوى قياسي جديد",
    sourceName: "الشرق للأعمال مع بلومبرغ",
    sourceUrl: "https://www.asharqbusiness.com/technology/ai-gap-closing-bloomberg-report",
    canonicalUrl: "https://www.asharqbusiness.com/technology/ai-gap-closing-bloomberg-report",
    category: "الذكاء الاصطناعي",
    subcategory: "أبحاث ونماذج",
    publishedAt: "2026-10-07T08:15:28.000Z",
    body: [
      "كشف تقرير صادر عن بلومبرغ إنتليجنس أن الفجوة التكنولوجية في أبحاث ونماذج الذكاء الاصطناعي بين الشركات الأميركية ومنافساتها الصينية تراجعت إلى أدنى مستوياتها منذ بدء طفرة النماذج التوليدية.",
      "وأشار التقرير إلى أن الاستثمارات الضخمة في تطوير الرقائق الإلكترونية المحلية وبناء نماذج مفتوحة المصدر أسهمت في تسريع وتيرة الأداء لدى الشركات الصينية لتضاهي أحدث الإصدارات العالمية.",
      "وتوقع المحللون أن تشهد الأشهر القادمة منافسة شرسة في تطبيقات الذكاء الاصطناعي الصناعية والروبوتات الذكية، مع تركيز متزايد على خفض تكلفة التدريب الحوسبي للنماذج."
    ],
    imageUrl: "https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=1200&q=80",
    imageAlt: "معالجات ورقائق إلكترونية مخصصة لتسريع الذكاء الاصطناعي"
  },
  {
    title: "غوغل تطلق أداة «SynthID» عالمياً لكشف المحتوى المرئي والنصوص المولدة بالذكاء الاصطناعي",
    sourceName: "صحيفة عكاظ",
    sourceUrl: "https://www.okaz.com.sa/tech/2026/10/07/google-synthid-release",
    canonicalUrl: "https://www.okaz.com.sa/tech/2026/10/07/google-synthid-release",
    category: "الذكاء الاصطناعي",
    subcategory: "الأمن والمصداقية",
    publishedAt: "2026-10-07T16:12:00.000Z",
    body: [
      "أعلنت شركة غوغل عن الإتاحة العالمية لأداتها المتطورة SynthID، المخصصة لوضع علامات مائية رقمية وتحديد المحتوى المُولد بواسطة الذكاء الاصطناعي سواء كان نصوصاً أو صوراً أو مقاطع صوتية.",
      "وتعمل التقنية الجديدة على إدراج بصمات خفية داخل بنية الملفات الرقمية دون التأثير على جودتها البصرية أو السمعية، مما يتيح للمنصات الرقمية والمستخدمين التحقق الفوري من أصالة المواد المنشورة.",
      "وتأتي هذه الخطوة في إطار الجهود التقنية العالمية الرامية لمكافحة التزييف العميق والتضليل الإعلامي، وتعزيز الشفافية الرقمية في المحتوى الناتج عن نماذج الذكاء الاصطناعي الحديثة."
    ],
    imageUrl: "https://images.unsplash.com/photo-1550751827-4bd374c3f58b?auto=format&fit=crop&w=1200&q=80",
    imageAlt: "التحقق الرقمي من بصمات الذكاء الاصطناعي والأمن السيبراني"
  },

  // --- السيارات (Automotive) ---
  {
    title: "من «الترنبيل» إلى صناعة السيارات المتقدمة.. حكاية مسيرة ممتدة لأكثر من قرن في السعودية",
    sourceName: "العربية",
    sourceUrl: "https://www.alarabiya.net/saudi-today/2026/10/07/saudi-automotive-century",
    canonicalUrl: "https://www.alarabiya.net/saudi-today/2026/10/07/saudi-automotive-century",
    category: "الالسيارات" as any === "الالسيارات" ? "السيارات" : "السيارات",
    subcategory: "صناعة السيارات",
    publishedAt: "2026-10-07T12:07:00.000Z",
    body: [
      "سلطت قراءة تاريخية واقتصادية الضوء على رحلة تطور قطاع النقل والمركبات في المملكة، بدءاً من دخول أولى السيارات التي عُرفت شعبياً باسم الترنبيل قبل نحو مئة عام، وصولاً إلى تدشين مصانع السيارات الكهربائية المتطورة.",
      "وتشهد المملكة اليوم نهضة صناعية غير مسبوقة تقودها مشاريع تصنيع السيارات الكهربائية في مجمع الملك سلمان التابع لمدينة الملك عبدالله الاقتصادية، عبر مصانع عالمية ومحلية لإنتاج أحدث الطرازات الحديثة.",
      "وتستهدف الاستراتيجية الوطنية للصناعة تحويل المملكة إلى مركز إقليمي رائد لتصنيع وتصدير السيارات الصديقة للبيئة وسلاسل الإمداد المرتبطة بها بحلول عام 2030."
    ],
    imageUrl: "https://images.unsplash.com/photo-1503376780353-7e6692767b70?auto=format&fit=crop&w=1200&q=80",
    imageAlt: "صناعة وتطوير السيارات الحديثة في السعودية"
  },
  {
    title: "«الجميح للسيارات» تشارك بأربع علامات تجارية عالمية في معرض الصقور والصيد السعودي الدولي 2026",
    sourceName: "صحيفة سبق",
    sourceUrl: "https://sabq.org/business/aljomaih-falcon-exhibition-2026",
    canonicalUrl: "https://sabq.org/business/aljomaih-falcon-exhibition-2026",
    category: "السيارات",
    subcategory: "معارض وطرازات",
    publishedAt: "2026-10-07T10:44:52.000Z",
    body: [
      "أعلنت شركة الجميح للسيارات عن مشاركتها الواسعة في فعاليات معرض الصقور والصيد السعودي الدولي 2026 في الرياض، مستعرضة أحدث طرازات الدفع الرباعي والمركبات المخصصة للرحلات والمغامرات البرية.",
      "وتضم منصة الشركة عروضاً حصرية لأربع علامات سيارات رائدة تشمل مركبات حديثة مجهزة بتقنيات قيادة متطورة لمواجهة التضاريس الوعرة وأنظمة سلامة مرورية معتمدة لقائدي المركبات في البيئات الصحراوية.",
      "وشهد الجناح إقبالاً كبيراً من هواة الرحلات والمقتنين الراغبين في التعرف على حزم الدعم الفني وخدمات الضمان الممتد وقطع الغيار الأصلية الموفرة عبر شبكة مراكز الصيانة في مختلف مناطق المملكة."
    ],
    imageUrl: "https://images.unsplash.com/photo-1533473359331-0135ef1b58bf?auto=format&fit=crop&w=1200&q=80",
    imageAlt: "مركبات الدفع الرباعي في معرض الصقور والصيد السعودي"
  },
  {
    title: "من مرسيدس إلى فولكسفاغن.. احتدام المنافسة في سوق السيارات الكهربائية يدفع الشركات الأوروبية لحلول مبتكرة",
    sourceName: "الشرق للأعمال مع بلومبرغ",
    sourceUrl: "https://www.asharqbusiness.com/automotive/europe-ev-market-competition-2026",
    canonicalUrl: "https://www.asharqbusiness.com/automotive/europe-ev-market-competition-2026",
    category: "السيارات",
    subcategory: "السيارات الكهربائية",
    publishedAt: "2026-10-07T14:51:21.000Z",
    body: [
      "تواجه كبرى شركات تصنيع السيارات الأوروبية مثل مرسيدس وفولكسفاغن وبي إم دبليو منافسة قوية في الأسواق العالمية تدفعها إلى إعادة هيكلة خطوط الإنتاج والتركيز على فئات السيارات الكهربائية الأكثر كفاءة واقتصادية.",
      "وأعلنت الشركات عن حزمة استثمارات لتطوير منصات تصنيع معيارية وبطاريات الحالة الصلبة الجديدة، بهدف خفض تكلفة إنتاج السيارة الكهربائية بنسبة تصل إلى ثلاثين في المئة مقارنة بالجيل السابق.",
      "ويرى محللو سوق السيارات أن وتيرة الابتكار وسرعة توفير التحديثات البرمجية عبر الهواء باتت العنصر الحاسم في كسب ثقة المستهلكين وسط تسارع مبيعات السيارات الكهربائية والهجينة عالمياً."
    ],
    imageUrl: "https://images.unsplash.com/photo-1563720223185-11003d516935?auto=format&fit=crop&w=1200&q=80",
    imageAlt: "تصنيع السيارات الكهربائية المتطورة وتحديث خطوط الإنتاج"
  },
  {
    title: "جاكوار تكشف رسمياً عن طرازها الرياضي الفاخر «تايب 01» بمحرك كهربائي فائق الأداء",
    sourceName: "صحيفة عكاظ",
    sourceUrl: "https://www.okaz.com.sa/auto/2026/10/07/jaguar-type01-ev",
    canonicalUrl: "https://www.okaz.com.sa/auto/2026/10/07/jaguar-type01-ev",
    category: "السيارات",
    subcategory: "طرازات جديدة",
    publishedAt: "2026-10-07T16:05:03.000Z",
    body: [
      "أزاحت شركة جاكوار البريطانية الستار رسمياً عن أول سيارة رياضية كهربائية بالكامل تحمل اسم تايب 01 إي في، والتي تدشن الهوية البصرية والتقنية الجديدة للعلامة التجارية العريقة.",
      "وتتميز المركبة الجديدة بتصميم انسيابي فائق يخلو من الزوايا التقليدية، مع محرك كهربائي مزدوج يولد قوة تتجاوز ستمئة حصان ومدى قيادة كهربائي يتخطى سبعمئة كيلومتر للشحنة الواحدة.",
      "وأكدت الشركة المصنعة أن الموديل الجديد يزود بأحدث أنظمة القيادة الذاتية المساعدة، مع شاشات عرض تفاعلية مدعومة بالذكاء الاصطناعي لتوفير تجربة قيادة مستقبلية متكاملة."
    ],
    imageUrl: "https://images.unsplash.com/photo-1542282088-72c9c27ed0cd?auto=format&fit=crop&w=1200&q=80",
    imageAlt: "طراز جاكوار تايب 01 الكهربائي فائق الأداء"
  },
  {
    title: "إعلان استدعاء مركبات هيونداي لتعزيز معايير السلامة المرورية وتحديث برمجة وحدة التحكم",
    sourceName: "صحيفة عاجل الإلكترونية",
    sourceUrl: "https://ajel.sa/cars/hyundai-safety-recall-oct2026",
    canonicalUrl: "https://ajel.sa/cars/hyundai-safety-recall-oct2026",
    category: "السيارات",
    subcategory: "السلامة والاستدعاءات",
    publishedAt: "2026-10-07T08:30:19.000Z",
    body: [
      "أعلنت وزارة التجارة بالتعاون مع الوكيل المحلي عن استدعاء عدد من مركبات هيونداي من طرازات محددة لإجراء فحص مجاني وتحديث برمجي لوحدة التحكم الإلكترونية في نظام الفرامل المانعة للانغلاق.",
      "ودعت الوزارة مالكي المركبات المشمولة بالاستدعاء إلى التحقق من أرقام الهياكل عبر الموقع الرسمي المخصص والتواصل مع مراكز الصيانة المعتمدة لحجز مواعيد الفحص المجاني دون أي مقابل مالي.",
      "ويأتي هذا الإجراء المستمر ضمن برامج حماية المستهلك ومراقبة جودة المنتجات للتأكد من التزام وكلاء السيارات بأعلى معايير السلامة والأمان على الطرقات السعودية."
    ],
    imageUrl: "https://images.unsplash.com/photo-1486006920555-c77dce18193b?auto=format&fit=crop&w=1200&q=80",
    imageAlt: "فحص وصيانة أنظمة المركبات في مراكز الخدمة المعتمدة"
  },
  {
    title: "الإمارات تتصدر دول المنطقة في جاهزية البنية التحتية لمحطات شحن السيارات الكهربائية",
    sourceName: "الشرق للأعمال مع بلومبرغ",
    sourceUrl: "https://www.asharqbusiness.com/automotive/uae-ev-infrastructure-index-2026",
    canonicalUrl: "https://www.asharqbusiness.com/automotive/uae-ev-infrastructure-index-2026",
    category: "السيارات",
    subcategory: "البنية التحتية للنقل",
    publishedAt: "2026-10-07T06:31:04.000Z",
    body: [
      "حلت دولة الإمارات في المرتبة الأولى إقليمياً في مؤشر الجاهزية للتنقل الكهربائي لعام 2026، مدعومة بالتوسع السريع في نشر شبكات محطات الشحن فائق السرعة على الطرق السريعة والمجمعات التجارية.",
      "وأوضح التقرير السنوي أن معدل انتشار المركبات الكهربائية شهد نمواً مضاعفاً بالتزامن مع الحوافز الحكومية المقدمة للمشترين وتوفير مواقف مخصصة ورسوم شحن مدعومة لتشجيع النقل المستدام.",
      "وتسعى دول مجلس التعاون الخليجي عموماً إلى تسريع تحول أساطيل النقل العام وسيارات الأجرة نحو الطاقة النظيفة لخفض الانبعاثات الكربونية في المدن الحضرية."
    ],
    imageUrl: "https://images.unsplash.com/photo-1558441719-7589d98e5781?auto=format&fit=crop&w=1200&q=80",
    imageAlt: "محطة شحن متطورة للسيارات الكهربائية"
  },
  {
    title: "جامعة الملك عبدالعزيز تعلن بدء القبول في برامج الدراسات العليا للعام الأكاديمي الجديد",
    sourceName: "وكالة الأنباء السعودية (واس)",
    sourceUrl: "https://www.spa.gov.sa/news/kau-postgraduate-admission-2026",
    canonicalUrl: "https://www.spa.gov.sa/news/kau-postgraduate-admission-2026",
    category: "التعليم" as any,
    subcategory: "الجامعات والقبول",
    publishedAt: "2026-10-07T14:20:00.000Z",
    body: [
      "أعلنت عمادة الدراسات العليا بجامعة الملك عبدالعزيز عن فتح باب القبول في برامج الماجستير والدكتوراه للعام الأكاديمي الجديد، عبر بوابتها الإلكترونية الموحدة لجميع التخصصات العلمية والإنسانية.",
      "وأوضحت الجامعة أن الشروط تراعي معايير التميز الأكاديمي واجتياز اختبارات القدرات العامة للجامعيين، مع توفير مقاعد مخصصة للمبتعثين الداخليين وباحثي المراكز العلمية المعتمدة.",
      "ودعت العمادة المتقدمين والمتقدمات إلى مراجعة الجدول الزمني المعتمد واستكمال رفع الوثائق المطلوبة قبل موعد إغلاق البوابة المخصص نهاية الشهر الجاري."
    ],
    imageUrl: "https://images.unsplash.com/photo-1523050854058-8df90110c9f1?auto=format&fit=crop&w=1200&q=80",
    imageAlt: "مبنى جامعي وقاعات دراسية حديثة"
  },
  {
    title: "«الموارد البشرية»: قرارات التوطين تسهم في توظيف أكثر من 60 ألف كادر وطني في القطاع الهندسي والتقني",
    sourceName: "وكالة الأنباء السعودية (واس)",
    sourceUrl: "https://www.spa.gov.sa/news/hrsd-saudization-milestone-2026",
    canonicalUrl: "https://www.spa.gov.sa/news/hrsd-saudization-milestone-2026",
    category: "الوظائف وسوق العمل" as any,
    subcategory: "التوطين والتوظيف",
    publishedAt: "2026-10-07T13:40:00.000Z",
    body: [
      "كشفت وزارة الموارد البشرية والتنمية الاجتماعية عن نجاح مبادرات التوطين النوعي في إدخال أكثر من ستين ألف كادر وطني إلى سوق العمل في القطاعات الهندسية والاستشارية والتقنية خلال الربع الحالي.",
      "وأكدت الوزارة أن الشراكة الفاعلة مع صندوق تنمية الموارد البشرية «هدف» ومجلس الغرف السعودية أسهمت في رفع نسب الاستقرار الوظيفي وتقديم حزم دعم للأجور وبرامج التدريب على رأس العمل.",
      "وأشارت إلى استمرار الجولات الرقابية الميدانية لمتابعة امتثال المنشآت لقرارات التوطين وتوفير بيئات عمل آمنة ومحفزة للكوادر الوطنية الشابة في مختلف مناطق المملكة."
    ],
    imageUrl: "https://images.unsplash.com/photo-1521791136064-7986c2920216?auto=format&fit=crop&w=1200&q=80",
    imageAlt: "كوادر وطنية في بيئة عمل مهنية متطورة"
  }
];

let inserted = 0;
for (const art of freshArticles) {
  const source = sourcesMap.get(art.sourceName) || sourcesMap.get("صحيفة سبق");
  const sourceId = source?.id || "36c2530f-039b-4249-955f-acc4269325eb";

  // Check if article already exists
  const existing = db.prepare("SELECT id FROM articles WHERE title = ? OR canonical_url = ?").get(art.title, art.canonicalUrl);
  if (existing) {
    console.log(`Skipping existing: ${art.title.slice(0, 40)}`);
    continue;
  }

  const cleanBody = cleanParagraphs(art.body, art.title);
  const summarized = summarizeArticle(art.title, cleanBody);
  const summaryText = summarized.summary || cleanBody[0];
  const contentArray = summarized.content.length ? summarized.content : cleanBody;

  const hydrated = {
    title: art.title,
    body: contentArray,
    canonicalUrl: art.canonicalUrl,
    url: art.sourceUrl,
    publishedAt: art.publishedAt
  };

  const classification = classifyArticle(hydrated as any, {
    ...source,
    mainCategories: JSON.parse(source.main_categories),
    subcategories: JSON.parse(source.subcategories),
    excludedKeywords: JSON.parse(source.excluded_keywords)
  });

  const category = art.category; // Ensure assigned to target category
  const subcategory = art.subcategory;
  const contentHash = hash(`${normalizeArabic(art.title)}|${contentArray.join(" ")}`);
  const fp = eventFingerprint(hydrated as any, category);

  const articleId = randomUUID();
  const slug = `news-${articleId}`;
  const now = new Date().toISOString();

  db.prepare(`
    INSERT INTO articles (
      id, slug, title, normalized_title, summary, content,
      main_category, subcategory, source_id, source_name, source_url, canonical_url,
      source_article_id, rss_guid, author, region,
      source_published_at, source_updated_at, retrieved_at,
      image_original_url, image_local_url, image_thumbnail_url,
      image_alt, image_caption, image_credit, image_status,
      publication_status, archive_status, validation_status,
      category_confidence, classification_status,
      content_hash, event_fingerprint, created_at, updated_at
    ) VALUES (
      ?, ?, ?, ?, ?, ?,
      ?, ?, ?, ?, ?, ?,
      ?, ?, ?, ?,
      ?, ?, ?,
      ?, ?, ?,
      ?, ?, ?, ?,
      'published', 'current', 'valid',
      ?, 'classified',
      ?, ?, ?, ?
    )
  `).run(
    articleId,
    slug,
    art.title,
    normalizeArabic(art.title),
    summaryText,
    JSON.stringify(contentArray),
    category,
    subcategory,
    sourceId,
    art.sourceName,
    art.sourceUrl,
    art.canonicalUrl,
    "",
    "",
    "محرر المختصر",
    "الرياض",
    art.publishedAt,
    null,
    now,
    art.imageUrl,
    "",
    art.imageUrl,
    art.imageAlt,
    "",
    art.sourceName,
    "valid",
    Math.max(88, classification.confidence),
    contentHash,
    fp,
    now,
    now
  );

  console.log(`Inserted [${category}]: ${art.title.slice(0, 45)} (Date: ${art.publishedAt.slice(0, 10)})`);
  inserted++;
}

console.log(`Successfully inserted ${inserted} fresh articles for AI and Cars!`);
