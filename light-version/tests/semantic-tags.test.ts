import test from "node:test";
import assert from "node:assert/strict";
import { extractSemanticTags } from "../lib/semantic-tags.ts";

test("extracts relevant topics, places and natural phrases",()=>{
  const result=extractSemanticTags({title:"ارتفاع أسعار الذهب مع ترقب بيانات التضخم الأمريكية",body:["ارتفع الذهب في الأسواق العالمية مع انتظار المستثمرين بيانات اقتصادية جديدة في الولايات المتحدة."],category:"الاقتصاد",sourceName:"صحيفة المثال",sourceDomain:"example.com"});
  assert.ok(result.tags.includes("الاقتصاد"));
  assert.ok(result.tags.includes("الولايات المتحدة"));
  assert.ok(result.keyphrases.some((phrase)=>phrase.split(" ").length>1));
});

test("excludes source and brand terms and removes normalized duplicates",()=>{
  const result=extractSemanticTags({title:"سبق تطلق تقريرًا عن التقنية والتحول الرقمي",body:["يتناول التقرير تطبيقات التقنية والتحول الرقمي في مدينة الرياض."],category:"التقنية",region:"الرياض",sourceName:"صحيفة سبق",sourceDomain:"sabq.org"});
  assert.ok(result.tags.every((tag)=>!/(?:سبق|sabq)/iu.test(tag)));
  assert.equal(new Set(result.tags).size,result.tags.length);
});
