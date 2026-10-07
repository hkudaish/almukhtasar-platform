import { DatabaseSync } from "node:sqlite";
import { isSourceBoilerplate, cleanSummaryText } from "../lib/content-policy.ts";

const db = new DatabaseSync("database/light-news.db");

const rows = db.prepare("SELECT id, title, summary, content FROM articles").all() as Array<{
  id: string;
  title: string;
  summary: string;
  content: string;
}>;

const updateStmt = db.prepare("UPDATE articles SET summary=?, content=? WHERE id=?");

let cleanedArticlesCount = 0;
let cleanedParagraphsCount = 0;
let cleanedSummariesCount = 0;

for (const row of rows) {
  let changed = false;
  let paragraphs: string[] = [];

  try {
    paragraphs = JSON.parse(row.content);
  } catch {
    paragraphs = [];
  }

  const filteredParagraphs = paragraphs.filter((p) => {
    const isBoilerplate = isSourceBoilerplate(p);
    if (isBoilerplate) {
      cleanedParagraphsCount++;
    }
    return !isBoilerplate;
  });

  if (filteredParagraphs.length !== paragraphs.length) {
    changed = true;
  }

  const cleanedSummary = cleanSummaryText(row.summary);
  if (cleanedSummary !== row.summary) {
    changed = true;
    cleanedSummariesCount++;
  }

  if (changed) {
    updateStmt.run(cleanedSummary, JSON.stringify(filteredParagraphs), row.id);
    cleanedArticlesCount++;
  }
}

console.log("Migration finished successfully!");
console.log(`- Cleaned articles: ${cleanedArticlesCount}`);
console.log(`- Cleaned boilerplate paragraphs: ${cleanedParagraphsCount}`);
console.log(`- Cleaned boilerplate summaries: ${cleanedSummariesCount}`);
