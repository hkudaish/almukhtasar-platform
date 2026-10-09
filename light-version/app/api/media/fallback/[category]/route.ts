import { NextResponse } from "next/server";

export const runtime = "nodejs";

interface CategoryTheme {
  colors: [string, string, string];
  icon: string;
}

const categoryThemes: Record<string, CategoryTheme> = {
  "أخبار السعودية": { colors: ["#0b472e", "#106341", "#062b1b"], icon: "🇸🇦" },
  "السعودية": { colors: ["#0b472e", "#106341", "#062b1b"], icon: "🇸🇦" },
  "السياسة": { colors: ["#1e293b", "#334155", "#0f172a"], icon: "🏛️" },
  "سياسة": { colors: ["#1e293b", "#334155", "#0f172a"], icon: "🏛️" },
  "العالم": { colors: ["#1e3a8a", "#2563eb", "#172554"], icon: "🌐" },
  "الاقتصاد": { colors: ["#064e3b", "#0d9488", "#022c22"], icon: "📈" },
  "اقتصاد": { colors: ["#064e3b", "#0d9488", "#022c22"], icon: "📈" },
  "الذكاء الاصطناعي": { colors: ["#4338ca", "#0891b2", "#312e81"], icon: "🤖" },
  "تقنية": { colors: ["#0f766e", "#0284c7", "#134e4a"], icon: "💻" },
  "التقنية": { colors: ["#0f766e", "#0284c7", "#134e4a"], icon: "💻" },
  "الصحة": { colors: ["#047857", "#10b981", "#064e3b"], icon: "🏥" },
  "صحة": { colors: ["#047857", "#10b981", "#064e3b"], icon: "🏥" },
  "الرياضة": { colors: ["#831843", "#db2777", "#500724"], icon: "⚽" },
  "رياضة": { colors: ["#831843", "#db2777", "#500724"], icon: "⚽" },
  "المجتمع": { colors: ["#701a75", "#a855f7", "#4a044e"], icon: "👥" },
  "مجتمع": { colors: ["#701a75", "#a855f7", "#4a044e"], icon: "👥" },
  "التعليم": { colors: ["#1e40af", "#3b82f6", "#1e3a8a"], icon: "🎓" },
  "تعليم": { colors: ["#1e40af", "#3b82f6", "#1e3a8a"], icon: "🎓" },
  "الثقافة": { colors: ["#78350f", "#d97706", "#451a03"], icon: "📚" },
  "ثقافة": { colors: ["#78350f", "#d97706", "#451a03"], icon: "📚" },
  "السفر": { colors: ["#0369a1", "#06b6d4", "#082f49"], icon: "✈️" },
  "سفر": { colors: ["#0369a1", "#06b6d4", "#082f49"], icon: "✈️" },
  "طقس": { colors: ["#0284c7", "#38bdf8", "#0369a1"], icon: "⛅" },
  "الطقس": { colors: ["#0284c7", "#38bdf8", "#0369a1"], icon: "⛅" },
};

const defaultTheme: CategoryTheme = {
  colors: ["#0f2744", "#1e3a5f", "#0a192c"],
  icon: "📰"
};

const escape = (val: string) =>
  val.replace(/[<>&"']/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;", "'": "&apos;" }[c] || c));

export async function GET(_: Request, { params }: { params: Promise<{ category: string }> }) {
  const rawCat = decodeURIComponent((await params).category || "").trim();
  const theme = categoryThemes[rawCat] || defaultTheme;
  const label = escape(rawCat || "الأخبار");
  const [c1, c2, c3] = theme.colors;

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 360" width="640" height="360" preserveAspectRatio="xMidYMid slice" direction="rtl" xml:lang="ar">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${c1}" />
      <stop offset="60%" stop-color="${c2}" />
      <stop offset="100%" stop-color="${c3}" />
    </linearGradient>
    <radialGradient id="glow" cx="50%" cy="35%" r="60%">
      <stop offset="0%" stop-color="#ffffff" stop-opacity="0.14" />
      <stop offset="100%" stop-color="#000000" stop-opacity="0.25" />
    </radialGradient>
    <pattern id="grid" width="30" height="30" patternUnits="userSpaceOnUse">
      <path d="M 30 0 L 0 30 M 0 0 L 30 30" fill="none" stroke="#ffffff" stroke-width="0.5" stroke-opacity="0.04" />
    </pattern>
  </defs>

  <!-- Card Background -->
  <rect width="640" height="360" fill="url(#bg)" />
  <rect width="640" height="360" fill="url(#glow)" />
  <rect width="640" height="360" fill="url(#grid)" />

  <!-- Center Graphic -->
  <g transform="translate(320, 145)">
    <!-- Outer Glow Ring -->
    <circle r="46" fill="none" stroke="#ffffff" stroke-width="1.5" stroke-opacity="0.25" />
    <circle r="38" fill="rgba(0, 0, 0, 0.25)" />

    <!-- Category Emoji / Icon -->
    <text y="12" text-anchor="middle" font-size="34">${theme.icon}</text>

    <!-- Platform Name -->
    <text y="72" text-anchor="middle" fill="#ffffff" font-family="'Cairo', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Traditional Arabic', sans-serif" font-size="26" font-weight="800">المختصر</text>

    <!-- Category Pill -->
    <rect x="-85" y="92" width="170" height="30" rx="15" fill="rgba(255, 255, 255, 0.18)" stroke="rgba(255, 255, 255, 0.35)" stroke-width="1" />
    <text y="112" text-anchor="middle" fill="#ffffff" font-family="'Cairo', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Traditional Arabic', sans-serif" font-size="14" font-weight="700">${label}</text>
  </g>
</svg>`;

  return new NextResponse(svg, {
    headers: {
      "Content-Type": "image/svg+xml; charset=utf-8",
      "Cache-Control": "public,max-age=604800,stale-while-revalidate=2592000",
      "X-Content-Type-Options": "nosniff"
    }
  });
}
