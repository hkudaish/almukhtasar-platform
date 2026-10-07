import type { BreakingDetectionMethod, BreakingEvidence } from "@/types/news";

const breakingValue=/^(?:عاجل|أخبار عاجلة|الأخبار العاجلة|breaking|breaking news|urgent)$/iu;
function normalized(value:unknown){return String(value??"").replace(/<[^>]+>/g," ").replace(/\s+/g," ").trim();}
export function verifiedBreakingEvidence(value:unknown,detectedBy:BreakingDetectionMethod):BreakingEvidence{
  const sourceValue=normalized(value);
  return {verified:breakingValue.test(sourceValue),detectedBy:breakingValue.test(sourceValue)?detectedBy:null,sourceValue};
}
export function booleanBreakingEvidence(value:unknown,detectedBy:Extract<BreakingDetectionMethod,"api"|"metadata">):BreakingEvidence{
  const verified=value===true||value===1||/^(?:true|1|breaking|urgent)$/i.test(normalized(value));
  return {verified,detectedBy:verified?detectedBy:null,sourceValue:normalized(value)};
}
export function strongestBreakingEvidence(...values:Array<BreakingEvidence|undefined>):BreakingEvidence{
  return values.find((value)=>value?.verified)||{verified:false,detectedBy:null,sourceValue:""};
}
export function cleanVerifiedBreakingTitle(title:string,evidence:BreakingEvidence){
  if(!evidence.verified)return title.trim();
  return title.replace(/^\s*(?:عاجل|breaking(?:\s+news)?)\s*[:：|\-–—]\s*/iu,"").trim()||title.trim();
}
