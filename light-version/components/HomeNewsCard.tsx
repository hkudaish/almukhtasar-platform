import Link from "next/link";
import NewsImage from "@/components/NewsImage";
import type { Article } from "@/types/news";

function articleImage(article: Article): string {
  return (
    article.imageUrl ||
    article.imageOriginalUrl ||
    `/api/media/fallback/${encodeURIComponent(article.category || "عام")}`
  );
}

function articleAlt(article: Article): string {
  return !article.imageAlt || ["undefined", "null"].includes(article.imageAlt.toLowerCase())
    ? article.title
    : article.imageAlt;
}

function articleTime(article: Article, timezone: string): string {
  return new Date(article.sourcePublishedAt).toLocaleString("ar-SA", {
    timeZone: timezone,
    day: "numeric",
    month: "long",
    year: "numeric"
  });
}

function editorialBadge(article: Article) {
  return article.badge || (["أولوية قصوى", "مهم"].includes(article.importanceLevel) ? article.importanceLevel : null);
}

export function HomeHero({ article, timezone }: { article: Article; timezone: string }) {
  const image = articleImage(article);
  return (
    <Link href={`/news/${article.slug}`} className="home-hero-card">
      <NewsImage
        src={image}
        alt={articleAlt(article)}
        category={article.category}
        fill
        sizes="(max-width: 760px) 100vw, 75vw"
        priority
      />
      <span className="home-hero-shade" />
      <span className="home-hero-copy">
        <span className="home-card-meta">
          <em>{article.category}</em>
          {editorialBadge(article) ? <b>{editorialBadge(article)}</b> : null}
          <time dateTime={article.sourcePublishedAt}>{articleTime(article, timezone)}</time>
        </span>
        <strong>{article.title}</strong>
      </span>
    </Link>
  );
}

export function HomeSideStory({
  article,
  index,
  timezone
}: {
  article: Article;
  index: number;
  timezone: string;
}) {
  const image = articleImage(article);
  return (
    <Link href={`/news/${article.slug}`} prefetch={index < 2} className="home-side-story">
      <span className="home-side-copy">
        <span className="home-category-tag">{article.category}</span>
        <strong>{article.title}</strong>
        <time dateTime={article.sourcePublishedAt}>{articleTime(article, timezone)}</time>
      </span>
      <span className="home-side-image">
        <NewsImage
          src={image}
          alt={articleAlt(article)}
          category={article.category}
          fill
          sizes="150px"
          loading="lazy"
        />
      </span>
    </Link>
  );
}

export function HomeGridCard({
  article,
  index,
  timezone
}: {
  article: Article;
  index: number;
  timezone: string;
}) {
  const image = articleImage(article);
  return (
    <Link href={`/news/${article.slug}`} prefetch={index < 2} className="home-grid-card">
      <span className="home-grid-image">
        <NewsImage
          src={image}
          alt={articleAlt(article)}
          category={article.category}
          fill
          sizes="(max-width: 620px) 100vw, (max-width: 980px) 50vw, 25vw"
          loading="lazy"
        />
      </span>
      <span className="home-grid-copy">
        <span className="home-card-meta">
          <em>{article.category}</em>
          {editorialBadge(article) ? <b>{editorialBadge(article)}</b> : null}
        </span>
        <strong>{article.title}</strong>
        {article.summary ? <p>{article.summary}</p> : null}
        <time dateTime={article.sourcePublishedAt}>{articleTime(article, timezone)}</time>
      </span>
    </Link>
  );
}
