import { normalizeArabic } from "./content-policy.ts";

type Input={title:string;body:string[];category:string;subcategory?:string;region?:string;sourceName:string;sourceDomain?:string};
const stop=new Set("في من على إلى الى عن مع بعد قبل خلال لدى بين ضد دون حول عند هذا هذه ذلك التي الذي هو هي تم كما ما لا لم لن قد كل أكثر اكثر ضمن عبر حتى اليوم أمس امس جديدة جديد خبر أخبار اخبار تقرير تقارير مصدر صحيفة وكالة قناة موقع".split(" "));
const generic=new Set(["أخبار","الأخبار","خبر","تقرير","متابعة","عاجل","اليوم", "السعودية"]);
const topics:Record<string,string[]>={
  "الاقتصاد والأسواق":["اقتصاد","استثمار","اسهم","أسهم","تضخم","ذهب","سوق مالي","تجاره","تجارة"],
  "الطاقة والنفط":["نفط","بترول","غاز","طاقه","طاقة","اوبك","أوبك"],
  "السياسة والعلاقات الدولية":["سياسه","سياسة","دبلوماسي","مفاوضات","انتخابات","برلمان","علاقات دوليه","علاقات دولية"],
  "التقنية والتحول الرقمي":["تقنيه","تقنية","رقمي","سيبراني","انترنت","إنترنت"],
  "الذكاء الاصطناعي":["ذكاء اصطناعي","خوارزميه","خوارزمية","نموذج لغوي"],
  "الصحة العامة":["صحه","صحة","مرض","علاج","دواء","مستشفى"],
  "التعليم والتدريب":["تعليم","جامعه","جامعة","مدرسه","مدرسة","طلاب","تدريب"],
  "الرياضة السعودية":["رياضه","رياضة","دوري","نادي","مباراه","مباراة","بطوله","بطولة"],
  "الثقافة والفنون":["ثقافه","ثقافة","فيلم","أفلام","ممثله","ممثلة","ممثل","كاتب","كاتبة","سينما","مسرح","موسيقى","أزياء","موضة"],
  "السفر والسياحة":["سفر","سياحه","سياحة","طيران","فندق"],
  "الطقس والمناخ":["طقس","مناخ","أمطار","امطار","حراره","حرارة","عاصفه","عاصفة"]
};
const places=["السعودية","الرياض","مكة","جدة","المدينة المنورة","الدمام","القصيم","عسير","تبوك","جازان","نجران","الباحة","الجوف","الخليج العربي","الشرق الأوسط","فلسطين","غزة","العراق","سوريا","لبنان","اليمن","إيران","تركيا","روسيا","أوكرانيا","الصين","الولايات المتحدة","أوروبا"];
const entityPrefixes=["وزارة","هيئة","جامعة","شركة","مجلس","رئيس","وزير","ولي العهد","خادم الحرمين","البنك المركزي","الأمم المتحدة"];
function clean(value:string){return value.replace(/&\w+;|https?:\/\/\S+/gi," ").replace(/[^\p{L}\p{N}\s-]/gu," ").replace(/\s+/g," ").trim();}
function normalized(value:string){return normalizeArabic(clean(value));}
function sourceTerms(input:Input){const ignored=new Set(["صحيفه","وكاله","قناه","اخبار","الالكترونيه","السعوديه"]),values=[input.sourceName,input.sourceDomain||""].flatMap((value)=>normalized(value.replace(/\.[a-z.]+$/i,"")).split(/[\s.-]+/));return new Set(values.filter((value)=>value.length>=3&&!ignored.has(value)));}
function titlePhrases(title:string){const words=clean(title).split(" ").filter((word)=>word.length>2&&!stop.has(normalized(word))),phrases:string[]=[];for(let size=3;size>=2;size--)for(let index=0;index<=words.length-size;index++){const phrase=words.slice(index,index+size).join(" ");if(phrase.length>=9)phrases.push(phrase);}return phrases.slice(0,8);}
export function extractSemanticTags(input:Input){
  const text=clean(`${input.title} ${input.body.join(" ")}`),normalizedText=normalized(text),blocked=sourceTerms(input),candidates:Array<{value:string;score:number;phrase:boolean}>=[];
  const add=(value:string,score:number,phrase=false)=>{value=clean(value);const key=normalized(value);if(value.length<3||generic.has(value)||[...blocked].some((term)=>key.includes(term))||key.split(" ").every((word)=>stop.has(word)))return;candidates.push({value,score,phrase});};
  if(input.category)add(input.category,10);if(input.subcategory)add(input.subcategory,11);if(input.region)add(input.region,9);
  for(const [topic,signals] of Object.entries(topics))if(signals.some((signal)=>normalizedText.includes(normalized(signal))))add(topic,8,true);
  for(const place of places)if(normalizedText.includes(normalized(place)))add(place,7);
  for(const prefix of entityPrefixes){const match=text.match(new RegExp(`(?:^|\\s)(${prefix}\\s+[\\p{L}][\\p{L}\\s-]{2,42})`,`u`));if(match)add(match[1].split(" ").slice(0,5).join(" "),9,true);}
  // Do not promote arbitrary title fragments to tags: they frequently create
  // misleading phrases such as a partial quote rather than a real topic.
  const unique=new Map<string,{value:string;score:number;phrase:boolean}>();for(const item of candidates){const key=normalized(item.value);if(!unique.has(key)||unique.get(key)!.score<item.score)unique.set(key,item);}
  const ranked=[...unique.values()].sort((a,b)=>b.score-a.score||a.value.length-b.value.length),tags=ranked.slice(0,8).map((item)=>item.value),keyphrases=ranked.filter((item)=>item.phrase||item.value.includes(" ")).slice(0,6).map((item)=>item.value);
  return {tags,keyphrases};
}
