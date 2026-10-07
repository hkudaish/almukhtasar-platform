import Link from "next/link";

export default function Footer() {
  return (
    <footer className="footer focused-footer">
      <div className="container focused-footer-row">
        <div className="focused-footer-about">
          <div className="brand footer-brand"><span className="brand-mark">م</span><strong>المختصر</strong></div>
          <p>أهم الأخبار، موثقة ومختصرة.</p>
        </div>
        <nav aria-label="روابط التذييل">
          <Link href="/about">من نحن</Link>
          <Link href="/contact">تواصل معنا</Link>
          <Link href="/policies/editorial">التحرير</Link>
          <Link href="/policies/privacy">الخصوصية</Link>
          <Link href="/policies/terms">الشروط</Link>
        </nav>
      </div>
      <div className="container copyright">© 2026 المختصر · المحتوى التجريبي موضح عند عرضه.</div>
    </footer>
  );
}
