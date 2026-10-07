import assert from "node:assert/strict";
import test from "node:test";
import { classifyArticle, cleanParagraphs, cleanSummaryText, isApprovedSource, isArabicArticle, isArabicText, isExternalHttpUrl, isNonNewsTitle, isNonNewsUrl, isSourceBoilerplate, normalizeArabic, parseSourceDate, similarity, sourceOwnsUrl, summarizeArticle, summaryQuality, validateHydratedArticle } from "../lib/content-policy.ts";
import type { HydratedArticle, Source } from "../types/news.ts";

const approvedSource={id:"source-1",name:"وكالة موثوقة",domain:"spa.gov.sa",sourceType:"news",country:"SA",language:"ar",reliabilityScore:100,priority:1,status:"active",health:"Healthy",apiEndpoint:"",rssEndpoint:"",listingUrl:"https://www.spa.gov.sa/news/",sitemapEndpoint:"",region:"السعودية",retrievalFrequencyMinutes:30,scheduleEnabled:true,mainCategories:["أخبار السعودية"],subcategories:[],keywords:[],excludedKeywords:[],retrievalMethod:"html",fallbackMethods:[],lastSuccessfulFetch:null,lastSeenArticleId:"",lastSeenGuid:"",lastSeenUrl:"",lastSeenPublishedAt:null,lastSeenModifiedAt:null,etag:"",lastModified:"",automaticPublicationEnabled:true,requiresEditorialReview:false,consecutiveFailures:0,lastError:"",updatedAt:new Date().toISOString()} satisfies Source;

test("rejects local and private source URLs",()=>{
  assert.equal(isExternalHttpUrl("http://localhost:3000/news/1"),false);
  assert.equal(isExternalHttpUrl("http://192.168.1.2/news/1"),false);
  assert.equal(isExternalHttpUrl("https://www.spa.gov.sa/news/1"),true);
});
test("normalizes Arabic headlines for duplicate checks",()=>{
  assert.equal(normalizeArabic("أخبارُ السُّعودية!"),normalizeArabic("اخبار السعودية"));
  assert.ok(similarity(normalizeArabic("إطلاق مبادرة وطنية جديدة"),normalizeArabic("إطلاق مبادرة وطنية جديدة اليوم"))>.7);
});
test("summary content does not repeat the summary",()=>{
  const result=summarizeArticle("إطلاق مبادرة جديدة",[
    "أعلنت الجهة الرسمية إطلاق مبادرة جديدة تهدف إلى تطوير الخدمات الرقمية للمستفيدين.",
    "وتتضمن المبادرة ثلاث مراحل تنفيذية تبدأ هذا الشهر في عدد من مناطق المملكة.",
    "وأوضحت الجهة أن النتائج ستخضع للقياس قبل توسيع نطاق المبادرة خلال العام المقبل."
  ]);
  assert.ok(result.summary.length>30);
  assert.equal(summaryQuality(result.summary,"إطلاق مبادرة جديدة").valid,true);
  assert.ok(cleanParagraphs(result.content,"إطلاق مبادرة جديدة",result.summary).every((item)=>item!==result.summary));
});
test("summary skips promotional boilerplate and selects meaningful facts",()=>{
  const result=summarizeArticle("مؤشرات الأسهم تغلق على انخفاض",[
    "صحيفة إلكترونية سعودية تم تأسيسها عام 2007م تهتم بنشر الأخبار المحلية والمنافسة في سبق الأخبار بمهنية ومصداقية وموضوعية.",
    "أغلقت المؤشرات الرئيسية في بورصة وول ستريت تعاملات الثلاثاء على انخفاض متأثرة بتراجع أسهم شركات التقنية الكبرى.",
    "وانخفض المؤشر الصناعي 120 نقطة، بينما تراجع مؤشر ناسداك بنسبة واحد في المئة عند نهاية الجلسة."
  ]);
  assert.equal(result.quality.valid,true);
  assert.doesNotMatch(result.summary,/صحيفة إلكترونية|تم تأسيسها/u);
  assert.match(result.summary,/وول ستريت|المؤشر الصناعي/u);
});

