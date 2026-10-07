import type { Metadata } from "next";
import LoadingExperience from "@/components/LoadingExperience";
import BackToTop from "@/components/BackToTop";
import GlobalMoreNews from "@/components/GlobalMoreNews";
import ServiceWorkerCleanup from "@/components/ServiceWorkerCleanup";
import Script from "next/script";
import "./globals.css";

export const metadata:Metadata={
  title:{default:"المختصر | أهم الأخبار بوضوح وسرعة",template:"%s | المختصر"},
  description:"أخبار حديثة وموثقة مرتبة حسب التصنيف في واجهة عربية خفيفة.",
  metadataBase:new URL(process.env.SITE_URL||"http://localhost:3000"),
  alternates:{types:{"application/rss+xml":"/sitemap-news.xml"}},
  openGraph:{siteName:"المختصر",locale:"ar_SA",type:"website",title:"المختصر | أهم الأخبار بوضوح وسرعة",description:"أخبار عربية حديثة وموثقة من مصادر معتمدة."},
  twitter:{card:"summary_large_image",title:"المختصر | أهم الأخبار بوضوح وسرعة",description:"أخبار عربية حديثة وموثقة من مصادر معتمدة."},
  verification:{google:process.env.GOOGLE_SITE_VERIFICATION||undefined},
  icons:{icon:"/images/almokhtasar-logo.png",apple:"/images/almokhtasar-logo.png"},
  robots:{index:true,follow:true}
};
export default function RootLayout({children}:{children:React.ReactNode}){const publisher=process.env.NEXT_PUBLIC_ADSENSE_PUBLISHER_ID;return <html lang="ar" dir="rtl"><head><script dangerouslySetInnerHTML={{__html:`try{var t=localStorage.getItem('almokhtasar-theme');document.documentElement.dataset.theme=t==='dark'?'dark':'light';}catch(e){document.documentElement.dataset.theme='light';}`}}/><link rel="preconnect" href="https://fonts.googleapis.com"/><link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous"/><link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Arabic:wght@400;500;600;700&display=swap" rel="stylesheet"/></head><body><ServiceWorkerCleanup/>{publisher?<Script async strategy="afterInteractive" src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${encodeURIComponent(publisher)}`} crossOrigin="anonymous"/>:null}<LoadingExperience/><a className="skip-link" href="#main-content">انتقل إلى المحتوى</a>{children}<GlobalMoreNews/><BackToTop/></body></html>;}
