export const NEWS_CATEGORIES=["أخبار السعودية","السياسة","الاقتصاد","المجتمع","الرياضة","التقنية","الذكاء الاصطناعي","الصحة والجمال","الثقافة","السيارات","السفر","التعليم","الطاقة","العقارات","البيئة","الوظائف","الفعاليات"] as const;
export type NewsCategory=typeof NEWS_CATEGORIES[number];

export const APPROVED_CATEGORY_SOURCES:Record<NewsCategory,readonly string[]>={
  "أخبار السعودية":["وكالة الأنباء السعودية (واس)","قناة الإخبارية السعودية","صحيفة الرياض","صحيفة عكاظ","صحيفة سبق"],
  "السياسة":["وكالة الأنباء السعودية (واس)","قناة الإخبارية السعودية","وزارة الخارجية السعودية","العربية"],
  "الاقتصاد":["وكالة الأنباء السعودية (واس)","الاقتصادية","الشرق للأعمال مع بلومبرغ","وزارة المالية السعودية","الهيئة العامة للإحصاء","تداول السعودية","العربية"],
  "المجتمع":["وكالة الأنباء السعودية (واس)","قناة الإخبارية السعودية","وزارة الموارد البشرية والتنمية الاجتماعية","صحيفة الرياض"],
  "الرياضة":["وزارة الرياضة السعودية","الاتحاد السعودي لكرة القدم","الرياضية","وكالة الأنباء السعودية (واس)"],
  "التقنية":["وزارة الاتصالات وتقنية المعلومات","هيئة الاتصالات والفضاء والتقنية","وكالة الأنباء السعودية (واس)","صحيفة سبق"],
  "الذكاء الاصطناعي":["الهيئة السعودية للبيانات والذكاء الاصطناعي (سدايا)","جامعة الملك عبدالله للعلوم والتقنية (كاوست)","وزارة الاتصالات وتقنية المعلومات","وكالة الأنباء السعودية (واس)","صحيفة سبق"],
  "الصحة والجمال":["وزارة الصحة السعودية","الهيئة العامة للغذاء والدواء","وكالة الأنباء السعودية (واس)","سيدتي"],
  "الثقافة":["وزارة الثقافة السعودية","هيئة الأدب والنشر والترجمة","وكالة الأنباء السعودية (واس)","سيدتي","صحيفة سبق","العربية"],
  "السيارات":["وزارة التجارة السعودية","الهيئة السعودية للمواصفات والمقاييس والجودة","المركز السعودي لكفاءة الطاقة"],
  "السفر":["وزارة السياحة السعودية","الهيئة السعودية للسياحة","الهيئة العامة للطيران المدني","وكالة الأنباء السعودية (واس)","سيدتي","صحيفة سبق","العربية"],
  "التعليم":["وزارة التعليم السعودية","المؤسسة العامة للتدريب التقني والمهني","وكالة الأنباء السعودية (واس)"],
  "الطاقة":["وزارة الطاقة السعودية","الشرق للأعمال مع بلومبرغ","الاقتصادية","وكالة الأنباء السعودية (واس)"],
  "العقارات":["وزارة البلديات والإسكان","الهيئة العامة للعقار","الاقتصادية","وكالة الأنباء السعودية (واس)"],
  "البيئة":["وزارة البيئة والمياه والزراعة","المركز الوطني للأرصاد","وكالة الأنباء السعودية (واس)"],
  "الوظائف":["المنصة الوطنية الموحدة للتوظيف (جدارات)","وزارة الموارد البشرية والتنمية الاجتماعية","وكالة الأنباء السعودية (واس)"],
  "الفعاليات":["المركز الوطني للفعاليات","وزارة الثقافة السعودية","الهيئة السعودية للسياحة","وكالة الأنباء السعودية (واس)"]
};

