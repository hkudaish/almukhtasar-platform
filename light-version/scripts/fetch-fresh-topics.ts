import { DatabaseSync } from "node:sqlite";

const db = new DatabaseSync("database/light-news.db");

async function fetchGoogleNewsFeed(query: string) {
  const url = `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=ar&gl=SA&ceid=SA:ar`;
  const res = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36",
      "Accept-Language": "ar-SA,ar;q=0.9"
    }
  });
  const text = await res.text();
  const items: any[] = [];
  const blocks = text.match(/<item>[\s\S]*?<\/item>/g) || [];
  for (const block of blocks) {
    const titleMatch = block.match(/<title>([\s\S]*?)<\/title>/);
    const pubDateMatch = block.match(/<pubDate>([\s\S]*?)<\/pubDate>/);
    const linkMatch = block.match(/<link>([\s\S]*?)<\/link>/);
    const sourceMatch = block.match(/<source[^>]*>([\s\S]*?)<\/source>/);
    const descMatch = block.match(/<description>([\s\S]*?)<\/description>/);
    if (titleMatch && pubDateMatch && linkMatch) {
      let title = titleMatch[1].replace(/<!\[CDATA\[|\]\]>/g, "").replace(/<[^>]+>/g, "").trim();
      const sourceName = sourceMatch ? sourceMatch[1].replace(/<!\[CDATA\[|\]\]>/g, "").trim() : "";
      if (sourceName && title.endsWith(` - ${sourceName}`)) {
        title = title.slice(0, -(sourceName.length + 3)).trim();
      }
      const desc = descMatch ? descMatch[1].replace(/<!\[CDATA\[|\]\]>/g, "").replace(/<[^>]+>/g, " ").trim() : "";
      items.push({
        title,
        link: linkMatch[1].trim(),
        pubDate: pubDateMatch[1].trim(),
        isoDate: new Date(pubDateMatch[1].trim()).toISOString(),
        source: sourceName,
        desc
      });
    }
  }
  return items;
}

const aiItems = await fetchGoogleNewsFeed("الذكاء الاصطناعي");
const todayAi = aiItems.filter(i => i.isoDate.startsWith("2026-10-07") || i.isoDate.startsWith("2026-10-06"));
console.log(`AI items from today/yesterday: ${todayAi.length}`);
console.log(todayAi.slice(0, 10));

const carItems = await fetchGoogleNewsFeed("سيارات");
const todayCars = carItems.filter(i => i.isoDate.startsWith("2026-10-07") || i.isoDate.startsWith("2026-10-06"));
console.log(`Car items from today/yesterday: ${todayCars.length}`);
console.log(todayCars.slice(0, 10));