test("cleanParagraphs and isSourceBoilerplate filter out publisher metadata and descriptions",()=>{
  const boilerplates = [
    "صحيفة إلكترونية سعودية تم تأسيسها عام 2007م تهتم بنشر الأخبار المحلية والمنافسة في سبق الأخبار بمهنية ومصداقية وموضوعية.",
    "صحيفة عاجل الإلكترونية تأسست عام 2007 تقدم الأخبار العاجلة على مدار الساعة.",
    "مجلة سيدتي أسلوب حياة المرأة العربية وتقدم أحدث صيحات الموضة والجمال.",
    "صحيفة المرصد الإلكترونية صحيفة إلكترونية شاملة تهتم بنقل الخبر بمصداقية وحيادية."
  ];

  for (const b of boilerplates) {
    assert.equal(isSourceBoilerplate(b), true, `Failed to detect boilerplate: ${b}`);
  }

  const rawParagraphs = [
    "صحيفة إلكترونية سعودية تم تأسيسها عام 2007م تهتم بنشر الأخبار المحلية والمنافسة في سبق الأخبار بمهنية ومصداقية وموضوعية.",
    "أكدت وزارة الموارد البشرية والتنمية الاجتماعية بدء تطبيق المرحلة الجديدة لتنظيم العمل.",
    "ودعت الوزارة جميع المنشآت إلى الالتزام بالمعايير والضوابط المعتمدة في اللائحة التنفيذية."
  ];

  const cleaned = cleanParagraphs(rawParagraphs, "عنوان الخبر");
  assert.equal(cleaned.length, 2);
  assert.ok(cleaned.every(p => !p.includes("تأسيسها عام 2007م")));

  const dirtySummary = "صحيفة إلكترونية سعودية تم تأسيسها عام 2007م. أكدت وزارة الموارد البشرية تطبيق القرارات الجديدة.";
  const cleanedSummary = cleanSummaryText(dirtySummary);
  assert.doesNotMatch(cleanedSummary, /صحيفة إلكترونية/);
  assert.match(cleanedSummary, /أكدت وزارة الموارد/);
});
test("only active real sources and their own domains are approved",()=>{
  assert.equal(isApprovedSource(approvedSource),true);
  assert.equal(sourceOwnsUrl(approvedSource,"https://www.spa.gov.sa/news/123"),true);
  assert.equal(sourceOwnsUrl(approvedSource,"https://unapproved.example/news/123"),false);
  assert.equal(isApprovedSource({...approvedSource,status:"paused"}),false);
  assert.equal(isApprovedSource({...approvedSource,domain:"news.google.com",listingUrl:"https://news.google.com/rss"}),false);
});
test("normalizes source dates and assumes Riyadh time when timezone is omitted",()=>{
  assert.equal(parseSourceDate("2026-07-30 12:15"),"2026-07-30T09:15:00.000Z");
  assert.equal(parseSourceDate("٣٠ يوليو ٢٠٢٦ ١٢:١٥"),"2026-07-30T09:15:00.000Z");
  assert.equal(parseSourceDate("16-صفر-1448-30-يوليو-2026"),"2026-07-29T21:00:00.000Z");
  assert.equal(parseSourceDate("2026/07/30 - 09:08"),"2026-07-30T06:08:00.000Z");
  assert.equal(parseSourceDate("not a date"),null);
});
test("rejects institutional landing-page titles and terminal landing URLs",()=>{
  for(const title of ["Partnerships with Civil Society Organizations","Business Accelerators","SDAIA Media Center","SDAIA Publications","SDAIA Knowledge Center","The Year of AI","مكتبة الصور","المركز الإعلامي"])assert.equal(isNonNewsTitle(title),true,title);
  assert.equal(isNonNewsTitle("SDAIA launches a new AI platform in Riyadh"),false);
  assert.equal(isNonNewsUrl("https://example.gov.sa/en/media-center/publications"),true);
  assert.equal(isNonNewsUrl("https://example.gov.sa/en/media-center/news/12345"),false);
});
test("rejects article shells without substantive body content",()=>{
  const source=approvedSource;
  const article={title:"إطلاق منصة وطنية جديدة للذكاء الاصطناعي",url:"https://example.gov.sa/news/12345",canonicalUrl:"https://example.gov.sa/news/12345",body:["أعلنت الجهة عن إطلاق المنصة الجديدة دون نشر أي تفاصيل إضافية كافية للخبر."],publishedAt:new Date().toISOString()} as never;
  const result=validateHydratedArticle(article,source,24);
  assert.equal(result.valid,false);
  assert.ok(result.errors.includes("insufficient_article_body"));
});
test("rejects hydrated articles whose canonical URL is outside the approved source domain",()=>{
  const body=["أعلنت الجهة الرسمية إطلاق مبادرة وطنية جديدة لتطوير الخدمات الرقمية ورفع كفاءة وصول المستفيدين إليها في مناطق المملكة.","وتتضمن المبادرة مراحل تنفيذية متعددة تبدأ هذا الشهر، مع قياس النتائج قبل توسيع نطاقها خلال العام المقبل.","وأكدت الجهة أن المشروع يستند إلى مؤشرات أداء واضحة وخطة زمنية معلنة لضمان جودة التنفيذ واستمرارية التحسين."];
  const article={title:"إطلاق مبادرة وطنية جديدة لتطوير الخدمات الرقمية",url:"https://www.spa.gov.sa/news/12345",canonicalUrl:"https://unapproved.example/news/12345",body,publishedAt:new Date().toISOString()} as never;
  const result=validateHydratedArticle(article,approvedSource,24);
  assert.equal(result.valid,false);
  assert.ok(result.errors.includes("source_domain_mismatch"));
});
test("economic signals outrank a broad political source assignment",()=>{
  const source={...approvedSource,mainCategories:["السياسة"]};
  const article={title:"الذهب يبلغ أعلى مستوياته مع ترقب بيانات التضخم",body:["ارتفعت أسعار الذهب في الأسواق العالمية مع ترقب المستثمرين بيانات التضخم وحركة العملة."],url:"https://www.spa.gov.sa/news/markets-123"} as never;
  assert.equal(classifyArticle(article,source).category,"الاقتصاد");
});
test("clear government and diplomatic reporting remains political",()=>{
  const source={...approvedSource,mainCategories:["السياسة"]};
  const article={title:"رئيس الوزراء يبحث اتفاقًا سياسيًا وعلاقات دولية جديدة",body:["ناقشت الحكومة والمجلس ملفات المفاوضات الدبلوماسية والاتفاق السياسي بين الدولتين."],url:"https://www.spa.gov.sa/news/politics-123"} as never;
  assert.equal(classifyArticle(article,source).category,"السياسة");
});
test("an incidental vehicle mention in a traffic accident is not automotive",()=>{
  const source={...approvedSource,mainCategories:["السيارات"]};
  const article={title:"مصرع وإصابة أشخاص في حادث انقلاب مركبة على الطريق",body:["باشرت فرق الإسعاف حادثًا مروريًا أسفر عن وفاة وإصابات بعد انقلاب المركبة."],url:"https://www.spa.gov.sa/news/accident-1"} as never;
  const result=classifyArticle(article,source);
  assert.notEqual(result.category,"السيارات");
});
test("manufacturer and model coverage is confidently automotive",()=>{
  const source={...approvedSource,mainCategories:["المجتمع"]};
  const article={title:"شركة سيارات تكشف موديلًا كهربائيًا جديدًا",body:["أعلنت تويوتا طرح موديل جديد في سوق السيارات ببطارية محسنة وتقنيات قيادة حديثة."],url:"https://www.spa.gov.sa/news/car-model-1"} as never;
  const result=classifyArticle(article,source);
  assert.equal(result.category,"السيارات");
  assert.equal(result.needsReview,false);
});
test("source category cannot force unrelated reporting into cars",()=>{
  const source={...approvedSource,mainCategories:["السيارات"]};
  const article={title:"أسواق المال ترتفع مع تراجع التضخم",body:["سجلت البورصة مكاسب جديدة وارتفعت الأسهم بدعم من بيانات الاقتصاد."],url:"https://www.spa.gov.sa/news/market-1"} as never;
  assert.equal(classifyArticle(article,source).category,"الاقتصاد");
});

