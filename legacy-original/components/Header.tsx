"use client";

import Link from "next/link";
import { Bookmark, ChevronDown, Languages, Menu, Moon, Search, Sun, X } from "lucide-react";
import { FormEvent, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { categories } from "@/lib/data";
import VersionSwitcher from "./VersionSwitcher";

export default function Header() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dark, setDark] = useState(false);
  const [menu, setMenu] = useState(false);
  const [search, setSearch] = useState(false);
  const [siteName, setSiteName] = useState("المختصر");
  const [tagline, setTagline] = useState("أهم ما تحتاج معرفته");

  useEffect(() => {
    const stored = localStorage.getItem("almukhtasar-theme");
    setDark(stored === "dark" || (!stored && matchMedia("(prefers-color-scheme: dark)").matches));
  }, []);

  useEffect(() => {
    fetch("/api/settings/public").then((response) => response.json()).then(({ data }) => {
      if (data?.general?.siteName) setSiteName(String(data.general.siteName));
      if (data?.general?.tagline) setTagline(String(data.general.tagline));
      if (data?.appearance?.primaryColor) document.documentElement.style.setProperty("--brand", String(data.appearance.primaryColor));
      if (data?.appearance?.navyColor) document.documentElement.style.setProperty("--navy", String(data.appearance.navyColor));
    }).catch(() => undefined);
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = dark ? "dark" : "light";
    localStorage.setItem("almukhtasar-theme", dark ? "dark" : "light");
  }, [dark]);

  useEffect(() => {
    const close = (event: KeyboardEvent) => event.key === "Escape" && setSearch(false);
    document.addEventListener("keydown", close);
    return () => document.removeEventListener("keydown", close);
  }, []);

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const query = inputRef.current?.value.trim();
    if (query) router.push(`/search?q=${encodeURIComponent(query)}`);
    setSearch(false);
  }

  return (
    <header className="site-header focused-header">
      <div className="container header-row">
        <button className="icon-btn mobile-only" type="button" onClick={() => setMenu(!menu)} aria-expanded={menu} aria-label="القائمة">
          {menu ? <X size={20} /> : <Menu size={20} />}
        </button>
        <Link href="/" className="brand" aria-label={`${siteName} — الصفحة الرئيسية`}>
          <span className="brand-mark">{siteName.slice(0, 1)}</span>
          <span><strong>{siteName}</strong><small>{tagline}</small></span>
        </Link>

        <nav className={menu ? "main-nav open" : "main-nav"} aria-label="القائمة الرئيسية">
          <Link href="/" onClick={() => setMenu(false)}>الرئيسية</Link>
          <Link href="/search" onClick={() => setMenu(false)}>آخر الأخبار</Link>
          <details className="nav-dropdown">
            <summary>الأقسام <ChevronDown size={14} /></summary>
            <div>{categories.slice(1, 8).map((item) => <Link key={item} onClick={() => setMenu(false)} href={`/category/${encodeURIComponent(item)}`}>{item}</Link>)}</div>
          </details>
          <details className="nav-dropdown">
            <summary>المزيد <ChevronDown size={14} /></summary>
            <div>
              <Link href="/archive" onClick={() => setMenu(false)}>الأرشيف</Link>
              <Link href="/about" onClick={() => setMenu(false)}>عن المختصر</Link>
              <Link href="/contact" onClick={() => setMenu(false)}>اتصل بنا</Link>
            </div>
          </details>
        </nav>

        <div className="header-actions">
          <VersionSwitcher />
          <button className="icon-btn" type="button" onClick={() => setSearch(!search)} aria-expanded={search} aria-label="البحث"><Search size={18} /></button>
          <button className="icon-btn desktop-only" type="button" aria-label="اللغة العربية، الإنجليزية قريبًا" title="English coming soon"><Languages size={18} /></button>
          <button className="icon-btn" type="button" onClick={() => setDark(!dark)} aria-label={dark ? "الوضع الفاتح" : "الوضع الداكن"}>{dark ? <Sun size={18} /> : <Moon size={18} />}</button>
          <Link href="/saved" className="icon-btn" aria-label="الأخبار المحفوظة"><Bookmark size={18} /></Link>
        </div>
      </div>
      {search && <form className="search-panel" onSubmit={submitSearch}><div className="container search-inner"><Search size={20} /><input ref={inputRef} autoFocus aria-label="عبارة البحث" placeholder="ابحث في الأخبار والموضوعات..." /><kbd>ESC</kbd></div></form>}
    </header>
  );
}
