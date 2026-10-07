import type { MetadataRoute } from "next";
export default function robots(): MetadataRoute.Robots { return { rules: [{ userAgent: "*", allow: "/", disallow: ["/admin/", "/search?"] }], sitemap: "https://almukhtasar.example/sitemap.xml", host: "https://almukhtasar.example" }; }