test("Formula 1 Saudi Grand Prix reporting is classified as sport",()=>{
  const source={...approvedSource,name:"وكالة الأنباء السعودية",mainCategories:["أخبار السعودية","الرياضة"]};
  const result=classifyArticle({title:"رياضي / إطلاق الحجز المبكر لتذاكر جائزة السعودية الكبرى للفورمولا 1 لعام 2027",body:["أعلنت الجهة المنظمة تفاصيل سباق السيارات وموعد انطلاق منافسات الفورمولا في جدة."]} as never,source);
  assert.equal(result.category,"الرياضة");
  assert.equal(result.needsReview,false);
});

test("property transaction and occupancy certificate reporting is classified as real estate",()=>{
  const source={...approvedSource,name:"وزارة البلديات والإسكان",mainCategories:["العقارات","المجتمع"]};
  for(const title of ["تنظيم توثيق التصرفات العقارية للأراضي الخاضعة للرسوم يدعم تملك المواطنين","إصدار أكثر من 38 ألف شهادة إشغال للمباني والمنشآت"]){const result=classifyArticle({title,body:["تدعم الإجراءات السوق العقاري والتطوير العمراني ورخص البناء والاشتراطات البلدية."]} as never,source);assert.equal(result.category,"العقارات");assert.equal(result.needsReview,false);}
});

