"use client";

import { useState } from "react";
import Link from "next/link";
import { Activity, Archive, BellRing, Bot, CheckCircle2, ChevronLeft, Clock3, Database, Download, FileText, HardDrive, Image, LayoutDashboard, MailOpen, Megaphone, Newspaper, Plus, Printer, Search, SearchCheck, Settings, ShieldCheck, Tags, Users, XCircle, Play, Pause, Eye, Rss, CalendarClock, AlertTriangle, RefreshCw, TrendingUp, MousePointerClick, BookOpen, Sparkles, Gauge, ExternalLink, Filter, CircleAlert, Radio, Plug, ScrollText } from "lucide-react";
import ResourceManager, { TabbedResources } from "@/components/admin/ResourceManager";
import SettingsWorkspace from "@/components/admin/SettingsWorkspace";
import AuditLogPanel from "@/components/admin/AuditLogPanel";
import RetrievalAutomation from "@/components/admin/RetrievalAutomation";
import HomepageRecoveryAlert from "@/components/admin/HomepageRecoveryAlert";

const nav = [
  ["لوحة المتابعة",LayoutDashboard],["المحتوى",Newspaper],["المراجعة والتحقق",ShieldCheck],["المصادر",Database],
  ["التصنيفات والوسوم",Tags],["الوسائط",Image],["الأرشيف",Archive],["تحسين SEO",SearchCheck],
  ["الإعلانات",Megaphone],["الإشعارات",BellRing],["النشرات البريدية",MailOpen],["المستخدمون والصلاحيات",Users],
  ["التكاملات",Plug],["السياسات",ScrollText],["الأتمتة والجدولة",Bot],["التحليلات",Activity],
  ["سجل التدقيق",FileText],["النسخ الاحتياطي",HardDrive],["الإعدادات",Settings]
] as const;
const articles = [
  { title:"خدمات رقمية جديدة تعتمد الذكاء الاصطناعي", category:"الذكاء الاصطناعي", status:"بانتظار المراجعة", className:"s0", source:"مصدر رسمي + 3 مصادر داعمة", time:"منذ 12 دقيقة" },
  { title:"الأسواق تترقب بيانات اقتصادية مؤثرة", category:"الاقتصاد", status:"مسودة", className:"s1", source:"تقرير اقتصادي رسمي", time:"منذ 27 دقيقة" },
  { title:"تحديثات جديدة في خدمات المتابعة الصحية", category:"الصحة", status:"بحاجة إلى تحقق", className:"s2", source:"جهتان صحيتان", time:"منذ 41 دقيقة" },
  { title:"استعدادات الفرق قبل المواجهة النهائية", category:"الرياضة", status:"معتمد", className:"s3", source:"الاتحاد الرسمي", time:"منذ ساعة" }
];
const sources = [
  {name:"وكالة الأنباء الرسمية",type:"API",category:"محليات وسياسة",trust:98,status:"نشط",last:"منذ 8 دقائق"},
  {name:"المركز الوطني للتوعية",type:"RSS",category:"تقنية",trust:96,status:"نشط",last:"منذ 21 دقيقة"},
  {name:"البوابة الصحية الرسمية",type:"API",category:"صحة",trust:99,status:"نشط",last:"منذ 38 دقيقة"},
  {name:"مصدر اقتصادي خارجي",type:"RSS",category:"اقتصاد",trust:82,status:"متوقف",last:"فشل قبل ساعة"}
];
const jobs = [
  {name:"التحديث الرئيسي",schedule:"يوميًا 00:15",next:"اليوم 12:15 ص",state:"نشط"},
  {name:"مصادر الأخبار العاجلة",schedule:"كل 15 دقيقة",next:"بعد 6 دقائق",state:"نشط"},
  {name:"تحديث الرياضة",schedule:"كل ساعة",next:"07:00 م",state:"يعمل الآن"},
  {name:"النشرة المسائية",schedule:"يوميًا 18:30",next:"غدًا 06:30 م",state:"متوقف"}
];

