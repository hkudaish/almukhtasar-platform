"use client";

import { useRouter, useSearchParams } from "next/navigation";

const options={sort:[['latest','الأحدث'],['views','الأكثر مشاهدة'],['shares','الأكثر تفاعلًا']],status:[['all','الكل'],['urgent','عاجل'],['new','جديد']],period:[['auto','الأحدث المتاح'],['today','اليوم'],['3d','آخر 3 أيام'],['7d','آخر 7 أيام'],['30d','آخر 30 يوم'],['all','الكل']]} as const;

export default function CategoryFilters({subcategory,subcategories}:{subcategory:string;subcategories:string[]}){
  const router=useRouter(),search=useSearchParams();
  function change(key:string,value:string){const params=new URLSearchParams(search.toString());if(value&&value!=="all"&&!(key==="period"&&value==="auto"))params.set(key,value);else params.delete(key);params.delete("page");router.replace(`?${params.toString()}`,{scroll:false});}
  const select=(key:"sort"|"status"|"period",label:string,defaultValue:string)=><label className="category-filter-select"><span className="sr-only">{label}</span><select aria-label={label} value={search.get(key)||defaultValue} onChange={(event)=>change(key,event.target.value)}>{options[key].map(([value,text])=><option value={value} key={value}>{text}</option>)}</select></label>;
  return <div className="category-toolbar"><div className="category-toolbar-group">{select("sort","ترتيب الأخبار","latest")}{select("status","حالة الخبر","all")}{select("period","الفترة الزمنية","auto")}</div><nav className="filters category-filters" aria-label="التصنيفات الفرعية"><button type="button" className={!subcategory?"active":""} onClick={()=>change("sub","")}>الكل</button>{subcategories.map((item)=><button type="button" className={subcategory===item?"active":""} onClick={()=>change("sub",item)} key={item}>{item}</button>)}</nav></div>;
}
