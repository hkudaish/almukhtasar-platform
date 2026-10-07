import type { MetadataRoute } from "next";
export default function manifest(): MetadataRoute.Manifest { return { name:"المختصر — أهم ما تحتاج معرفته", short_name:"المختصر", description:"ملخصات موثوقة لأهم الأخبار والتحديثات اليومية.", start_url:"/", display:"standalone", background_color:"#f7f8fa", theme_color:"#e83d4f", lang:"ar", dir:"rtl", categories:["news","education"] }; }
