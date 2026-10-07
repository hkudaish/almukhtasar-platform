"use client";

import { useEffect, useState } from "react";

type Theme = "light" | "dark";

function appliedTheme():Theme{
  return document.documentElement.dataset.theme === "dark" ? "dark" : "light";
}

export default function ThemeToggle(){
  const [theme,setTheme]=useState<Theme>("light");
  useEffect(()=>setTheme(appliedTheme()),[]);
  function toggle(){
    const next:Theme=theme === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme=next;
    localStorage.setItem("almokhtasar-theme",next);
    setTheme(next);
  }
  const isDark=theme === "dark";
  return <button className="theme-toggle" type="button" onClick={toggle} aria-label={isDark?"تفعيل الوضع الفاتح":"تفعيل الوضع الداكن"} title={isDark?"الوضع الفاتح":"الوضع الداكن"}><span aria-hidden="true">{isDark?"☀":"☾"}</span></button>;
}
