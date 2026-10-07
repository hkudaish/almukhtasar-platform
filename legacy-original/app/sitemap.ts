import type { MetadataRoute } from "next";
import { categories } from "@/lib/data";
import { policyPages } from "@/lib/policies";
import { archivePath, getArchiveDays, getArchiveMonths, getArchiveYears } from "@/lib/archive";
import { getPublishedImportedStories } from "@/lib/public-content";

const base = "https://almukhtasar.example";

export default function sitemap(): MetadataRoute.Sitemap {
  const stories=getPublishedImportedStories(100);
  const archiveRoutes = getArchiveYears().flatMap((year) => [
    archivePath(year),
    ...getArchiveMonths(year).flatMap((month) => [
      archivePath(year, month),
      ...getArchiveDays(year, month).map((day) => archivePath(year, month, day))
    ])
  ]);

  return [
    { url: base, lastModified: new Date(), changeFrequency: "hourly", priority: 1 },
    { url: `${base}/archive`, changeFrequency: "daily", priority: .7 },
    { url: `${base}/about`, changeFrequency: "monthly", priority: .5 },
    { url: `${base}/contact`, changeFrequency: "yearly", priority: .4 },
    ...archiveRoutes.map((path) => ({ url: `${base}${path}`, changeFrequency: "daily" as const, priority: .6 })),
    ...stories.map((story) => ({ url: `${base}/news/${story.id}`, lastModified: new Date(story.publishedAt), changeFrequency: "daily" as const, priority: .8 })),
    ...categories.slice(1).map((category) => ({ url: `${base}/category/${encodeURIComponent(category)}`, changeFrequency: "hourly" as const, priority: .7 })),
    ...Object.keys(policyPages).map((slug) => ({ url: `${base}/policies/${slug}`, changeFrequency: "yearly" as const, priority: .3 }))
  ];
}
