import type { MetadataRoute } from "next";

export default function robots():MetadataRoute.Robots{
  const base=(process.env.SITE_URL||"http://localhost:3000").replace(/\/$/,"");
  return {rules:{userAgent:"*",allow:"/",disallow:["/admin","/api/","/search","/*?*"]},sitemap:[`${base}/sitemap.xml`,`${base}/sitemap-news.xml`,`${base}/sitemap-categories.xml`]};
}
