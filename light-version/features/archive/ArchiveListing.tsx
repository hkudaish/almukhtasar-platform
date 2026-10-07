import CategoryNewsRow from "@/components/CategoryNewsRow";
import type { Article } from "@/types/news";
export default function ArchiveListing({articles,timezone="Asia/Riyadh"}:{articles:Article[];timezone?:string}){return <section className="article-card-grid archive-list">{articles.length?articles.map((article,index)=><CategoryNewsRow key={article.id} article={article} index={index} timezone={timezone} variant="grid"/>):<p className="empty-section">لا توجد أخبار مؤرشفة في هذه الفترة.</p>}</section>;}
