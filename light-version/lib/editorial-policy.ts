import { normalizeArabic } from "./content-policy.ts";
import type { GeographicRelevance, ImportanceLevel, SiteSettings, Source } from "../types/news.ts";

const REGION_TERMS:Record<string,string[]>={
  "الرياض":["الرياض","الدرعيه","الخرج","الدوادمي","المجمعه"],"مكة المكرمة":["مكه","جده","الطايف","القنفذه","رابغ"],
  "المدينة المنورة":["المدينه المنوره","ينبع","العلا"],"المنطقة الشرقية":["الشرقيه","الدمام","الخبر","الظهران","الاحساء","الجبيل","القطيف"],
  "القصيم":["القصيم","بريده","عنيزه"],"عسير":["عسير","ابها","خميس مشيط","بيشه"],"تبوك":["تبوك","ضباء","املج"],
  "حائل":["حايل"],"الحدود الشمالية":["الحدود الشماليه","عرعر","رفحاء"],"جازان":["جازان","صبيا"],"نجران":["نجران"],
  "الباحة":["الباحه","بلجرشي"],"الجوف":["الجوف","سكاكا","دومه الجندل"]
};
const NATIONAL=/(?:خادم الحرمين|ولي العهد|امر ملكي|اوامر ملكيه|مجلس الوزراء|رؤيه 2030|المملكه العربيه السعوديه|وزاره الداخليه|وزاره الخارجيه|الديوان الملكي)/u;
const GULF_ARAB=/(?:الامارات|الكويت|البحرين|قطر|عمان|الخليج|مصر|الاردن|العراق|لبنان|سوريا|فلسطين|المغرب|الجزائر|تونس|السودان|اليمن)/u;
const HIGH_IMPACT=/(?:امر ملكي|قرار مجلس الوزراء|حاله طوارئ|كارثه|زلزال|سيول|حرب|هجوم|وقف اطلاق النار|وفاه|تعليق الدراسه|تغيير رسوم|رفع اسعار|خفض اسعار|وظايف|رواتب|معاشات|دعم|علاج|وباء)/u;
const OFFICIAL=/(?:وزاره|هيئه|الديوان الملكي|مجلس الوزراء|اماره|محافظه|جامعه حكوميه|المركز الوطني|النيابه العامه)/u;

export function classifyGeography(title:string,body:string[],source:Pick<Source,"country"|"region">):{geographicRelevance:GeographicRelevance;region:string}{
  const text=normalizeArabic(`${title} ${body.join(" ")}`);
  for(const [region,terms] of Object.entries(REGION_TERMS))if(terms.some((term)=>text.includes(normalizeArabic(term))))return {geographicRelevance:"saudi_region",region};
  if(NATIONAL.test(text)||/(?:السعوديه|المملكه)/u.test(text))return {geographicRelevance:"saudi_national",region:""};
  if(GULF_ARAB.test(text))return {geographicRelevance:"gulf_arab",region:""};
  if(/^(?:sa|saudi arabia|السعوديه)$/iu.test(source.country.trim())||source.region){return {geographicRelevance:source.region?"saudi_region":"saudi_national",region:source.region};}
  return {geographicRelevance:"international",region:""};
}

export function scoreEditorialPriority(input:{title:string;body:string[];category:string;publishedAt:string;source:Pick<Source,"reliabilityScore"|"priority"|"sourceType"|"domain">;geographicRelevance:GeographicRelevance;breaking:boolean;supportingSourceCount?:number;settings:SiteSettings}){
  const {settings}=input,text=normalizeArabic(`${input.title} ${input.body.join(" ")}`),ageHours=Math.max(0,(Date.now()-Date.parse(input.publishedAt))/3600000);
  const recency=Math.max(0,1-ageHours/Math.max(24,settings.homepageHours)),saudi=input.geographicRelevance==="saudi_national"?1:input.geographicRelevance==="saudi_region"?0.9:input.geographicRelevance==="gulf_arab"?0.45:0.15;
  const sourceQuality=Math.min(1,Math.max(0,input.source.reliabilityScore/100))*.75+Math.max(0,1-(input.source.priority-1)/20)*.25;
  const official=OFFICIAL.test(text)||/(?:gov\.sa|spa\.gov\.sa)$/i.test(input.source.domain)?1:0,impact=HIGH_IMPACT.test(text)?1:/(?:الصحه|التعليم|الامن|النقل|الاقتصاد|الطاقه|الرياضه)/u.test(text)?0.6:0.3;
  const corroboration=Math.min(1,(input.supportingSourceCount||0)/3),categoryWeight=Number(settings.categoryPriorityWeights[input.category]||0);
  let score=recency*settings.recencyWeight+saudi*settings.saudiRelevanceWeight+(input.breaking?settings.breakingNewsWeight:0)+sourceQuality*settings.sourceQualityWeight+impact*settings.publicImpactWeight+official*settings.officialSourceWeight+corroboration*settings.corroborationWeight+categoryWeight;
  score=Math.max(0,Math.min(100,Math.round(score)));
  const importanceLevel:ImportanceLevel=input.breaking?"عاجل":score>=82?"أولوية قصوى":score>=62?"مهم":score>=28?"عادي":"منخفض الأولوية";
  return {priorityScore:score,importanceLevel};
}

export function balanceCategories<T extends {category:string;priorityScore:number;homepagePinned:boolean}>(articles:T[],limit:number,maxPerCategory:number){
  const sorted=[...articles].sort((a,b)=>Number(b.homepagePinned)-Number(a.homepagePinned)||b.priorityScore-a.priorityScore),selected:T[]=[],deferred:T[]=[],counts=new Map<string,number>();
  for(const article of sorted){const count=counts.get(article.category)||0;if(!article.homepagePinned&&count>=maxPerCategory){deferred.push(article);continue;}selected.push(article);counts.set(article.category,count+1);if(selected.length===limit)return selected;}
  return [...selected,...deferred].slice(0,limit);
}
