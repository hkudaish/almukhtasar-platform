import test from "node:test";
import assert from "node:assert/strict";
import { booleanBreakingEvidence, cleanVerifiedBreakingTitle, strongestBreakingEvidence, verifiedBreakingEvidence } from "../lib/breaking-news.ts";

test("does not infer breaking status from a headline",()=>{
  const evidence=verifiedBreakingEvidence("اقتصاد","category");
  assert.equal(evidence.verified,false);
  assert.equal(cleanVerifiedBreakingTitle("عاجل: قرار اقتصادي جديد",evidence),"عاجل: قرار اقتصادي جديد");
});

test("accepts explicit source metadata and cleans only a redundant prefix",()=>{
  const evidence=strongestBreakingEvidence(booleanBreakingEvidence(true,"api"),verifiedBreakingEvidence("اقتصاد","category"));
  assert.equal(evidence.verified,true);
  assert.equal(evidence.detectedBy,"api");
  assert.equal(cleanVerifiedBreakingTitle("عاجل: صدور قرار جديد",evidence),"صدور قرار جديد");
});

test("recognizes an explicit breaking feed category",()=>{
  const evidence=verifiedBreakingEvidence("الأخبار العاجلة","category");
  assert.equal(evidence.verified,true);
  assert.equal(evidence.detectedBy,"category");
});
