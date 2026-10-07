"use client";

import { useEffect, useState } from "react";

export default function BackToTop(){
  const [visible,setVisible]=useState(false);
  useEffect(()=>{const update=()=>setVisible(window.scrollY>520);update();window.addEventListener("scroll",update,{passive:true});return ()=>window.removeEventListener("scroll",update);},[]);
  return <button className={`back-to-top${visible?" visible":""}`} type="button" onClick={()=>window.scrollTo({top:0,behavior:"smooth"})} aria-label="العودة إلى أعلى الصفحة" title="العودة للأعلى"><span aria-hidden="true">↑</span><b>العودة للأعلى</b></button>;
}