export default function AdminPage() {
  const [active,setActive]=useState("لوحة المتابعة");
  const [toast,setToast]=useState("");
  function action(message:string){setToast(message); window.setTimeout(()=>setToast(""),2600);}
  return <div className="admin-shell">
    <aside className="admin-sidebar"><Link href="/" className="brand admin-brand"><span className="brand-mark">م</span><strong>المختصر</strong></Link><nav>{nav.map(([label,Icon])=><button key={label} className={active===label?"active":""} onClick={()=>setActive(label)}><Icon size={19}/>{label}</button>)}</nav><div className="sidebar-footer"><span className="avatar">ح</span><div><strong>حساب المدير</strong><small>مدير النظام</small></div></div></aside>
    <main id="main-content" className="admin-main"><header className="admin-top"><div><h1>{active}</h1><p>{subtitle(active)}</p></div><div className="admin-actions"><Link href="/" target="_blank" className="secondary-admin-btn"><Eye size={18}/> عرض الموقع</Link></div></header><HomepageRecoveryAlert/>
      {active === "لوحة المتابعة" && <Dashboard onAction={action}/>} 
      {active === "المحتوى" && <ResourceManager resource="content" onNotify={action}/>} 
      {active === "المراجعة والتحقق" && <ResourceManager resource="reviews" onNotify={action}/>} 
      {active === "المصادر" && <ResourceManager resource="sources" onNotify={action}/>} 
      {active === "التصنيفات والوسوم" && <TabbedResources tabs={[{resource:"categories",label:"التصنيفات"},{resource:"tags",label:"الوسوم"}]} onNotify={action}/>} 
      {active === "الوسائط" && <ResourceManager resource="media" onNotify={action}/>} 
      {active === "الأرشيف" && <ResourceManager resource="archives" onNotify={action}/>} 
      {active === "تحسين SEO" && <ResourceManager resource="seo" onNotify={action}/>} 
      {active === "الإعلانات" && <ResourceManager resource="ads" onNotify={action}/>} 
      {active === "الإشعارات" && <ResourceManager resource="notifications" onNotify={action}/>} 
      {active === "النشرات البريدية" && <ResourceManager resource="newsletters" onNotify={action}/>} 
      {active === "المستخدمون والصلاحيات" && <TabbedResources tabs={[{resource:"users",label:"المستخدمون"},{resource:"roles",label:"الأدوار والصلاحيات"}]} onNotify={action}/>} 
      {active === "التكاملات" && <ResourceManager resource="integrations" onNotify={action}/>} 
      {active === "السياسات" && <ResourceManager resource="policies" onNotify={action}/>} 
      {active === "الأتمتة والجدولة" && <RetrievalAutomation onNotify={action}/>} 
      {active === "التحليلات" && <AnalyticsPanel/>} 
      {active === "سجل التدقيق" && <AuditLogPanel/>} 
      {active === "النسخ الاحتياطي" && <ResourceManager resource="backups" onNotify={action}/>} 
      {active === "الإعدادات" && <SettingsWorkspace onNotify={action}/>} 
      {toast && <div className="admin-toast" role="status"><CheckCircle2 size={18}/>{toast}</div>}
    </main>
  </div>;
}

