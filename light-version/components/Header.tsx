import Image from "next/image";
import Link from "next/link";
import { getSettings } from "@/database/database";
import HeaderSearch from "@/components/HeaderSearch";
import ThemeToggle from "@/components/ThemeToggle";
import PrimaryNav from "@/components/PrimaryNav";

export default function Header({homepage=false}:{homepage?:boolean;dark?:boolean}){
  const settings=getSettings();
  return <header className={`site-header${homepage?" sabq-header":""}`}>
    <div className="container header-row">
      <Link className="brand" href="/" aria-label={`${settings.siteName} — الرئيسية`}><Image src="/images/almokhtasar-logo.png" alt={`${settings.siteName} — ${settings.tagline}`} width={2172} height={724} priority sizes="(max-width: 700px) 145px, 190px"/></Link>
      <PrimaryNav/>
      <HeaderSearch compact={homepage}/>
      <ThemeToggle/>
      {homepage?<Link className="header-login" href="/admin">تسجيل الدخول</Link>:null}
    </div>
  </header>;
}
