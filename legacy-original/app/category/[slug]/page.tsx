import Header from "@/components/Header";
import Footer from "@/components/Footer";
import StoryCard from "@/components/StoryCard";
import type { Metadata } from "next";
import Breadcrumbs from "@/components/Breadcrumbs";
import { getPublishedImportedStoriesByCategory } from "@/lib/public-content";

export const dynamic="force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const name = decodeURIComponent(slug);
  return { title: `${name} | المختصر`, description: `أحدث أخبار وملخصات ${name} من مصادر موثوقة.`, alternates: { canonical: `/category/${slug}` } };
}

export default async function CategoryPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const name = decodeURIComponent(slug);
  const categoryStories = getPublishedImportedStoriesByCategory(name,60);
  const visibleStories = categoryStories;
  return (
    <>
      <Header />
      <main id="main-content" className="category-page">
        <div className="container">
          <Breadcrumbs items={[{ label: "الرئيسية", href: "/" }, { label: name, href: `/category/${encodeURIComponent(name)}`, current: true }]}/>
          <div className="category-hero"><span>تصنيف</span><h1>{name}</h1><p>أحدث الأخبار والملخصات والتحليلات المختارة في {name}.</p></div>
          <div className="filter-row"><button className="active">الأحدث</button><button>الأكثر قراءة</button><button>تقارير وتحليلات</button><button>فيديو</button></div>
          <div className="cards-grid">{visibleStories.map(story=><StoryCard key={story.id} story={story}/>)}</div>
        </div>
      </main>
      <Footer />
    </>
  );
}
