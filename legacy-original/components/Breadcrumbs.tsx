import Link from "next/link";
import { ChevronLeft, Home } from "lucide-react";

export type BreadcrumbItem = {
  label: string;
  href: string;
  current?: boolean;
};

export default function Breadcrumbs({ items }: { items: BreadcrumbItem[] }) {
  const origin = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const schema = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.label,
      item: new URL(item.href, origin).toString()
    }))
  };

  return (
    <>
      <nav className="breadcrumbs" aria-label="مسار التنقل">
        <ol>
          {items.map((item, index) => (
            <li key={`${item.href}-${item.label}`}>
              {index > 0 && <ChevronLeft className="breadcrumb-separator" size={14} aria-hidden="true" />}
              <Link href={item.href} aria-current={item.current ? "page" : undefined}>
                {index === 0 && <Home size={14} aria-hidden="true" />}
                <span>{item.label}</span>
              </Link>
            </li>
          ))}
        </ol>
      </nav>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema).replace(/</g, "\\u003c") }} />
    </>
  );
}
