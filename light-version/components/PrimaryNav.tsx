"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links=[
  {href:"/",label:"الرئيسية",active:(pathname:string)=>pathname==="/"},
  {href:"/trends",label:"الترند والمنصات 🔥",active:(pathname:string)=>pathname.startsWith("/trends")},
  {href:"/brief",label:"مختصر اليوم 📋",active:(pathname:string)=>pathname.startsWith("/brief")},
  {href:"/search",label:"آخر الأخبار",active:(pathname:string)=>pathname.startsWith("/search")},
  {href:"/archive",label:"الأرشيف",active:(pathname:string)=>pathname.startsWith("/archive")}
];

export default function PrimaryNav(){
  const pathname=usePathname();
  return <nav aria-label="التنقل الرئيسي">
    {links.map((link)=>{const active=link.active(pathname);return <Link href={link.href} className={active?"active":""} aria-current={active?"page":undefined} key={link.href}>{link.label}</Link>;})}
  </nav>;
}
