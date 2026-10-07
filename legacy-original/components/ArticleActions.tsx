"use client";

import { Bookmark, Headphones, Minus, Pause, Plus, Share2 } from "lucide-react";
import { useEffect, useState } from "react";

export default function ArticleActions({ id, title, summary }: { id: string; title: string; summary: string }) {
  const [saved, setSaved] = useState(false); const [playing, setPlaying] = useState(false); const [fontSize, setFontSize] = useState(100);
  useEffect(() => setSaved((JSON.parse(localStorage.getItem("almukhtasar-saved") || "[]") as string[]).includes(id)), [id]);
  function save() { const ids: string[] = JSON.parse(localStorage.getItem("almukhtasar-saved") || "[]"); const next = ids.includes(id) ? ids.filter((item) => item !== id) : [...ids, id]; localStorage.setItem("almukhtasar-saved", JSON.stringify(next)); setSaved(next.includes(id)); }
  function listen() { if (playing) { speechSynthesis.cancel(); setPlaying(false); return; } const speech = new SpeechSynthesisUtterance(`${title}. ${summary}`); speech.lang = "ar-SA"; speech.onend = () => setPlaying(false); speechSynthesis.speak(speech); setPlaying(true); }
  async function share() { if (navigator.share) await navigator.share({ title, text: summary, url: location.href }); else await navigator.clipboard.writeText(location.href); }
  useEffect(() => { document.documentElement.style.setProperty("--article-scale", `${fontSize / 100}`); }, [fontSize]);
  return <div className="article-tools"><button onClick={listen}>{playing ? <Pause size={17}/> : <Headphones size={17}/>} {playing ? "إيقاف" : "استمع"}</button><button onClick={save} className={saved ? "active-tool" : ""}><Bookmark size={17} fill={saved ? "currentColor" : "none"}/> {saved ? "محفوظ" : "حفظ"}</button><button onClick={share}><Share2 size={17}/> مشاركة</button><button aria-label="تكبير الخط" onClick={() => setFontSize(Math.min(fontSize + 10, 130))}><Plus size={16}/></button><button aria-label="تصغير الخط" onClick={() => setFontSize(Math.max(fontSize - 10, 90))}><Minus size={16}/></button></div>;
}