const CATEGORY_KEYWORDS:Record<NewsCategory,readonly string[]>={
  "أخبار السعودية":["السعودية","المملكة","محلي","وطني","الرياض","جدة","منطقة"],
  "السياسة":["سياسي","وزارة الخارجية","دبلوماسي","مجلس الوزراء","سفير","قمة","اتفاقية"],
  "الاقتصاد":["اقتصاد","سوق","تداول","تضخم","استثمار","شركة","مالية","ناتج","طاقة"],
  "المجتمع":["مجتمع","اجتماعي","أسرة","تنمية اجتماعية","تطوع","إسكان","موارد بشرية"],
  "الرياضة":["رياضة","رياضي","دوري","نادي","منتخب","مباراة","اتحاد كرة"],
  "التقنية":["تقنية","رقمي","اتصالات","إنترنت","أمن سيبراني","برمجيات","فضاء"],
  "الذكاء الاصطناعي":["ذكاء اصطناعي","الذكاء الاصطناعي","البيانات","سدايا","تعلم آلي","التعلم الآلي","نماذج","خوارزمية","artificial intelligence","machine learning","generative ai"],
  "الصحة والجمال":["صحة","صحي","دواء","غذاء","مستشفى","مرض","علاج","تجميل","جمال"],
  "الثقافة":["ثقافة","ثقافي","كتاب","أدب","تراث","فن","مسرح","متحف"],
  "السيارات":["سيارة","سيارات","مركبة","مركبات","مرور","استدعاء","وقود","كفاءة الطاقة"],
  "السفر":["سفر","سياحة","سياحي","وجهة","طيران","مطار","تأشيرة","فندق"],
  "التعليم":["تعليم","تعليمي","مدرسة","جامعة","طلاب","معلم","تدريب","ابتعاث"],
  "الطاقة":["طاقة","نفط","غاز","كهرباء","متجددة","هيدروجين"],
  "العقارات":["عقار","عقارات","إسكان","سكني","إيجار","تطوير عقاري"],
  "البيئة":["بيئة","مناخ","طقس","أرصاد","مياه","زراعة","استدامة"],
  "الوظائف":["وظائف","توظيف","جدارات","فرصة عمل","سوق العمل","باحث عن عمل"],
  "الفعاليات":["فعاليات","موسم","مهرجان","معرض","مؤتمر","حفلة","ملتقى"]
};

const SUBCATEGORY_KEYWORDS:Record<NewsCategory,ReadonlyArray<{name:string;keywords:readonly string[]}>>={
  "أخبار السعودية":[{name:"محليات",keywords:["السعودية","المملكة","منطقة","مدينة","محافظة"]},{name:"قرارات رسمية",keywords:["قرار","مجلس الوزراء","أمر","اعتماد"]}],
  "السياسة":[{name:"محلية",keywords:["مجلس الوزراء","وزارة","المملكة","السعودية"]},{name:"دولية",keywords:["دولي","الأمم المتحدة","قمة","سفير","اتفاقية"]}],
  "الاقتصاد":[{name:"شركات",keywords:["شركة","الرئيس التنفيذي","استحواذ","أرباح"]},{name:"أسواق",keywords:["سوق","تداول","أسهم","مؤشر"]},{name:"مال وأعمال",keywords:["استثمار","تمويل","اقتصاد","ناتج","تضخم"]}],
  "المجتمع":[{name:"تنمية",keywords:["تنمية","دعم","مبادرة","إسكان"]},{name:"محليات",keywords:["منطقة","مدينة","محافظة","مجتمع"]}],
  "الرياضة":[{name:"كرة القدم",keywords:["كرة","دوري","نادي","منتخب","مباراة"]},{name:"رياضات أخرى",keywords:["بطولة","اتحاد","لاعب","منافسات"]}],
  "التقنية":[{name:"تحول رقمي",keywords:["رقمي","منصة","خدمة إلكترونية","أتمتة"]},{name:"أمن سيبراني",keywords:["سيبراني","اختراق","أمن معلومات"]},{name:"اتصالات",keywords:["اتصالات","إنترنت","شبكات"]}],
  "الذكاء الاصطناعي":[{name:"تطبيقات الذكاء الاصطناعي",keywords:["ذكاء اصطناعي","نماذج","خوارزمية","تعلم آلي"]},{name:"بيانات",keywords:["بيانات","سدايا","حوكمة"]}],
  "الصحة والجمال":[{name:"صحة",keywords:["صحة","مستشفى","مرض","علاج"]},{name:"دواء وغذاء",keywords:["دواء","غذاء","الهيئة العامة للغذاء والدواء"]},{name:"جمال",keywords:["تجميل","جمال"]}],
  "الثقافة":[{name:"أدب ونشر",keywords:["كتاب","أدب","نشر","ترجمة"]},{name:"فنون وتراث",keywords:["فن","مسرح","متحف","تراث"]}],
  "السيارات":[{name:"سوق السيارات",keywords:["سيارة","مركبة","طراز"]},{name:"سلامة وكفاءة",keywords:["استدعاء","سلامة","كفاءة الطاقة","وقود"]}],
  "السفر":[{name:"سياحة",keywords:["سياحة","وجهة","فندق"]},{name:"طيران",keywords:["طيران","مطار","رحلة"]}],
  "التعليم":[{name:"تعليم عام",keywords:["مدرسة","طلاب","معلم"]},{name:"تعليم جامعي",keywords:["جامعة","ابتعاث","كلية"]},{name:"تدريب",keywords:["تدريب","مهارات","مهني"]}],
  "الطاقة":[{name:"النفط والغاز",keywords:["نفط","غاز","أوبك"]},{name:"الطاقة المتجددة",keywords:["متجددة","شمسية","رياح","هيدروجين"]},{name:"الكهرباء",keywords:["كهرباء","شبكة","استهلاك"]}],
  "العقارات":[{name:"الإسكان",keywords:["إسكان","سكني","وحدة سكنية"]},{name:"السوق العقاري",keywords:["عقار","إيجار","تطوير عقاري"]}],
  "البيئة":[{name:"الطقس والمناخ",keywords:["طقس","أرصاد","مناخ"]},{name:"المياه والزراعة",keywords:["مياه","زراعة"]},{name:"الاستدامة",keywords:["استدامة","تشجير","انبعاثات"]}],
  "الوظائف":[{name:"فرص وظيفية",keywords:["وظائف","توظيف","فرصة عمل"]},{name:"سوق العمل",keywords:["سوق العمل","مهارات","باحث"]}],
  "الفعاليات":[{name:"مواسم ومهرجانات",keywords:["موسم","مهرجان","حفلة"]},{name:"معارض ومؤتمرات",keywords:["معرض","مؤتمر","ملتقى"]}]
};

