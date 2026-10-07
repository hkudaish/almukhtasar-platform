import type { Metadata } from "next";
import CookieConsent from "@/components/CookieConsent";
import "./globals.css";

export const metadata: Metadata = {
  title: "المختصر | أهم ما تحتاج معرفته",
  description: "منصة ذكية تلخص أهم الأخبار والتحديثات اليومية من مصادر موثوقة.",
  metadataBase: new URL("https://almukhtasar.example"),
  openGraph: {
    title: "المختصر",
    description: "أهم الأخبار، في وقت أقل.",
    type: "website",
    locale: "ar_SA"
  },
  alternates: { canonical: "/" },
  robots: { index: true, follow: true },
  manifest: "/manifest.webmanifest"
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ar" dir="rtl" suppressHydrationWarning>
      <body><a className="skip-link" href="#main-content">انتقل إلى المحتوى</a>{children}<CookieConsent /></body>
    </html>
  );
}
