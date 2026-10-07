import { notFound } from "next/navigation";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { policyPages } from "@/lib/policies";
import { findRecordByTitle } from "@/lib/admin-db";

export const dynamic = "force-dynamic";

export default async function PolicyPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const page = policyPages[slug]; if (!page) notFound();
  const managed = findRecordByTitle("policies", page.title);
  const managedContent = typeof managed?.data.content === "string" ? managed.data.content.trim() : "";
  return <><Header/><main id="main-content" className="document-page"><article className="container document-card"><span className="eyebrow">الثقة والشفافية</span><h1>{page.title}</h1><p className="document-intro">{page.intro}</p><p className="document-updated">آخر تحديث: {managed ? new Date(managed.updatedAt).toLocaleDateString("ar-SA") : page.updated}{managed?.data.version ? ` · الإصدار ${managed.data.version}` : ""}</p>{managedContent ? <section><h2>نص السياسة</h2>{managedContent.split("\n").filter(Boolean).map((paragraph,index)=><p key={index}>{paragraph}</p>)}</section> : page.sections.map((section) => <section key={section.title}><h2>{section.title}</h2><p>{section.body}</p></section>)}</article></main><Footer/></>;
}
