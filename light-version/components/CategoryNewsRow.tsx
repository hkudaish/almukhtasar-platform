import Link from "next/link";
import NewsImage from "@/components/NewsImage";
import type { Article } from "@/types/news";

export default function CategoryNewsRow({
  article,
  index,
  timezone,
  variant = "row"
}: {
  article: Article;
  index: number;
  timezone: string;
  variant?: "row" | "grid";
}) {
  const image =
    article.imageUrl ||
    article.imageOriginalUrl ||
    `/api/media/fallback/${encodeURIComponent(article.category || "عام")}`;
  const imageAlt =
    !article.imageAlt || ["undefined", "null"].includes(article.imageAlt.toLowerCase())
      ? article.title
      : article.imageAlt;
  const published = new Date(article.sourcePublishedAt).toLocaleString("ar-SA", {
    timeZone: timezone,
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit"
  });

  return (
    <Link
      href={`/news/${article.slug}`}
      prefetch={index < 2}
      className={`category-news-row${variant === "grid" ? " article-card" : ""}`}
    >
      <span className="category-news-thumb">
        <NewsImage
          src={image}
          alt={imageAlt}
          category={article.category}
          fill
          sizes="(max-width:600px) 112px, (max-width:900px) 50vw, 25vw"
          priority={index < 2}
        />
      </span>
      <span className="category-news-copy">
        <span className="category-news-labels">
          <em>{article.subcategory || article.category}</em>
          {article.badge ? (
            <b>{article.badge}</b>
          ) : ["أولوية قصوى", "مهم"].includes(article.importanceLevel) ? (
            <b>{article.importanceLevel}</b>
          ) : null}
        </span>
        <strong>{article.title}</strong>
        {article.tags.length ? (
          <span className="category-card-tags">
            {article.tags.slice(0, 2).map((tag) => (
              <i key={tag}>{tag}</i>
            ))}
          </span>
        ) : null}
        {article.summary ? <p>{article.summary}</p> : null}
        <span className="category-news-meta">
          <time dateTime={article.sourcePublishedAt}>{published}</time>
          {article.sourceName ? <span>المصدر: {article.sourceName}</span> : null}
        </span>
      </span>
    </Link>
  );
}
