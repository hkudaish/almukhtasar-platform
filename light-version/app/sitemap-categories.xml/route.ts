import { database } from "@/database/database";

export const dynamic="force-dynamic";
export function GET(){const base=(process.env.SITE_URL||"http://localhost:3000").replace(/\/$/,""),rows=database.prepare("SELECT DISTINCT main_category category FROM articles WHERE publication_status='published'").all() as Array<{category:string}>;const urls=rows.map((row)=>`<url><loc>${base}/category/${encodeURIComponent(row.category)}</loc><changefreq>daily</changefreq><priority>0.8</priority></url>`).join("");return new Response(`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls}</urlset>`,{headers:{"Content-Type":"application/xml; charset=utf-8","Cache-Control":"public, max-age=3600"}});}