export function classifyNewsCategory(text:string,allowed:readonly NewsCategory[],requireKeyword=false):NewsCategory|null{
  const normalized=text.toLocaleLowerCase("ar");
  let best:NewsCategory|null=null,bestScore=0;
  for(const category of allowed){const score=CATEGORY_KEYWORDS[category].reduce((total,keyword)=>total+(normalized.includes(keyword.toLocaleLowerCase("ar"))?1:0),0);if(score>bestScore){best=category;bestScore=score;}}
  return bestScore?best:!requireKeyword&&allowed.length===1?allowed[0]:null;
}

export function classifyNewsSubcategory(text:string,category:NewsCategory){
  const normalized=text.toLocaleLowerCase("ar");
  let best="",bestScore=0;
  for(const candidate of SUBCATEGORY_KEYWORDS[category]){const score=candidate.keywords.reduce((total,keyword)=>total+(normalized.includes(keyword.toLocaleLowerCase("ar"))?1:0),0);if(score>bestScore){best=candidate.name;bestScore=score;}}
  return bestScore?best:null;
}

export function summarizeNews(value:string,maxLength=360){
  const clean=value.replace(/\s+/g," ").trim();
  if(clean.length<=maxLength)return clean;
  const sentences=clean.match(/[^.!؟]+[.!؟]?/g)||[clean];
  let summary="";
  for(const sentence of sentences){if((summary+sentence).length>maxLength)break;summary+=`${sentence.trim()} `;}
  return editorialClean((summary.trim()||`${clean.slice(0,maxLength-1).trim()}…`).slice(0,maxLength));
}

export type StructuredNews={title:string;summary:string;details:string[]};

const COMPARISON_STOP_WORDS=new Set(["في","من","إلى","الى","على","عن","مع","أن","ان","إن","ما","هو","هي","هذا","هذه","ذلك","تلك","بعد","قبل","عبر","لدى","بين","خلال","ضمن","كما","قد"]);

export function removeEditorialBoilerplate(value:string){
  return value
    .replace(/وبحسب المادة المنشورة[،,:؛]?\s*/gu,"")
    .replace(/\s+/g," ")
    .trim();
}

