import { createHash } from "node:crypto";
import type { HydratedArticle, Source } from "@/types/news";

const NON_NEWS=/(?:من نحن|عن الموقع|اتصل بنا|سياسة الخصوصية|الشروط والأحكام|الخدمات الإلكترونية|البرامج|دليل الخدمات|تسجيل الدخول)/u;
const LANDING_TITLE=/^(?:about(?: us| entrepreneurship)?|partnerships? with civil society organizations?|business accelerators?|rowad initiative|(?:sdaia|saudi data\s*(?:&|and)\s*ai authority)?\s*(?:media cent(?:er|re)|news updates?|calendar\s*(?:&|and)\s*events?|pictures? library|video library|publications?|knowledge cent(?:er|re)|ai newsletter|initiatives?)|popular topics in data and ai|sdaia role during (?:the )?covid-?19 pandemic|the year of ai|من نحن|عن (?:الهيئة|الموقع|المركز)|المركز الإعلامي|مركز المعرفة|مكتبة (?:الصور|الفيديو)|النشرات?|المطبوعات|المنشورات|المبادرات|التقويم والفعاليات|الفعاليات|المواضيع الشائعة في البيانات والذكاء الاصطناعي)$/iu;
const LANDING_URL=/(?:^|\/)(?:about(?:-us)?|contact(?:-us)?|initiatives?|publications?|newsletter|knowledge-cent(?:er|re)|pictures?-library|video-library|calendar|events?|partnerships?|accelerators?|entrepreneurship)(?:\/?(?:[?#].*)?$)/i;
const NAVIGATION=/(?:الرئيسية\s*\/|القائمة الرئيسية|جميع الحقوق محفوظة|تابعنا على|الأكثر قراءة)/u;
const SUMMARY_BOILERPLATE=/(?:صحيفة إلكترونية[^.؟!]{0,100}(?:تأسست|تم تأسيسها|تهتم بنشر)|لمشاهدة أجمل صور|زوروا\s+[«"]?\s*إنستغرام|تابعونا على|اضغط هنا|اقرأ أيضا|اشترك في|جميع الحقوق محفوظة|سياسة الخصوصية|المزيد من الأخبار)/u;
export const SOURCE_BOILERPLATE=/(?:صحيفة إلكترونية[^.؟!]{0,120}(?:تأسست|تم تأسيسها|تهتم بنشر|تصدر|شاملة)|(?:صحيفة|مجلة|جريدة|وكالة|منصة|شبكة)\s+(?:[^\s.،]{1,25}\s+){0,4}(?:إلكترونية|سعودية|عربية|إخبارية|شاملة|متخصصة|مستقلة|يومية)?\s*(?:تم\s+تأسيسها|تأسست|تصدر\s+(?:عن|باللغة|يومي|أسبوعي|شهري)|تعنى\s+بـ|تعنى\s+بدعم|تهتم\s+بنشر|أسلوب\s+حياة|مرخصة|هي\s+مجلة|هي\s+صحيفة)|مجلة الأسرة العصرية تعنى|صحيفة المرصد الكترونية|لمشاهدة أجمل صور المشاهير|زوروا\s+[«"]?\s*(?:إنستغرام|تويتر|موقعنا|حسابنا)|تابعونا على|اشترك في\s+(?:قناة|خدمة|حساب)|حمل تطبيق|تطبيق صحيفة|جميع الحقوق محفوظة|حقوق النشر محفوظة|للتواصل مع (?:إدارة التحرير|الصحيفة|الموقع)|رئيس التحرير\s*:|مدير التحرير\s*:)/u;
const VAGUE_SUMMARY_OPENING=/^(?:في عالم|في كرة القدم|في أسبوع|نعيش على|لا يبدو أن|عندما يصير|لطالما كان|منذ فجر التاريخ)/u;

export function isSourceBoilerplate(value:string):boolean{
  const trimmed=value.trim();
  if(trimmed.length<15)return false;
  return SOURCE_BOILERPLATE.test(trimmed);
}

export function cleanSummaryText(summary:string):string{
  return summary.replace(SOURCE_BOILERPLATE,"").replace(/\s+/g," ").trim();
}

export function normalizeArabic(value:string){
  return value.normalize("NFKC").replace(/[\u064B-\u065F\u0670]/g,"").replace(/[إأآ]/g,"ا").replace(/ى/g,"ي").replace(/ة/g,"ه").replace(/[^\p{L}\p{N}]+/gu," ").trim().toLocaleLowerCase("ar");
}
export function hash(value:string){return createHash("sha256").update(value).digest("hex");}
export function isNonNewsTitle(value:string){return NON_NEWS.test(value)||LANDING_TITLE.test(value.replace(/\s+/g," ").trim());}
export function isNonNewsUrl(value:string){try{return LANDING_URL.test(new URL(value).pathname);}catch{return true;}}
export function isExternalHttpUrl(value:string){try{const url=new URL(value),host=url.hostname.toLowerCase();return ["http:","https:"].includes(url.protocol)&&!["localhost","127.0.0.1","::1"].includes(host)&&!/^10\.|^192\.168\.|^172\.(1[6-9]|2\d|3[01])\./.test(host);}catch{return false;}}
function normalizedHost(value:string){try{return new URL(value).hostname.toLowerCase().replace(/^www\./,"");}catch{return value.toLowerCase().replace(/^www\./,"").trim();}}
function domainsMatch(first:string,second:string){const a=normalizedHost(first),b=normalizedHost(second);return Boolean(a&&b&&(a===b||a.endsWith(`.${b}`)||b.endsWith(`.${a}`)));}
export function isApprovedSource(source:Source){
  const domain=normalizedHost(source.domain||source.listingUrl||source.rssEndpoint||source.apiEndpoint);
  return source.status==="active"&&source.health!=="Paused"&&Boolean(domain)&&domain!=="example.com"&&domain!=="news.google.com";
}
export function sourceOwnsUrl(source:Source,value:string){return isExternalHttpUrl(value)&&domainsMatch(value,source.domain||source.listingUrl||source.rssEndpoint||source.apiEndpoint);}
export function parseSourceDate(value:string|null|undefined){
  if(!value)return null;
  const digits=value.replace(/[٠-٩]/g,(digit)=>String("٠١٢٣٤٥٦٧٨٩".indexOf(digit))).replace(/[۰-۹]/g,(digit)=>String("۰۱۲۳۴۵۶۷۸۹".indexOf(digit))).trim();
  if(/^\d{10,13}$/.test(digits)){const timestamp=Number(digits)*(digits.length===10?1000:1);return Number.isFinite(timestamp)?new Date(timestamp).toISOString():null;}
  const months:Record<string,string>={يناير:"01",فبراير:"02",مارس:"03",أبريل:"04",ابريل:"04",مايو:"05",يونيو:"06",يوليو:"07",أغسطس:"08",اغسطس:"08",سبتمبر:"09",أكتوبر:"10",اكتوبر:"10",نوفمبر:"11",ديسمبر:"12"};
  let normalized=digits;
  for(const [month,number] of Object.entries(months))normalized=normalized.replace(month,number);
  const yearFirst=normalized.match(/(20\d{2})[-/.\s](\d{1,2})[-/.\s](\d{1,2})(?:[ T\s–—-]+(\d{1,2}):(\d{2}))?/),dayFirst=normalized.match(/(\d{1,2})[-/.\s](\d{1,2})[-/.\s](20\d{2})(?:[ T\s–—-]+(\d{1,2}):(\d{2}))?/);
  if(yearFirst)normalized=`${yearFirst[1]}-${yearFirst[2].padStart(2,"0")}-${yearFirst[3].padStart(2,"0")}T${(yearFirst[4]||"00").padStart(2,"0")}:${yearFirst[5]||"00"}:00+03:00`;
  else if(dayFirst)normalized=`${dayFirst[3]}-${dayFirst[2].padStart(2,"0")}-${dayFirst[1].padStart(2,"0")}T${(dayFirst[4]||"00").padStart(2,"0")}:${dayFirst[5]||"00"}:00+03:00`;
  else if(/^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}(?::\d{2})?$/.test(normalized))normalized=`${normalized.replace(" ","T")}+03:00`;
  const timestamp=Date.parse(normalized);
  return Number.isFinite(timestamp)?new Date(timestamp).toISOString():null;
}
export function isArabicText(value:string,minArabic=6){
  const arabic=(value.match(/[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/g)||[]).length;
  const latin=(value.match(/[a-zA-Z]/g)||[]).length;
  return arabic>=minArabic&&arabic>=latin;
}
export function isArabicArticle(title:string,body:string[]){
  const arabicInTitle=(title.match(/[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/g)||[]).length;
  const latinInTitle=(title.match(/[a-zA-Z]/g)||[]).length;
  if(arabicInTitle<6||(arabicInTitle+latinInTitle>0&&arabicInTitle<latinInTitle))return false;
  const bodyText=body.join(" ");
  const arabicInBody=(bodyText.match(/[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/g)||[]).length;
  const latinInBody=(bodyText.match(/[a-zA-Z]/g)||[]).length;
  if(arabicInBody<35||(arabicInBody+latinInBody>0&&arabicInBody<latinInBody*1.2))return false;
  return true;
}
export function cleanParagraphs(values:string[],title:string,summary=""){
  const references=[normalizeArabic(title),normalizeArabic(summary)];
  return values.map((item)=>item.replace(/\s+/g," ").trim()).filter((item)=>item.length>35&&!NAVIGATION.test(item)&&!SUMMARY_BOILERPLATE.test(item)&&!isSourceBoilerplate(item)&&isArabicText(item,10)).filter((item,index,all)=>{
    const normalized=normalizeArabic(item);
    if(references.some((reference)=>reference&&similarity(normalized,reference)>.78))return false;
    return all.findIndex((candidate)=>similarity(normalizeArabic(candidate),normalized)>.9)===index;
  }).slice(0,12);
}
export function similarity(first:string,second:string){
  const a=new Set(first.split(/\s+/).filter(Boolean)),b=new Set(second.split(/\s+/).filter(Boolean));
  if(!a.size||!b.size)return 0;let intersection=0;for(const token of a)if(b.has(token))intersection++;
  return intersection/Math.max(a.size,b.size);
}
export function validateHydratedArticle(article:HydratedArticle,source:Source,freshnessHours:number){
  const errors:string[]=[];
  const body=cleanParagraphs(article.body,article.title);
  if(!isApprovedSource(source))errors.push("source_not_approved_or_active");
  if(!sourceOwnsUrl(source,article.url)||!sourceOwnsUrl(source,article.canonicalUrl))errors.push("source_domain_mismatch");
  if(source.language&&!source.language.toLowerCase().startsWith("ar"))errors.push("non_arabic_source_language");
  if(article.title.trim().length<12)errors.push("headline_too_short");
  if(isNonNewsTitle(article.title)||isNonNewsUrl(article.url)||NON_NEWS.test(article.url))errors.push("institutional_or_service_page");
  if(!isExternalHttpUrl(article.url)||!isExternalHttpUrl(article.canonicalUrl))errors.push("invalid_source_url");
  if(!isArabicArticle(article.title,body))errors.push("non_arabic_content");
  const bodyLength=body.join(" ").length;
  if(bodyLength<220||(body.length<2&&bodyLength<360))errors.push("insufficient_article_body");
  const normalizedDate=parseSourceDate(article.publishedAt);
  const published=Date.parse(normalizedDate||"");
  if(!Number.isFinite(published))errors.push("publication_date_could_not_be_parsed");
  else if(published>Date.now()+15*60000)errors.push("publication_date_in_future");
  else if(Date.now()-published>freshnessHours*3600000)errors.push("outside_freshness_window");
  const titleTokens=new Set(normalizeArabic(article.title).split(/\s+/)),bodyText=normalizeArabic(body.join(" "));
  if(titleTokens.size>3&&[...titleTokens].filter((token)=>bodyText.includes(token)).length<2)errors.push("headline_body_mismatch");
  for(const keyword of source.excludedKeywords)if(normalizeArabic(`${article.title} ${bodyText}`).includes(normalizeArabic(keyword)))errors.push("excluded_keyword");
  return {valid:errors.length===0,errors,body};
}
const SOURCE_CATEGORY_ALIASES:Record<string,string[]>={
  "أخبار السعودية":["اخبار السعوديه","محليات","محليات وسياسه","رسمي"],
  "المناطق":["محليات"],
  "السياسة":["سياسه","محليات وسياسه"],
  "الاقتصاد":["اقتصاد","اسواق","شركات"],
  "المجتمع":["مجتمع","المرأه","الاسره","اسلوب حياه","تنميه"],
  "الصحة":["صحه","الصحه والجمال"],
  "التعليم":["تعليم"],
  "الرياضة":["رياضه","رياضه سعوديه","كره قدم"],
  "التقنية":["تقنيه"],
  "الذكاء الاصطناعي":["الذكاء الاصطناعي"],
  "السفر":["سفر"],
  "السيارات":["سيارات"],
  "العقارات":["عقارات"],
  "الثقافة":["ثقافه","فعاليات"],
  "الطاقة والصناعة":["الطاقه والصناعه","طاقه"],
  "البيئة والمناخ":["البيئه","البيئه والمناخ"],
  "الوظائف وسوق العمل":["الوظائف","الوظائف وسوق العمل"],
  "العالم":["اقليمي","دولي","العالم"]
};
export function sourceCategoryConstraints(source:Source){
  if(source.mainCategories.length>1)return [];
  const configured=new Set(source.mainCategories.map(normalizeArabic));
  if(configured.has(normalizeArabic("أخبار السعودية")))return [];
  const categories=Object.entries(SOURCE_CATEGORY_ALIASES).filter(([,aliases])=>aliases.some((alias)=>configured.has(normalizeArabic(alias)))).map(([category])=>category);
  // Broad, all-purpose sources should continue to use the content classifier;
  // specialised sources are constrained to their declared source sections.
  return categories.length&&categories.length<10?categories:[];
}
export function classifyArticle(article:HydratedArticle,source:Source){
  type Policy={strong:string[];helper:string[];exclude:string[];entities:string[];minimum:number};
  const policies:Record<string,Policy>={
    "أخبار السعودية":{strong:["امر ملكي","مجلس الوزراء السعودي","خادم الحرمين","ولي العهد","الديوان الملكي","رؤيه 2030","النيابه العامه السعوديه","مجلس القضاء"],helper:["السعوديه","المملكه","وزاره سعوديه","هيئه سعوديه","سعودي","سعوديه"],exclude:[],entities:["الملك سلمان","الامير محمد بن سلمان"],minimum:7},
    "المناطق":{strong:["امانه المنطقه","اماره المنطقه","بلديه","محافظه"],helper:["الرياض","مكه","جده","المدينه المنوره","الدمام","القصيم","عسير","تبوك","حايل","جازان","نجران","الباحه","الجوف"],exclude:["بورصه","منتخب","نادي"],entities:[],minimum:7},
    "السياسة":{strong:["انتخابات","برلمان","مجلس النواب","رئيس الوزراء","اتفاق سياسي","مفاوضات سياسيه","علاقات دبلوماسيه","وقف اطلاق النار","قوات مسلحه","عمليات عسكريه","وزير الدفاع","ميليشيا","الحوثي","الجيش","حامله طائرات","سفينه حربيه","وزير الحرب","عقوبات","عقوبات دوليه","عقوبات امريكيه","طهران","ايران","الرئيس الايراني","البرلمان الايراني","اعتداء","ضربات عسكريه","قصف","غارات","صواريخ باليستيه","الحرس الثوري","نتنياهو","قاليباف","خامنئي"],helper:["حكومه","دبلوماسي","سياده","انسحاب","عقوبات","سفاره","حرب","معارك","صاروخ","طائرات حربيه","عسكري","نووي","تهديدات","عدوان","رد عسكري","صراع","توتر اقليمي","استسلام"],exclude:["اسعار","اسهم","بطوله","مباراه"],entities:["الامم المتحده","مجلس الامن","وزاره الخارجيه","البيت الابيض","البنتاغون"],minimum:7},
    "الاقتصاد":{strong:["اسواق المال","سوق الاسهم","الناتج المحلي","التضخم","رسوم جمركيه","ميزانيه","استثمار","بورصه","اسعار الفائده","الفدرالي","البنك الدولي"],helper:["اقتصاد","اسهم","تجاره","بنك","ريال","ذهب","عمله","اسعار","فائده","تضخم"],exclude:["مباراه","طقس"],entities:["البنك المركزي","وزاره الماليه","هيئه السوق الماليه","صندوق النقد"],minimum:7},
    "المجتمع":{strong:["الضمان الاجتماعي","العمل التطوعي","مبادره مجتمعيه","جوده الحياه","حقوق الانسان","حادث مروري","حادث انقلاب","حادث طريق","تصادم مركبات","خطيب المسجد","المسجد النبوي","خطبه الجمعه"],helper:["مجتمع","اسره","مواطن","تنميه","جمعيه","سكان","حادث","وفاه","اصابه","انقاذ","مرور"],exclude:["اسهم","مباراه","اختبار تصادم"],entities:["وزاره الموارد البشريه","الدفاع المدني","الهلال الاحمر"],minimum:7},
    "الصحة":{strong:["وزاره الصحه","الصحه العامه","حاله صحيه","تجربه سريريه","مرض معد","لقاح","تبرع بالدم","التبرع بالدم","بنك الدم","مستشفيات","مراكز صحيه"],helper:["طبي","مستشفي","مرض","علاج","دواء","مريض","صحي","صحه","اطباء","تمريض","ادويه"],exclude:["صحه الاقتصاد","صحه ماليه"],entities:["منظمه الصحه العالميه","هيئه الغذاء والدواء","وزاره الصحه"],minimum:7},
    "التعليم":{strong:["وزاره التعليم","العام الدراسي","قبول جامعي","اختبارات الطلاب","منهج دراسي","التقويم الدراسي","مدارس","جامعات"],helper:["تعليم","جامعه","مدرسه","طلاب","تدريب","معلم","طالب","معلمين","دراسي","تعليمي"],exclude:["تدريب الفريق","مدرسه كرويه"],entities:["جامعه الملك سعود","وزاره التعليم"],minimum:7},
    "الرياضة":{strong:["دوري روشن","كاس العالم","الدوري السعودي","كره القدم","بطوله رياضيه","فورمولا 1","جائزه السعوديه الكبري","سباق سيارات","سباق السيارات","فورمولا","مباراه الوداع"],helper:["رياضي","مباراه","فريق","دوري","بطوله","نادي","لاعب","مدرب","رونالدو","ميسي","الهلال","النصر","الاتحاد","الاهلي","منتخب"],exclude:["فريق طبي","فريق عمل"],entities:["المنتخب السعودي","الاتحاد الدولي لكره القدم","فيفا"],minimum:7},
    "التقنية":{strong:["امن سيبراني","تحول رقمي","تقنيه المعلومات","هاتف ذكي","نظام تشغيل","منصه رقميه","مؤتمر ليب","ليب 2026","ليب 26"],helper:["تقنيه","رقمي","سيبراني","تطبيق","انترنت","برمجيات","هواتف","اجهزه","اتصالات","فضاء","فلك","ثقب اسود"],exclude:["منصه نفطيه","عمله رقميه"],entities:["هيئه الاتصالات","مايكروسوفت","ابل","جوجل"],minimum:7},
    "الذكاء الاصطناعي":{strong:["الذكاء الاصطناعي","ذكاء اصطناعي","تعلم الاله","التعلم الالي","نموذج لغوي","نماذج لغويه","شبكات عصبيه","ذكاء توليدي","الذكاء التوليدي","شات جي بي تي","chatgpt"],helper:["خوارزميه","روبوت","نماذج ذكيه","توليدي"],exclude:["روبوت جراحي","عقوبات","طهران","ايران","ضربات عسكريه","اعتداء","نوم","صيفنا تعلم"],entities:["سدايا","اوبن اي اي","openai"],minimum:9},
    "السفر":{strong:["وجهه سياحيه","تاشيره سياحيه","قطاع السياحه","رحلات جويه","حجز فندقي","السياحه السعوديه","طيران ناس","الخطوط الجويه"],helper:["سفر","سياحه","طيران","فندق","مطار","مسافر","فنادق","رحلات","مسافرين"],exclude:["طيران مسير","سلاح الجو"],entities:["الخطوط السعوديه","وزاره السياحه","هيئه السياحه"],minimum:7},
    "السيارات":{strong:["سوق السيارات","صناعه السيارات","شركه سيارات","علامه سيارات","سياره كهربائيه","مركبه كهربائيه","تقنيات المركبات","صيانه السيارات","قياده ذاتيه","نظام قياده","موديل جديد","استدعاء مركبات","المرور السعودي","السلامه المروريه","قائدي المركبات"],helper:["سيارات","مركبات","سياره","مركبه","موديل","محرك","اطارات","قياده","نقل بري","مسافه امنه","اشاره الالتفاف","وكيل سيارات"],exclude:["حادث مروري","حادث انقلاب","حادث طريق","تصادم","دهس","ضبط","تهريب","حريق سياره","وفاه","جريمه","اسعاف","مركبه فضائيه","مركبات فضائيه","فضاء","فلك","ثقب اسود","مجرات","نجوم","طهران","ايران","عقوبات"],entities:["تويوتا","مرسيدس","بي ام دبليو","تسلا","هيونداي","نيسان","فورد","لوسيد","هافال","اومودا","جايكو"],minimum:9},
    "العقارات":{strong:["التصرفات العقاريه","السوق العقاري","الرسوم العقاريه","الاراضي البيضاء","شهاده اشغال","رخصه البناء","التطوير العمراني","تملك المواطنين"],helper:["عقار","عقاري","اسكان","مبني","منشاه","اراضي","بلدي","اشتراطات بلديه"],exclude:["سياره","مباراه"],entities:["وزاره البلديات والاسكان","الهيئه العامه للعقار"],minimum:7},
    "الثقافة":{strong:["معرض الكتاب","مهرجان سينمائي","عمل فني","تراث ثقافي","جائزه ادبيه","صناعه الافلام","صانعه الافلام","ممثله","ممثل","كاتبه","كاتب","معرض الصقور","الصقور والصيد"],helper:["ثقافه","فن","فيلم","افلام","كتاب","مسرح","سينما","ادب","متحف","موسيقي","ازياء","موضه","تراث","صقور"],exclude:["كتاب مدرسي","الفنادق"],entities:["وزاره الثقافه"],minimum:7},
    "الطاقة والصناعة":{strong:["اسواق النفط","انتاج النفط","الطاقه المتجدده","قطاع الصناعه","مصنع جديد","سلاسل الامداد","اسعار النفط"],helper:["طاقه","نفط","غاز","صناعه","مصنع","بتروكيماويات","برميل"],exclude:["طاقه اللاعب","غاز مسيل للدموع"],entities:["اوبك","ارامكو","وزاره الطاقه"],minimum:7},
    "البيئة والمناخ":{strong:["تغير المناخ","حاله الطقس","ارصاد جويه","انذار احمر","حمايه البيئه","هطول امطار","اعاصير","اعصار مداري","التنبؤ بالاعاصير"],helper:["بيئه","مناخ","طقس","امطار","حراره","عاصفه","سيول","ظواهر جويه"],exclude:["مناخ استثماري","حراره المنافسه"],entities:["المركز الوطني للارصاد"],minimum:7},
    "الوظائف وسوق العمل":{strong:["فرص وظيفيه","سوق العمل","التوطين","برنامج توظيف","وظائف شاغره","طرح وظائف","اعلان وظائف"],helper:["وظيفه","وظائف","توظيف","باحث عن عمل","رواتب","التوظيف"],exclude:["عمل فني","فريق عمل","بمهنيه"],entities:["صندوق تنميه الموارد البشريه"],minimum:7},
    "العالم":{strong:["كارثه دوليه","ازمه دوليه","شان دولي","تطورات عالميه"],helper:["الولايات المتحده","اوروبا","الصين","روسيا","اوكرانيا","افريقيا","العالم"],exclude:["السوق العالمي","كاس العالم"],entities:[],minimum:7}
  };
  const title=normalizeArabic(article.title),body=normalizeArabic(article.body.join(" "));
  const stripAl=(text:string)=>text.split(/\s+/).map((w)=>w.startsWith("ال")&&w.length>3?w.slice(2):w).join(" ");
  const stripTitle=stripAl(title),stripBody=stripAl(body);
  const contains=(value:string,field:string,strippedField:string)=>{
    const normVal=normalizeArabic(value);
    if(field.includes(normVal))return true;
    const strippedVal=stripAl(normVal);
    return strippedVal.length>2&&strippedField.includes(strippedVal);
  };
  const SPECIALIZED_VERTICALS=new Set(["الذكاء الاصطناعي","السيارات","السفر","العقارات","الطاقة والصناعة","البيئة والمناخ"]);
  const scores=new Map<string,number>(),allowed=new Set(sourceCategoryConstraints(source));
  for(const [category,policy] of Object.entries(policies)){
    if(allowed.size&&!allowed.has(category))continue;
    let score=0,titleMatched=false;
    for(const value of policy.strong){if(contains(value,title,stripTitle)){score+=9;titleMatched=true;}else if(contains(value,body,stripBody))score+=4;}
    for(const value of policy.helper){if(contains(value,title,stripTitle)){score+=3;titleMatched=true;}else if(contains(value,body,stripBody))score+=1.5;}
    for(const value of policy.entities){if(contains(value,title,stripTitle)){score+=6;titleMatched=true;}else if(contains(value,body,stripBody))score+=2;}
    for(const value of policy.exclude){if(contains(value,title,stripTitle))score-=12;else if(contains(value,body,stripBody))score-=5;}
    if(SPECIALIZED_VERTICALS.has(category)&&!titleMatched&&score>0){score=Math.max(0,score-6);}
    scores.set(category,score);
  }
  const ranked=[...scores.entries()].sort((a,b)=>b[1]-a[1]),winner=ranked[0]||["المجتمع",0],runner=ranked[1]||["",0],policy=policies[winner[0]],margin=winner[1]-runner[1],needsReview=winner[1]<policy.minimum||margin<2,confidence=needsReview?Math.max(20,Math.min(69,35+winner[1]*3+Math.max(0,margin))):Math.min(99,68+winner[1]*2+margin),matchedSubcategory=source.subcategories.find((item)=>body.includes(normalizeArabic(item))||title.includes(normalizeArabic(item)))||"",subcategory=normalizeArabic(matchedSubcategory)===normalizeArabic(winner[0])?"":matchedSubcategory;
  return {category:winner[0],subcategory,confidence:Math.round(confidence),score:winner[1],margin,needsReview,alternatives:ranked.slice(1,4).map(([category,score])=>({category,score})),reasons:needsReview?[winner[1]<policy.minimum?"below_category_threshold":"ambiguous_category"]:[]};
}
export function summaryQuality(summary:string,title:string){
  const value=summary.replace(/\s+/g," ").trim(),normalized=normalizeArabic(value),titleSimilarity=similarity(normalized,normalizeArabic(title)),tokens=new Set(normalized.split(/\s+/).filter(Boolean)),reasons:string[]=[];
  if(value.length<70)reasons.push("summary_too_short");
  if(value.length>420)reasons.push("summary_too_long");
  if(tokens.size<10)reasons.push("summary_lacks_information");
  if(titleSimilarity>.82||normalized===normalizeArabic(title))reasons.push("summary_repeats_headline");
  if(SUMMARY_BOILERPLATE.test(value))reasons.push("summary_contains_boilerplate");
  if(VAGUE_SUMMARY_OPENING.test(value)&&value.length<130)reasons.push("summary_is_vague");
  return {valid:reasons.length===0,reasons};
}
function summarySentenceScore(sentence:string,title:string,index:number){
  if(SUMMARY_BOILERPLATE.test(sentence))return -100;
  const normalized=normalizeArabic(sentence),titleSimilarity=similarity(normalized,normalizeArabic(title));
  if(titleSimilarity>.82)return -50;
  let score=Math.max(0,5-index*.35);
  if(sentence.length>=80&&sentence.length<=220)score+=4;else if(sentence.length>=60)score+=2;
  if(titleSimilarity>=.08&&titleSimilarity<=.7)score+=4;
  if(/(?:أعلن|أكد|أوضح|أفاد|كشف|سجل|ارتفع|انخفض|أطلق|دشن|قرر|وقع|حقق|حذر|توقع|أسفر|يشمل|يتضمن|بسبب|بعد|خلال)/u.test(sentence))score+=2;
  if(/[0-9٠-٩]/u.test(sentence))score+=1;
  if(VAGUE_SUMMARY_OPENING.test(sentence))score-=5;
  return score;
}
function capSummary(value:string){if(value.length<=360)return value;const clipped=value.slice(0,357),boundary=Math.max(clipped.lastIndexOf(" "),clipped.lastIndexOf("،"));return `${clipped.slice(0,boundary>220?boundary:357).trim()}…`;}
export function summarizeArticle(title:string,body:string[]){
  const clean=cleanParagraphs(body,title),sentences=clean.flatMap((paragraph)=>paragraph.split(/(?<=[.!؟…])\s+|[\r\n]+/u)).map((item)=>item.replace(/\s+/g," ").trim()).filter((item)=>item.length>45&&!SUMMARY_BOILERPLATE.test(item)&&!isSourceBoilerplate(item));
  const ranked=sentences.map((sentence,index)=>({sentence,index,score:summarySentenceScore(sentence,title,index)})).filter((item)=>item.score>0).sort((a,b)=>b.score-a.score||a.index-b.index);
  const selected:typeof ranked=[];
  for(const item of ranked){if(selected.some((chosen)=>similarity(normalizeArabic(chosen.sentence),normalizeArabic(item.sentence))>.68))continue;selected.push(item);if(selected.map((chosen)=>chosen.sentence).join(" ").length>=150||selected.length===2)break;}
  const summary=capSummary(selected.sort((a,b)=>a.index-b.index).map((item)=>item.sentence).join(" "));
  const quality=summaryQuality(summary,title),content=clean.filter((item)=>similarity(normalizeArabic(item),normalizeArabic(summary))<.72).slice(0,8);
  return {summary:quality.valid?summary:"",content,quality};
}
export function eventFingerprint(article:HydratedArticle,category:string){
  const entities=normalizeArabic(article.title).split(/\s+/).filter((token)=>token.length>3).slice(0,10).sort().join(" ");
  return hash(`${category}|${entities}|${(article.publishedAt||"").slice(0,13)}`);
}
