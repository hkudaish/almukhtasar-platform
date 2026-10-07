import { DatabaseSync } from "node:sqlite";

const db = new DatabaseSync("database/light-news.db");
const rows = db.prepare("SELECT id, title, source_name, content FROM articles").all() as Array<{
  id: string;
  title: string;
  source_name: string;
  content: string;
}>;

const SOURCE_BOILERPLATE_PATTERNS = [
  /صحيفة إلكترونية[^.؟!]{0,120}(?:تأسست|تم تأسيسها|تهتم بنشر|تصدر|شاملة)/u,
  /(?:صحيفة|مجلة|جريدة)\s+(?:[^\s.،]{1,25}\s+){0,4}(?:إلكترونية|سعودية|عربية|إخبارية|شاملة|متخصصة|مستقلة|يومية)?\s*(?:تم\s+تأسيسها|تأسست|تصدر\s+(?:عن|باللغة|يومي|أسبوعي|شهري)|تعنى\s+بـ|تعنى\s+بدعم|تهتم\s+بنشر|مرخصة)/u,
  /مجلة الأسرة العصرية تعنى/u,
  /صحيفة المرصد الكترونية/u,
  /لمشاهدة أجمل صور المشاهير/u,
  /زوروا\s+[«"]?\s*(?:إنستغرام|تويتر|موقعنا|حسابنا)/u,
  /تابعونا على/u,
  /اشترك في\s+(?:قناة|خدمة|حساب)/u,
  /حمل تطبيق/u,
  /تطبيق صحيفة/u,
  /جميع الحقوق محفوظة/u,
  /حقوق النشر محفوظة/u,
  /للتواصل مع (?:إدارة التحرير|الصحيفة|الموقع)/u
];

export function isSourceBoilerplate(text: string): boolean {
  const trimmed = text.trim();
  if (trimmed.length < 15) return false;
  return SOURCE_BOILERPLATE_PATTERNS.some((pattern) => pattern.test(trimmed));
}

let totalMatches = 0;
const uniqueMatches = new Set<string>();

for (const row of rows) {
  try {
    const paragraphs = JSON.parse(row.content);
    if (Array.isArray(paragraphs)) {
      for (const p of paragraphs) {
        if (typeof p === "string" && isSourceBoilerplate(p)) {
          totalMatches++;
          uniqueMatches.add(p);
        }
      }
    }
  } catch {}
}

console.log("Total matches:", totalMatches);
console.log("Unique matches count:", uniqueMatches.size);
for (const match of uniqueMatches) {
  console.log("->", match);
}
