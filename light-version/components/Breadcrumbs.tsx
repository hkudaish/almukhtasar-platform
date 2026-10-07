import Link from "next/link";
export default function Breadcrumbs({items}:{items:Array<{label:string;href?:string}>}){return <nav className="breadcrumbs" aria-label="مسار الصفحة"><Link href="/">الرئيسية</Link>{items.map((item,index)=><span key={`${item.label}-${index}`}> / {item.href?<Link href={item.href}>{item.label}</Link>:<b>{item.label}</b>}</span>)}</nav>;}
