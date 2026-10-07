import assert from "node:assert/strict";
import test from "node:test";
import { balanceCategories, classifyGeography, scoreEditorialPriority } from "../lib/editorial-policy.ts";
import type { SiteSettings } from "../types/news.ts";

const settings={siteName:"",tagline:"",timezone:"Asia/Riyadh",homepageCategories:[],hiddenCategories:[],priorityCategories:[],desktopCount:6,tabletCount:5,mobileCount:4,showTime:true,showBadges:true,breakingHours:12,homepageHours:48,categoryHours:48,latestDays:3,recentDays:7,archiveDays:8,minimumFreshHomepagePosts:3,minimumFreshPriorityPosts:3,minimumValidatedReservePosts:3,recoveryDays:30,maxHomepageItemsPerCategory:2,recencyWeight:22,saudiRelevanceWeight:20,breakingNewsWeight:16,sourceQualityWeight:10,publicImpactWeight:13,officialSourceWeight:9,corroborationWeight:4,categoryPriorityWeights:{"أخبار السعودية":12,"السفر":1}} satisfies SiteSettings;
const source={country:"SA",region:"",reliabilityScore:95,priority:1,sourceType:"official",domain:"spa.gov.sa"};

test("detects Saudi regions from article content instead of source alone",()=>{
  assert.deepEqual(classifyGeography("مشروع نقل جديد في مدينة أبها",["أعلنت الجهة تفاصيل المشروع في منطقة عسير."],source),{geographicRelevance:"saudi_region",region:"عسير"});
});

test("major Saudi official news outranks a newer minor lifestyle item",()=>{
  const national=scoreEditorialPriority({title:"أمر ملكي بشأن خدمة وطنية جديدة",body:["أعلن الديوان الملكي القرار لخدمة المواطنين في المملكة."],category:"أخبار السعودية",publishedAt:new Date(Date.now()-4*3600000).toISOString(),source,geographicRelevance:"saudi_national",breaking:false,settings});
  const lifestyle=scoreEditorialPriority({title:"افتتاح وجهة سياحية موسمية",body:["تستقبل الوجهة الزوار بفعاليات ترفيهية متنوعة."],category:"السفر",publishedAt:new Date().toISOString(),source:{...source,reliabilityScore:75,priority:8,domain:"travel.example"},geographicRelevance:"international",breaking:false,settings});
  assert.ok(national.priorityScore>lifestyle.priorityScore);
  assert.ok(["أولوية قصوى","مهم"].includes(national.importanceLevel));
});

test("homepage balancing applies soft category caps and honors pins",()=>{
  const articles=[{id:"a",category:"الرياضة",priorityScore:90,homepagePinned:false},{id:"b",category:"الرياضة",priorityScore:89,homepagePinned:false},{id:"c",category:"الرياضة",priorityScore:88,homepagePinned:false},{id:"d",category:"الصحة",priorityScore:70,homepagePinned:false},{id:"e",category:"المجتمع",priorityScore:65,homepagePinned:true}];
  assert.deepEqual(balanceCategories(articles,4,2).map((item)=>item.id),["e","a","b","d"]);
});
