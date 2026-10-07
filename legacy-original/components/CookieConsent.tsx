"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

export default function CookieConsent() {
  const [visible, setVisible] = useState(false);
  useEffect(() => setVisible(!localStorage.getItem("almukhtasar-cookie-consent")), []);
  if (!visible) return null;

  function choose(value: "essential" | "all") {
    localStorage.setItem("almukhtasar-cookie-consent", value);
    setVisible(false);
  }

  return <aside className="cookie-banner" aria-label="إعدادات ملفات الارتباط">
    <div><strong>خصوصيتك مهمة</strong><p>نستخدم الملفات الضرورية لتشغيل الموقع، ولا نفعّل أدوات القياس الاختيارية قبل موافقتك. <Link href="/policies/cookies">التفاصيل</Link></p></div>
    <div className="cookie-actions"><button onClick={() => choose("essential")}>الضرورية فقط</button><button className="primary-btn" onClick={() => choose("all")}>السماح للكل</button></div>
  </aside>;
}
