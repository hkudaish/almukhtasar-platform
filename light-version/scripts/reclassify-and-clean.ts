import { DatabaseSync } from "node:sqlite";
import { classifyArticle } from "../lib/content-policy.ts";

const db = new DatabaseSync("database/light-news.db");

// 1. Mark non-Arabic articles as rejected
const nonArabic = db.prepare("SELECT id, title FROM articles").all() as Array<{ id: string; title: string }>;
let rejectedNonArabic = 0;
for (const art of nonArabic) {
  if (!/[\u0600-\u06FF]/.test(art.title)) {
    db.prepare("UPDATE articles SET publication_status='rejected', archive_status='rejected', validation_status='invalid' WHERE id=?").run(art.id);
    rejectedNonArabic++;
  }
}
console.log(`Rejected ${rejectedNonArabic} non-Arabic articles.`);

// 2. Re-classify articles in specialized verticals or general categories
const sources = new Map(
  (db.prepare("SELECT * FROM sources").all() as any[]).map((s) => [
    s.id,
    {
      ...s,
      mainCategories: JSON.parse(s.main_categories),
      subcategories: JSON.parse(s.subcategories),
      excludedKeywords: JSON.parse(s.excluded_keywords),
    },
  ])
);

const all = db.prepare(
  "SELECT id, title, main_category, content, source_id, source_url, canonical_url FROM articles WHERE publication_status != 'rejected'"
).all() as any[];

let movedCount = 0;
for (const art of all) {
  const s = sources.get(art.source_id) || { mainCategories: [], subcategories: [], excludedKeywords: [] };
  const res = classifyArticle(
    {
      title: art.title,
      body: JSON.parse(art.content),
      canonicalUrl: art.canonical_url,
      url: art.source_url,
    },
    s
  );

  // If article was in AI or Cars, but new winner is politics or tech with strong score, move it!
  const isSpecializedOld = ["الذكاء الاصطناعي", "السيارات"].includes(art.main_category);
  if (res.category !== art.main_category && (res.score >= 8 || isSpecializedOld) && !res.needsReview) {
    db.prepare("UPDATE articles SET main_category=?, category_confidence=? WHERE id=?").run(res.category, res.confidence, art.id);
    console.log(`Moved: [${art.title.slice(0, 45)}] from "${art.main_category}" to "${res.category}" (confidence: ${res.confidence})`);
    movedCount++;
  }
}
console.log(`Total moved articles: ${movedCount}`);