function editorialClean(value:string){
  let cleaned=removeEditorialBoilerplate(value)
    .replace(/<!\[CDATA\[|\]\]>/g,"")
    .replace(/<[^>]+>/g," ")
    .replace(/&nbsp;|&#160;/gi," ")
    .replace(/&amp;/gi,"&")
    .replace(/&quot;/gi,'"')
    .replace(/&#39;|&apos;/gi,"'")
    .replace(/(?<![\p{L}\p{N}])([\p{L}\p{N}]{3,})(?:\s+\1)+(?![\p{L}\p{N}])/giu,"$1")
    .replace(/([(\[«“])\s+/g,"$1")
    .replace(/\s+([)\]»”])/g,"$1")
    .replace(/\s+([،؛:.!؟])/g,"$1")
    .replace(/([،؛:.!؟]){2,}/g,"$1")
    .replace(/\s+/g," ")
    .trim();
  if((cleaned.match(/«/g)||[]).length!==(cleaned.match(/»/g)||[]).length)cleaned=cleaned.replace(/[«»]/g,"");
  if((cleaned.match(/“/g)||[]).length!==(cleaned.match(/”/g)||[]).length)cleaned=cleaned.replace(/[“”]/g,"");
  if((cleaned.match(/"/g)||[]).length%2)cleaned=cleaned.replace(/"/g,"");
  return cleaned;
}

function comparisonTokens(value:string){
  return editorialClean(value).toLocaleLowerCase("ar").normalize("NFKD").replace(/[\u064b-\u065f\u0670]/g,"").replace(/[^\p{L}\p{N}\s]/gu," ").split(/\s+/).map((word)=>word.replace(/^ال(?=.{3})/u,"")).filter((word)=>word.length>1&&!COMPARISON_STOP_WORDS.has(word));
}

export function isNearDuplicate(first:string,second:string){
  const a=comparisonTokens(first),b=comparisonTokens(second);
  if(!a.length||!b.length)return false;
  const aSet=new Set(a),bSet=new Set(b),shared=[...aSet].filter((word)=>bSet.has(word)).length;
  const normalizedA=a.join(" "),normalizedB=b.join(" ");
  const lengthRatio=Math.min(normalizedA.length,normalizedB.length)/Math.max(normalizedA.length,normalizedB.length);
  return normalizedA===normalizedB||(lengthRatio>=.68&&(normalizedA.includes(normalizedB)||normalizedB.includes(normalizedA)))||shared/Math.max(aSet.size,bSet.size)>=.76;
}

function sentenceParts(value:string){
  return (editorialClean(value).match(/[^.!؟؛]+[.!؟؛]?/gu)||[]).map((sentence)=>sentence.trim()).filter(Boolean);
}

function validSentence(value:string){
  const sentence=editorialClean(value);
  if(comparisonTokens(sentence).length<3)return false;
  if(/(?:^|\s)الرئيس التنفيذي لشركة\s*[.،؛:!؟]*$/u.test(sentence))return false;
  if(/(?:^|\s)(?:و|أو|أم|ثم|لكن|لأن|بأن|إن|أن|عن|في|من|إلى|على|مع|لدى|بين|خلال|ضمن)[،؛:]?$/u.test(sentence))return false;
  return !/^(?:إعلان|إعلانات|تابعونا|للمزيد|اقرأ أيضا|اشترك|المصدر)\b/iu.test(sentence);
}

function finishSentence(value:string){
  const sentence=editorialClean(value).replace(/[،؛:]+$/u,"").trim();
  return sentence&&!/[.!؟]$/u.test(sentence)?`${sentence}.`:sentence;
}

function originalSummaryWording(value:string){
  const original=finishSentence(value),rewritten=finishSentence(value
    .replace(/^وتعليقاً على ذلك، قال (.+?)، أيضًا المؤلف المشارك لهذه الدراسة\s*["“]?\s*/u,"وأشار $1، وهو أيضًا المؤلف المشارك في الدراسة، إلى أن ")
    .replace(/^طورت\s+(.+)[،,]\s*طورت\s+/u,"عملت $1 على تطوير ")
    .replace(/^أعلن\s+(.+?)\s+عن\s+/u,"كشف $1 عن ")
    .replace(/^أعلنت\s+(.+?)\s+عن\s+/u,"كشفت $1 عن ")
    .replace(/^قال\s+(.+?)\s+إن\s+/u,"أفاد $1 بأن ")
    .replace(/^قالت\s+(.+?)\s+إن\s+/u,"أفادت $1 بأن ")
    .replace(/^أوضح\s+(.+?)\s+أن\s+/u,"بيّن $1 أن ")
    .replace(/^أوضحت\s+(.+?)\s+أن\s+/u,"بيّنت $1 أن ")
    .replace(/^طورت\s+(.+?)\s+/u,"أنجزت $1 ")
    .replace(/^طوّر\s+(.+?)\s+/u,"أنجز $1 ")
    .replace(/يطوّرون|يطورون/gu,"يعملون على تطوير")
    .replace(/أظهرت/gu,"بيّنت")
    .replace(/أظهر/gu,"بيّن")
    .replace(/اختارت/gu,"أدرجت")
    .replace(/أطلقت/gu,"دشّنت")
    .replace(/يهدف/gu,"يسعى")
    .replace(/يوفر/gu,"يتيح")
    .replace(/ويجسّد|ويجسد/gu,"ويعكس")
    .replace(/ويعمل/gu,"ويركز")
    .replace(/تم اختيار/gu,"وقع الاختيار على")
    .replace(/تقليدياً، يتم تصنيع الأجهزة الكمية عادةً/gu,"عادةً ما تُصنع الأجهزة الكمية")
    .replace(/تقليدياً، يتم تصنيع/gu,"عادةً ما يُصنع")
    .replace(/تمكنت/gu,"استطاعت")
    .replace(/تمكنوا/gu,"استطاعوا")
    .replace(/تمكن/gu,"استطاع")
    .replace(/يمكنها/gu,"تستطيع")
    .replace(/يمكنه/gu,"يستطيع")
    .replace(/ويعد|ويُعد|يعد|يُعد/gu,"ويمثل")
    .replace(/يؤدي/gu,"يسهم")
    .replace(/تقليل/gu,"خفض")
    .replace(/يسهم(.{0,100}) إلى خفض/gu,"يسهم$1 في خفض")
    .replace(/أكبر التحديات/gu,"أبرز الصعوبات")
    .replace(/استخدام/gu,"الاعتماد على")
    .replace(/إنشاء/gu,"إنتاج")
    .replace(/\bتم\s+/gu,"جرى ")
    .replace(/بهدف/gu,"سعيًا إلى"));
  const withoutLead=original.replace(/^(?:وقد|و|كما)\s*/u,"").replace(/[.!؟]$/u,"");
  return rewritten===original?finishSentence(withoutLead):rewritten;
}

export function conciseNewsTitle(value:string,maxLength=160){
  let title=editorialClean(value)
    .replace(/^\s*(?:عاجل|خبر عاجل|تحديث)\s*[:：-]\s*/iu,"")
    .replace(/\s+\d{4}-\d{2}-\d{2}(?:\s+\d{2}:\d{2}(?::\d{2})?)?\s*(?:-->)?\s*$/u,"")
    .replace(/\s*[|｜]\s*(?:صحيفة\s+)?[^|｜]{2,45}$/u,"")
    .replace(/[.،؛:!؟]+$/u,"")
    .trim();
  if(title.length>maxLength){const shortened=title.slice(0,maxLength+1).replace(/\s+\S*$/u,"").replace(/[،؛:]+$/u,"").trim();if(shortened)title=shortened;}
  return editorialClean(title);
}

/** Builds distinct editorial fields from retrieved text without inventing facts. */
export function structureRetrievedNews(rawTitle:string,rawBody:string):StructuredNews{
  const title=conciseNewsTitle(rawTitle);
  const sentences=sentenceParts(rawBody).filter(validSentence).map(finishSentence).filter((sentence,index,all)=>all.findIndex((candidate)=>isNearDuplicate(candidate,sentence))===index);
  const nonTitleSentences=sentences.filter((sentence)=>!isNearDuplicate(sentence,title));
  const briefCandidates=(nonTitleSentences.length?nonTitleSentences:sentences).slice(0,1);
  let summary=briefCandidates.map(originalSummaryWording).join(" ");
  summary=summarizeNews(summary,280);
  if(isNearDuplicate(summary,title))summary="";
  const details=sentences
    .filter((sentence)=>!isNearDuplicate(sentence,title)&&!isNearDuplicate(sentence,summary)&&!briefCandidates.some((brief)=>isNearDuplicate(brief,sentence)))
    .filter((sentence,index,all)=>all.findIndex((candidate)=>isNearDuplicate(candidate,sentence))===index)
    .slice(0,3)
    .map(originalSummaryWording);
  return {title,summary,details};
}
