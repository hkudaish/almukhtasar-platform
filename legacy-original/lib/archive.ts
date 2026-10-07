import { stories, type Story } from "@/lib/data";

export const arabicMonths = [
  "يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو",
  "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"
];

export type ArchiveDate = { year: number; month: number; day: number; key: string };

export function storyDate(story: Story): ArchiveDate {
  const [year, month, day] = story.publishedAt.slice(0, 10).split("-").map(Number);
  return { year, month, day, key: dateKey(year, month, day) };
}

export function dateKey(year: number, month: number, day: number) {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function getArchiveYears(items:Story[]=stories) {
  return [...new Set(items.map((story) => storyDate(story).year))].sort((a, b) => b - a);
}

export function getArchiveMonths(year: number,items:Story[]=stories) {
  return [...new Set(items.filter((story) => storyDate(story).year === year).map((story) => storyDate(story).month))].sort((a, b) => b - a);
}

export function getArchiveDays(year: number, month: number,items:Story[]=stories) {
  return [...new Set(items.filter((story) => { const date = storyDate(story); return date.year === year && date.month === month; }).map((story) => storyDate(story).day))].sort((a, b) => b - a);
}

export function getStoriesByDate(year: number, month: number, day: number,items:Story[]=stories) {
  return items.filter((story) => storyDate(story).key === dateKey(year, month, day));
}

export function groupStoriesByCategory(items: Story[]) {
  return items.reduce<Record<string, Story[]>>((groups, story) => {
    (groups[story.category] ||= []).push(story);
    return groups;
  }, {});
}

export function monthLabel(year: number, month: number) {
  return `${arabicMonths[month - 1]} ${year}`;
}

export function dayLabel(month: number, day: number) {
  return `${day} ${arabicMonths[month - 1]}`;
}

export function archivePath(year: number, month?: number, day?: number) {
  const parts = ["/archive", year];
  if (month !== undefined) parts.push(String(month).padStart(2, "0"));
  if (day !== undefined) parts.push(String(day).padStart(2, "0"));
  return parts.join("/");
}

export function parseArchiveDate(value?: string) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [year, month, day] = value.split("-").map(Number);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  return { year, month, day, key: value };
}
