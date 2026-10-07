import "server-only";
import { getSettings } from "@/lib/admin-db";
import { categories } from "@/lib/data";

export type LightVersionSettings = {
  enabled: boolean;
  defaultMode: "النسخة الكاملة" | "النسخة الخفيفة" | "الخفيفة على الجوال فقط";
  desktopCount: number;
  mobileCount: number;
  pageSize: number;
  categories: string[];
  showTime: boolean;
  showBadges: boolean;
};

export const lightVersionDefaults:LightVersionSettings={
  enabled:true,
  defaultMode:"النسخة الكاملة",
  desktopCount:6,
  mobileCount:4,
  pageSize:20,
  categories:categories.slice(1),
  showTime:true,
  showBadges:true
};

function categoryList(value:unknown){
  const parsed=Array.isArray(value)?value.map(String):String(value||"").split(/[\n،,]+/);
  return [...new Set(parsed.map((item)=>item.trim()).filter(Boolean))];
}

export function getLightVersionSettings():LightVersionSettings{
  const stored=getSettings("light_version")[0]?.value||{};
  const selected=categoryList(stored.categories);
  return {
    enabled:stored.enabled===undefined?lightVersionDefaults.enabled:Boolean(stored.enabled),
    defaultMode:["النسخة الكاملة","النسخة الخفيفة","الخفيفة على الجوال فقط"].includes(String(stored.defaultMode))?stored.defaultMode as LightVersionSettings["defaultMode"]:lightVersionDefaults.defaultMode,
    desktopCount:Math.min(12,Math.max(1,Number(stored.desktopCount)||lightVersionDefaults.desktopCount)),
    mobileCount:Math.min(8,Math.max(1,Number(stored.mobileCount)||lightVersionDefaults.mobileCount)),
    pageSize:Math.min(50,Math.max(8,Number(stored.pageSize)||lightVersionDefaults.pageSize)),
    categories:selected.length?selected:lightVersionDefaults.categories,
    showTime:stored.showTime===undefined?lightVersionDefaults.showTime:Boolean(stored.showTime),
    showBadges:stored.showBadges===undefined?lightVersionDefaults.showBadges:Boolean(stored.showBadges)
  };
}