test("strictly rejects non-Arabic articles and source language",()=>{
  const englishArticle={
    title:"Ministry of Municipalities and Housing Updates Requirements for Ice Cream Shops",
    url:"https://www.spa.gov.sa/news/12345",
    canonicalUrl:"https://www.spa.gov.sa/news/12345",
    body:[
      "The Ministry explained that the updated requirements include detailed food safety measures covering the stages of receiving, storing, preparing, and serving products.",
      "The initiative aims to improve public health and ensure compliance across commercial facilities."
    ],
    publishedAt:new Date().toISOString()
  } as unknown as HydratedArticle;
  const result=validateHydratedArticle(englishArticle,approvedSource,24);
  assert.equal(result.valid,false);
  assert.ok(result.errors.includes("non_arabic_content"));

  const nonArabicSource={...approvedSource,language:"en"};
  const arabicArticle={
    title:"وزارة الشؤون البلدية تعتمد لائحة الاشتراطات الفنية الجديدة",
    url:"https://www.spa.gov.sa/news/12345",
    canonicalUrl:"https://www.spa.gov.sa/news/12345",
    body:[
      "اعتمدت الوزارة اليوم اللائحة الفنية المحدثة التي تهدف إلى تطوير البيئة الحضرية ورفع كفاءة الخدمات المقدمة للمستفيدين في مختلف المناطق.",
      "وأوضحت أن الإجراءات الجديدة تتضمن معايير واضحة للتنفيذ ومتابعة مستمرة لضمان تحقيق المستهدفات المعلنة."
    ],
    publishedAt:new Date().toISOString()
  } as unknown as HydratedArticle;
  const nonArSourceResult=validateHydratedArticle(arabicArticle,nonArabicSource,24);
  assert.equal(nonArSourceResult.valid,false);
  assert.ok(nonArSourceResult.errors.includes("non_arabic_source_language"));

  const validArResult=validateHydratedArticle(arabicArticle,approvedSource,24);
  assert.equal(validArResult.valid,true);
  assert.equal(isArabicArticle(arabicArticle.title,arabicArticle.body),true);
  assert.equal(isArabicArticle(englishArticle.title,englishArticle.body),false);
});

test("political speech with incidental AI mention is classified as politics not AI",()=>{
  const source={...approvedSource,mainCategories:["أخبار السعودية","السياسة","التقنية","الذكاء الاصطناعي"]};
  const politicalSpeech={
    title:"«قاليباف»: أي اعتداء على مصالح طهران وأمنها سيواجه برد أسرع وأشد إيلاماً",
    body:[
      "قال رئيس البرلمان الإيراني إن عهد الردود المتناسبة قد انتهى وحذر من أن أي اعتداء على مصالح طهران سيواجه برد حاسم.",
      "وأشار إلى أن الضربات العسكرية ضد القواعد دفعت القيادة للجوء للذكاء الاصطناعي لإنتاج مواد دعائية زائفة لتغطية واقع المعركة."
    ]
  } as never;
  const result=classifyArticle(politicalSpeech,source);
  assert.equal(result.category,"السياسة");
  assert.notEqual(result.category,"الذكاء الاصطناعي");
});

test("dedicated AI developments and generative models are classified as AI",()=>{
  const source={...approvedSource,mainCategories:["التقنية","الذكاء الاصطناعي"]};
  const aiArticle={
    title:"أكاديمية واس تبحث مع المالك تحولات الصحافة الحديثة وتطبيقات الذكاء الاصطناعي التوليدي",
    body:[
      "تناولت الورشة دور نماذج الذكاء الاصطناعي وشبكات التعلم الآلي في تطوير غرف الأخبار وصياغة التقارير الفورية.",
      "واستعرض المشاركون خوارزميات الذكاء الاصطناعي المتقدمة وأخلاقيات التعامل مع المحتوى المولد آلياً."
    ]
  } as never;
  const result=classifyArticle(aiArticle,source);
  assert.equal(result.category,"الذكاء الاصطناعي");
  assert.equal(result.needsReview,false);
});

test("spacecraft or diplomatic vehicles do not misclassify into automotive",()=>{
  const source={...approvedSource,mainCategories:["السياسة","السيارات","التقنية"]};
  const spaceArticle={
    title:"عالم فيزياء فلكية يكشف ما سيراه الإنسان لو سقط في ثقب أسود",
    body:[
      "أوضح العالم الروسي أنه عند سقوط مركبة فضائية في ثقب أسود فائق الكتلة، ستكون قوى المد والجزر أضعف بكثير حتى لو تحركت المركبة بمحركاتها مطفأة في الفضاء العميق."
    ]
  } as never;
  const result=classifyArticle(spaceArticle,source);
  assert.notEqual(result.category,"السيارات");

  const carArticle={
    title:"«الجميح للسيارات» تدشن أحدث طرازات الدفع الرباعي والسيارات الكهربائية لعام 2026",
    body:[
      "استعرضت شركة السيارات أحدث طرازات الدفع الرباعي وسيارات الركاب المجهزة بتقنيات قيادة متطورة لقائدي المركبات.",
      "وتوفر صالات العرض خدمات صيانة السيارات والضمان الممتد لجميع موديلات 2026 الجديدة."
    ]
  } as never;
  const carResult=classifyArticle(carArticle,source);
  assert.equal(carResult.category,"السيارات");
});

