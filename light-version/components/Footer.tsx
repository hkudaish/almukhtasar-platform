import Image from "next/image";
import Link from "next/link";
export default function Footer(){return <footer className="site-footer"><div className="container"><Link className="footer-brand" href="/" aria-label="المختصر — الرئيسية"><Image src="/images/almokhtasar-logo.png" alt="المختصر — الأخبار اليومية باختصار" width={2172} height={724} sizes="180px"/></Link><nav><Link href="/">الرئيسية</Link><Link href="/archive">الأرشيف</Link><Link href="/admin">إدارة الأخبار</Link></nav><small>© {new Date().getFullYear()} المختصر — الأخبار اليومية باختصار.</small></div></footer>;}
