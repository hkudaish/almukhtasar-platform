"use client";

import { Gauge, LayoutGrid } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

type PublicLightSettings={enabled?:boolean;defaultMode?:string};

export default function VersionSwitcher(){
  const pathname=usePathname(),router=useRouter(),isLight=pathname.startsWith("/light");
  const [settings,setSettings]=useState<PublicLightSettings|null>(null);

  useEffect(()=>{
    fetch("/api/settings/public",{cache:"no-store"}).then((response)=>response.json()).then(({data})=>setSettings(data?.light_version||{enabled:true})).catch(()=>setSettings({enabled:true}));
  },[]);

  useEffect(()=>{
    if(!settings)return;
    if(settings.enabled===false&&isLight){router.replace("/");return;}
    if(pathname!=="/"||settings.enabled===false)return;
    const saved=localStorage.getItem("almukhtasar-version");
    const mobile=matchMedia("(max-width: 700px)").matches;
    if(saved==="light"||(!saved&&(settings.defaultMode==="النسخة الخفيفة"||(settings.defaultMode==="الخفيفة على الجوال فقط"&&mobile))))router.replace("/light");
  },[isLight,pathname,router,settings]);

  if(!settings?.enabled)return null;
  function switchVersion(){
    localStorage.setItem("almukhtasar-version",isLight?"full":"light");
    router.push(isLight?"/":"/light");
  }
  return <button className="version-switcher" type="button" onClick={switchVersion} title={isLight?"الانتقال إلى النسخة الكاملة":"الانتقال إلى النسخة الخفيفة"}>
    {isLight?<LayoutGrid size={16}/>:<Gauge size={16}/>}<span>{isLight?"النسخة الكاملة":"النسخة الخفيفة"}</span>
  </button>;
}
