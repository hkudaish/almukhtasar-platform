import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import LightNewsItem from "@/components/LightNewsItem";
import { getPublishedImportedStories } from "@/lib/public-content";
import { getLightVersionSettings } from "@/lib/light-version";
import { redirect } from "next/navigation";

export const dynamic="force-dynamic";

export default function LightHomePage(){
  const settings=getLightVersionSettings();
  if(!settings.enabled)redirect("/");
  const stories=getPublishedImportedStories(100);
  const groups=settings.categories.map((category)=>({
    category,
    stories:stories.filter((story)=>story.category===category).slice(0,settings.desktopCount)
  })).filter((group)=>group.stories.length);

  return <>
    <Header/>
    <main id="main-content" className="light-page">
      <div className="container light-shell">
        <header className="light-intro">
          <div><span>النسخة الخفيفة</span><h1>الأخبار باختصار ووضوح</h1></div>
          <p>أحدث الأخبار مرتبة حسب التصنيف. اختر عنوانًا لقراءة الخبر الكامل.</p>
        </header>
        {groups.length?<div className="light-category-grid">{groups.map((group)=><section className="light-category" key={group.category} aria-labelledby={`light-${group.category}`}>
          <header><h2 id={`light-${group.category}`}>{group.category}</h2><Link href={`/light/category/${encodeURIComponent(group.category)}`}>عرض المزيد <ArrowLeft size={14}/></Link></header>
          <div>{group.stories.map((story,index)=><LightNewsItem key={story.id} story={story} index={index} mobileLimit={settings.mobileCount} showTime={settings.showTime} showBadges={settings.showBadges}/>)}</div>
        </section>)}</div>:<div className="light-empty"><strong>لا توجد أخبار حديثة مكتملة حاليًا.</strong><p>ستظهر المواد المنشورة والمعتمدة هنا عند توفرها.</p></div>}
      </div>
    </main>
    <Footer/>
  </>;
}