function subtitle(active:string){return ({"لوحة المتابعة":"نظرة شاملة على المحتوى والعمليات التحريرية.","المحتوى":"إنشاء المحتوى وتحريره وجدولته وأرشفته.","المراجعة والتحقق":"المراجعات ونتائج تدقيق الحقائق ومستويات الثقة.","المصادر":"المصادر المعتمدة وقواعد الجلب والموثوقية.","التصنيفات والوسوم":"التصنيفات الرئيسية والفرعية والوسوم والكلمات المفتاحية.","الوسائط":"الصور والفيديوهات والملفات والنصوص البديلة.","الأرشيف":"إدارة المحتوى المؤرشف واستعادته حسب التاريخ.","تحسين SEO":"الفهرسة والبيانات التعريفية والروابط الأساسية.","الإعلانات":"المساحات الإعلانية والاستهداف وقياس الأداء.","الإشعارات":"إنشاء الإشعارات واستهدافها وجدولتها.","النشرات البريدية":"القوائم والقوالب والإرسال وقياس التفاعل.","المستخدمون والصلاحيات":"الحسابات والأدوار والصلاحيات والمصادقة الثنائية.","التكاملات":"مزودو الأخبار والذكاء الاصطناعي والبريد والتحليلات والتخزين.","السياسات":"السياسات وإصداراتها وحالة نشرها.","الأتمتة والجدولة":"مواعيد الجلب والمعالجة والنشر.","التحليلات":"أداء المحتوى والمصادر والجمهور.","سجل التدقيق":"كل الإجراءات الإدارية الحساسة في سجل غير قابل للتعديل.","النسخ الاحتياطي":"النسخ اليدوية والمجدولة وحالة السلامة والاستعادة.","الإعدادات":"إعدادات الموقع والنشر والاتصال والتخزين والأمن."} as Record<string,string>)[active]}
type ActionProps={onAction:(message:string)=>void};
const dashboardMetrics = {
  today: { views:"48.2K", published:"42", review:"26", engagement:"7.8%", viewsDelta:"+14.8%", publishedDelta:"+8.2%", engagementDelta:"+1.4%" },
  week: { views:"284.6K", published:"238", review:"26", engagement:"7.1%", viewsDelta:"+18.2%", publishedDelta:"+11.5%", engagementDelta:"+0.9%" },
  month: { views:"1.24M", published:"1,102", review:"26", engagement:"6.9%", viewsDelta:"+23.7%", publishedDelta:"+12.0%", engagementDelta:"+1.8%" }
};
function Stats({period}:{period:keyof typeof dashboardMetrics}){const metric=dashboardMetrics[period];return <section className="stats-grid dashboard-stats">
  <div className="stat"><span><BookOpen/></span><div><small>مرات القراءة</small><strong>{metric.views}</strong><em><TrendingUp/> {metric.viewsDelta} عن الفترة السابقة</em></div><b className="stat-spark"><i/><i/><i/><i/><i/></b></div>
  <div className="stat"><span><CheckCircle2/></span><div><small>المواد المنشورة</small><strong>{metric.published}</strong><em><TrendingUp/> {metric.publishedDelta} نموًا</em></div><b className="stat-spark alt"><i/><i/><i/><i/><i/></b></div>
  <div className="stat attention"><span><Clock3/></span><div><small>بانتظار المراجعة</small><strong>{metric.review}</strong><em className="warning-text"><CircleAlert/> 8 مواد حساسة</em></div><b className="stat-spark warning"><i/><i/><i/><i/><i/></b></div>
  <div className="stat"><span><MousePointerClick/></span><div><small>معدل التفاعل</small><strong>{metric.engagement}</strong><em><TrendingUp/> {metric.engagementDelta} تحسنًا</em></div><b className="stat-spark blue"><i/><i/><i/><i/><i/></b></div>
</section>}
function ArticleTable({onAction}:ActionProps){return <div className="table-wrap"><table><thead><tr><th>العنوان</th><th>التصنيف</th><th>الحالة</th><th>الوصول</th><th>إجراء</th></tr></thead><tbody>{articles.map((row)=><tr key={row.title}><td><strong>{row.title}</strong><small>{row.source}</small></td><td>{row.category}</td><td><span className={`status ${row.className}`}>{row.status}</span></td><td>{row.time}</td><td><button className="table-action" onClick={()=>onAction(`تم فتح «${row.title}»`)}><Eye size={15}/> فتح</button></td></tr>)}</tbody></table></div>}
function Dashboard({onAction}:ActionProps){
  const [period,setPeriod]=useState<keyof typeof dashboardMetrics>("today");
  const [queueFilter,setQueueFilter]=useState("الكل");
  const [alerts,setAlerts]=useState(["source","review"]);
  const [refreshing,setRefreshing]=useState(false);
  const visibleArticles=articles.filter((article)=>queueFilter==="الكل"||(queueFilter==="حساس"?article.status==="بحاجة إلى تحقق":article.status===queueFilter));
  function refresh(){setRefreshing(true);window.setTimeout(()=>{setRefreshing(false);onAction("تم تحديث بيانات لوحة المتابعة")},700)}
  return <div className="dashboard-workspace">
    <div className="dashboard-toolbar"><div className="period-switch" aria-label="نطاق البيانات"><button className={period==="today"?"active":""} onClick={()=>setPeriod("today")}>اليوم</button><button className={period==="week"?"active":""} onClick={()=>setPeriod("week")}>7 أيام</button><button className={period==="month"?"active":""} onClick={()=>setPeriod("month")}>30 يومًا</button></div><div className="last-sync"><span className="ok"/> جميع الأنظمة تعمل · آخر مزامنة منذ دقيقتين <button onClick={refresh} aria-label="تحديث البيانات"><RefreshCw className={refreshing?"spin":""}/></button></div></div>
    <Stats period={period}/>

    <section className="dashboard-overview-grid">
      <div className="panel performance-panel"><div className="panel-head"><div><h2>أداء المحتوى</h2><p>القراءات والمواد المنشورة خلال ساعات اليوم.</p></div><div className="chart-legend"><span><i className="views"/> القراءات</span><span><i className="posts"/> النشر</span></div></div><div className="performance-chart" role="img" aria-label="مخطط أداء المحتوى خلال اليوم">{[32,46,39,58,51,73,67,88,78,95,84,91].map((height,i)=><div className="performance-column" key={i}><div className="chart-value" style={{height:`${height}%`}}><span style={{height:`${Math.max(12,height-18)}%`}}/></div><small>{["8ص","9ص","10ص","11ص","12م","1م","2م","3م","4م","5م","6م","الآن"][i]}</small></div>)}</div></div>
      <div className="panel daily-goal"><div className="panel-head"><div><h2>هدف النشر اليومي</h2><p>42 من أصل 50 مادة.</p></div><Gauge/></div><div className="goal-ring" style={{"--progress":"84%"} as React.CSSProperties}><div><strong>84%</strong><small>اكتمل</small></div></div><div className="goal-breakdown"><span><i className="ok"/> منشور <b>42</b></span><span><i className="wait"/> مجدول <b>5</b></span><span><i className="muted-dot"/> متبقٍ <b>3</b></span></div><button onClick={()=>onAction("تم فتح جدول النشر")}>عرض جدول النشر <ChevronLeft/></button></div>
    </section>

    <section className="dashboard-content-grid">
      <div className="panel queue-panel"><div className="panel-head"><div><h2>يحتاج إلى انتباهك</h2><p>المواد ذات الأولوية في طابور التحرير.</p></div><button onClick={()=>onAction("تم فتح طابور المراجعة كاملًا")}>عرض الطابور <ChevronLeft/></button></div><div className="queue-filters"><Filter/><button className={queueFilter==="الكل"?"active":""} onClick={()=>setQueueFilter("الكل")}>الكل <b>4</b></button><button className={queueFilter==="بانتظار المراجعة"?"active":""} onClick={()=>setQueueFilter("بانتظار المراجعة")}>مراجعة <b>1</b></button><button className={queueFilter==="حساس"?"active":""} onClick={()=>setQueueFilter("حساس")}>حساس <b>1</b></button><button className={queueFilter==="مسودة"?"active":""} onClick={()=>setQueueFilter("مسودة")}>مسودات <b>1</b></button></div><div className="dashboard-queue">{visibleArticles.map((article,index)=><article key={article.title}><span className="queue-priority">{String(index+1).padStart(2,"0")}</span><div><div className="queue-meta"><span className={`status ${article.className}`}>{article.status}</span><small>{article.category} · {article.time}</small></div><h3>{article.title}</h3><p>{article.source}</p></div><button onClick={()=>onAction(`تم فتح «${article.title}»`)}><Eye/> مراجعة</button></article>)}</div></div>
      <aside className="dashboard-side-stack">
        <div className="panel alerts-panel"><div className="panel-head"><div><h2>التنبيهات</h2><p>{alerts.length} يحتاجان إجراءً.</p></div><CircleAlert/></div>{alerts.includes("source")&&<div className="dashboard-alert danger"><span><Rss/></span><div><strong>فشل مصدر اقتصادي</strong><p>3 محاولات اتصال غير ناجحة.</p><button onClick={()=>onAction("بدأت إعادة اختبار المصدر")}>إعادة الاختبار</button></div><button aria-label="تجاهل التنبيه" onClick={()=>setAlerts(alerts.filter(item=>item!=="source"))}>×</button></div>}{alerts.includes("review")&&<div className="dashboard-alert warning"><span><ShieldCheck/></span><div><strong>تراكم المراجعات الحساسة</strong><p>8 مواد تجاوزت 30 دقيقة.</p><button onClick={()=>onAction("تم فتح المواد الحساسة")}>مراجعة الآن</button></div><button aria-label="تجاهل التنبيه" onClick={()=>setAlerts(alerts.filter(item=>item!=="review"))}>×</button></div>}{!alerts.length&&<div className="alerts-empty"><CheckCircle2/><p>لا توجد تنبيهات نشطة.</p></div>}</div>
        <div className="panel quick-actions"><h2>إجراءات سريعة</h2><div><button onClick={()=>onAction("تم بدء جلب عاجل") }><Radio/><span><b>جلب عاجل</b><small>تشغيل كل المصادر</small></span></button><button onClick={()=>onAction("تم إنشاء مسودة جديدة") }><Plus/><span><b>خبر جديد</b><small>إنشاء يدوي</small></span></button><button onClick={()=>onAction("تم فتح مساعد التلخيص") }><Sparkles/><span><b>تلخيص ذكي</b><small>مسودة بمراجعة بشرية</small></span></button></div></div>
      </aside>
    </section>

    <section className="dashboard-bottom-grid">
      <div className="panel category-performance"><div className="panel-head"><div><h2>أداء التصنيفات</h2><p>الأعلى قراءة ونموًا اليوم.</p></div><button onClick={()=>onAction("تم فتح تحليل التصنيفات")}><ExternalLink/></button></div>{[["التقنية","12.8K",88,"+24%"],["الاقتصاد","9.4K",72,"+18%"],["الرياضة","8.7K",65,"+11%"],["الصحة","6.2K",48,"+9%"]].map(([name,views,width,growth],i)=><div className="category-row" key={name}><span className={`category-rank rank-${i+1}`}>{i+1}</span><div><strong>{name}</strong><small>{views} قراءة</small></div><div className="category-progress"><i style={{width:`${width}%`}}/></div><em>{growth}</em></div>)}</div>
      <div className="panel activity-feed"><div className="panel-head"><div><h2>النشاط التحريري</h2><p>آخر الإجراءات المسجلة.</p></div></div><div><article><span className="activity-icon publish"><CheckCircle2/></span><p><strong>نورة العتيبي</strong> اعتمدت خبر الأسواق<small>منذ 6 دقائق</small></p></article><article><span className="activity-icon verify"><ShieldCheck/></span><p><strong>ريم خالد</strong> أضافت تحققًا لمادة صحية<small>منذ 18 دقيقة</small></p></article><article><span className="activity-icon edit"><FileText/></span><p><strong>أحمد محمد</strong> حدّث ملخص خبر تقني<small>منذ 31 دقيقة</small></p></article><article><span className="activity-icon ai"><Sparkles/></span><p><strong>النظام</strong> جمع 24 تغطية متشابهة<small>منذ 44 دقيقة</small></p></article></div></div>
      <div className="panel automation-health"><div className="panel-head"><div><h2>صحة الأتمتة</h2><p>آخر 24 ساعة.</p></div><strong className="health-score">96%</strong></div><div className="pipeline"><div><span><Rss/> الجلب</span><b>342</b><small>عنصرًا</small></div><i/><div><span><Sparkles/> المعالجة</span><b>294</b><small>ناجحًا</small></div><i/><div><span><CheckCircle2/> القبول</span><b>187</b><small>مسودة</small></div></div><div className="automation-summary"><span><i className="ok"/> 12 مصدرًا يعمل</span><span><i className="error"/> مصدر متعطل</span></div></div>
    </section>
  </div>
}
function ContentPanel({onAction}:ActionProps){return <section className="panel admin-page-panel"><div className="panel-toolbar"><div className="admin-tabs"><button className="active">الكل <b>1,248</b></button><button>مسودة <b>18</b></button><button>مراجعة <b>26</b></button><button>مجدول <b>11</b></button><button>منشور <b>1,102</b></button></div><div className="admin-filter"><Search size={16}/><input placeholder="بحث في المحتوى"/></div></div><ArticleTable onAction={onAction}/></section>}
function SourcesPanel({onAction}:ActionProps){return <><div className="quality-callout"><ShieldCheck/><div><strong>قاعدة الموافقة على المصادر</strong><p>أي مصدر جديد يبقى معلقًا حتى يراجعه مسؤول المصادر. انخفاض الموثوقية عن 70 يوقف النشر الآلي.</p></div></div><section className="panel admin-page-panel"><div className="table-wrap"><table><thead><tr><th>المصدر</th><th>النوع</th><th>التصنيف</th><th>الثقة</th><th>الحالة</th><th>آخر جلب</th><th></th></tr></thead><tbody>{sources.map((source)=><tr key={source.name}><td><strong>{source.name}</strong></td><td><span className="type-chip"><Rss size={13}/>{source.type}</span></td><td>{source.category}</td><td><strong className="trust-score">{source.trust}%</strong></td><td><span className={source.status==="نشط"?"status s3":"status s2"}>{source.status}</span></td><td>{source.last}</td><td><button className="table-action" onClick={()=>onAction(`بدأ اختبار ${source.name}`)}><Play size={14}/> اختبار</button></td></tr>)}</tbody></table></div></section></>}
function JobsPanel({onAction}:ActionProps){return <><div className="job-summary"><div><CalendarClock/><span><strong>4</strong> مهام مجدولة</span></div><div><CheckCircle2/><span><strong>98.4%</strong> نجاح آخر 7 أيام</span></div><div><AlertTriangle/><span><strong>1</strong> خطأ يحتاج متابعة</span></div></div><section className="jobs-grid">{jobs.map((job)=><article className="job-card" key={job.name}><div className="job-head"><span className={job.state==="متوقف"?"error":"ok"}/><b>{job.state}</b><button onClick={()=>onAction(`${job.state==="متوقف"?"تم تشغيل":"تم إيقاف"} ${job.name}`)}>{job.state==="متوقف"?<Play/>:<Pause/>}</button></div><h3>{job.name}</h3><p>{job.schedule}</p><small>التشغيل القادم: {job.next}</small><div className="job-stats"><span>مقبول <b>74</b></span><span>مكرر <b>21</b></span><span>مرفوض <b>8</b></span></div></article>)}</section></>}
function ReviewsPanel({onAction}:ActionProps){return <><div className="review-warning"><AlertTriangle/><div><strong>8 مواد حساسة</strong><p>تتطلب مدقق حقائق أو رئيس تحرير قبل النشر.</p></div></div><section className="review-list">{articles.slice(0,3).map((article,index)=><article key={article.title}><div><span className={`status ${article.className}`}>{article.status}</span><small>{article.category} · {article.time}</small><h3>{article.title}</h3><p>{article.source} · فحص التشابه: {index+3}%</p></div><div><button onClick={()=>onAction("تم إرسال المادة للتحقق")}>إرسال للتحقق</button><button className="approve" onClick={()=>onAction("تم اعتماد المادة تجريبيًا")}><CheckCircle2/> اعتماد</button></div></article>)}</section></>}
function UsersPanel(){const users=[["نورة العتيبي","رئيس التحرير","كل المحتوى والنشر"],["سلمان الحربي","مراجع","المراجعة والتصحيح"],["ريم خالد","مدقق حقائق","التحقق والمصادر"],["أحمد محمد","محرر","إنشاء وتعديل المسودات"]];return <section className="panel admin-page-panel"><div className="table-wrap"><table><thead><tr><th>المستخدم</th><th>الدور</th><th>نطاق الصلاحية</th><th>الحماية</th></tr></thead><tbody>{users.map((user,i)=><tr key={user[0]}><td><strong>{user[0]}</strong><small>user{i+1}@almukhtasar.test</small></td><td>{user[1]}</td><td>{user[2]}</td><td><span className="status s3">2FA مفعّل</span></td></tr>)}</tbody></table></div></section>}
function AnalyticsPanel(){const [range,setRange]=useState("7");const values=range==="30"?[58,67,62,78,74,88,91]:range==="1"?[45,51,63,70,82,76,94]:[45,62,51,78,68,91,84];function exportReport(){const csv="\uFEFFالمؤشر,القيمة\nالزيارات,284600\nمتوسط القراءة,2:48\nمعدل الإكمال,68%\nالحفظ والمشاركة,12400";const url=URL.createObjectURL(new Blob([csv],{type:"text/csv;charset=utf-8"}));const link=document.createElement("a");link.href=url;link.download="almukhtasar-analytics.csv";link.click();URL.revokeObjectURL(url)}return <><div className="analytics-toolbar"><div><button className={range==="1"?"active":""} onClick={()=>setRange("1")}>اليوم</button><button className={range==="7"?"active":""} onClick={()=>setRange("7")}>7 أيام</button><button className={range==="30"?"active":""} onClick={()=>setRange("30")}>30 يومًا</button><input type="date" aria-label="من تاريخ"/><input type="date" aria-label="إلى تاريخ"/></div><div><button onClick={exportReport}><Download/> Excel / CSV</button><button onClick={()=>window.print()}><Printer/> PDF / طباعة</button></div></div><section className="analytics-kpis"><div><small>الزيارات</small><strong>284.6K</strong><em>+18.2%</em></div><div><small>متوسط القراءة</small><strong>2:48</strong><em>+11.4%</em></div><div><small>معدل الإكمال</small><strong>68%</strong><em>+4.1%</em></div><div><small>الحفظ والمشاركة</small><strong>12.4K</strong><em>+22.7%</em></div></section><section className="admin-panels"><div className="panel chart-panel"><div className="panel-head"><div><h2>الوصول خلال الفترة</h2><p>القراءات اليومية حسب النطاق المحدد.</p></div></div><div className="bar-chart">{values.map((height,i)=><div key={i}><span style={{height:`${height}%`}}/><small>{["أربعاء","خميس","جمعة","سبت","أحد","اثنين","ثلاثاء"][i]}</small></div>)}</div></div><div className="panel"><h2>أداء المصادر</h2><div className="source-performance"><div><span>الوكالة الرسمية</span><b>98%</b></div><progress value="98" max="100"/><div><span>المركز التقني</span><b>94%</b></div><progress value="94" max="100"/><div><span>البوابة الصحية</span><b>91%</b></div><progress value="91" max="100"/></div></div></section></>}
function SettingsPanel({onAction}:ActionProps){return <section className="settings-grid"><div className="panel"><h2>ضوابط النشر</h2><label className="setting-row"><span><b>المراجعة الحساسة</b><small>منع النشر الآلي للسياسة والصحة والأمن والقانون.</small></span><input type="checkbox" defaultChecked/></label><label className="setting-row"><span><b>إظهار مساهمة الذكاء الاصطناعي</b><small>إضافة إفصاح ظاهر في صفحة الخبر.</small></span><input type="checkbox" defaultChecked/></label><label className="setting-row"><span><b>حد الثقة للنشر</b><small>لا ينتقل الخبر للمراجعة إذا كان أقل من الحد.</small></span><input type="number" defaultValue="80" min="0" max="100"/></label></div><div className="panel"><h2>التكاملات</h2>{["مزود الأخبار","مزود الذكاء الاصطناعي","التخزين المتوافق مع S3","خدمة البريد والإشعارات"].map((item)=><div className="integration" key={item}><span><b>{item}</b><small>غير متصل في النسخة التجريبية</small></span><button onClick={()=>onAction(`إعداد ${item}`)}>إعداد</button></div>)}<button className="primary-btn save-settings" onClick={()=>onAction("تم حفظ الإعدادات محليًا")}>حفظ الإعدادات</button></div></section>}
