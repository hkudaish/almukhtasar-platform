import { DatabaseSync } from "node:sqlite";
import { randomUUID } from "node:crypto";
import { mkdirSync, statSync } from "node:fs";
import path from "node:path";

export const adminResources = [
  "content", "sources", "categories", "tags", "users", "roles", "reviews",
  "media", "seo", "ads", "notifications", "newsletters", "integrations",
  "policies", "jobs", "archives", "backups"
] as const;
export type AdminResource = typeof adminResources[number];

export type AdminRecord = {
  id: string;
  resource: AdminResource;
  title: string;
  status: string;
  data: Record<string, unknown>;
  deleted: boolean;
  createdAt: string;
  updatedAt: string;
};

const dataDirectory = path.join(process.cwd(), "data");
mkdirSync(dataDirectory, { recursive: true });
export const adminDatabasePath = path.join(dataDirectory, "almukhtasar-admin.db");
export const adminBackupDirectory = path.join(dataDirectory, "backups");
mkdirSync(adminBackupDirectory, { recursive: true });

const database = new DatabaseSync(adminDatabasePath);
database.exec("PRAGMA busy_timeout = 10000; PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;");
database.exec(`
  CREATE TABLE IF NOT EXISTS admin_records (
    id TEXT PRIMARY KEY,
    resource TEXT NOT NULL,
    title TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'نشط',
    data TEXT NOT NULL DEFAULT '{}',
    deleted INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_admin_records_resource ON admin_records(resource, deleted, updated_at);
  CREATE TABLE IF NOT EXISTS admin_settings (
    section TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    updated_by TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS admin_audit_logs (
    id TEXT PRIMARY KEY,
    actor TEXT NOT NULL,
    action TEXT NOT NULL,
    resource TEXT NOT NULL,
    record_id TEXT,
    details TEXT NOT NULL DEFAULT '{}',
    created_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_admin_audit_created ON admin_audit_logs(created_at DESC);
  CREATE TABLE IF NOT EXISTS source_refresh_runs (
    id TEXT PRIMARY KEY,
    source_id TEXT,
    status TEXT NOT NULL,
    report TEXT NOT NULL DEFAULT '{}',
    started_at TEXT NOT NULL,
    finished_at TEXT NOT NULL,
    actor TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_source_refresh_runs_started ON source_refresh_runs(started_at DESC);
  CREATE TABLE IF NOT EXISTS social_trends (
    id TEXT PRIMARY KEY,
    platform TEXT NOT NULL,
    account TEXT NOT NULL,
    handle TEXT NOT NULL DEFAULT '',
    verified INTEGER NOT NULL DEFAULT 0,
    text TEXT NOT NULL,
    topic TEXT NOT NULL DEFAULT '',
    published_at TEXT,
    metrics TEXT NOT NULL DEFAULT '[]',
    url TEXT NOT NULL,
    source TEXT NOT NULL,
    retrieved_at TEXT NOT NULL,
    normalized TEXT NOT NULL DEFAULT '{}'
  );
  CREATE INDEX IF NOT EXISTS idx_social_trends_platform ON social_trends(platform, published_at DESC, retrieved_at DESC);
  CREATE TABLE IF NOT EXISTS social_refresh_status (
    platform TEXT PRIMARY KEY,
    status TEXT NOT NULL,
    message TEXT NOT NULL DEFAULT '',
    item_count INTEGER NOT NULL DEFAULT 0,
    started_at TEXT NOT NULL,
    finished_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS retrieval_schedules (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    enabled INTEGER NOT NULL DEFAULT 0,
    target_type TEXT NOT NULL,
    target_id TEXT,
    frequency TEXT NOT NULL,
    interval_hours INTEGER NOT NULL DEFAULT 1,
    fixed_time TEXT NOT NULL DEFAULT '00:00',
    weekdays TEXT NOT NULL DEFAULT '[]',
    timezone TEXT NOT NULL DEFAULT 'Asia/Riyadh',
    workflow TEXT NOT NULL DEFAULT 'review',
    next_run_at TEXT,
    last_run_at TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_retrieval_schedules_due ON retrieval_schedules(enabled, next_run_at);
  CREATE TABLE IF NOT EXISTS retrieval_runs (
    id TEXT PRIMARY KEY,
    trigger_type TEXT NOT NULL,
    target_type TEXT NOT NULL,
    target_id TEXT,
    schedule_id TEXT,
    status TEXT NOT NULL,
    actor TEXT NOT NULL,
    report TEXT NOT NULL DEFAULT '{}',
    error TEXT NOT NULL DEFAULT '',
    started_at TEXT NOT NULL,
    finished_at TEXT,
    duration_ms INTEGER
  );
  CREATE INDEX IF NOT EXISTS idx_retrieval_runs_started ON retrieval_runs(started_at DESC);
  CREATE TABLE IF NOT EXISTS retrieval_locks (
    lock_key TEXT PRIMARY KEY,
    run_id TEXT NOT NULL,
    acquired_at TEXT NOT NULL,
    expires_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS news_pipeline_queue (
    id TEXT PRIMARY KEY,
    run_id TEXT NOT NULL,
    source_id TEXT NOT NULL,
    stage TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'queued',
    external_key TEXT NOT NULL,
    payload TEXT NOT NULL DEFAULT '{}',
    attempts INTEGER NOT NULL DEFAULT 0,
    available_at TEXT NOT NULL,
    started_at TEXT,
    finished_at TEXT,
    error TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    UNIQUE(run_id, source_id, stage, external_key)
  );
  CREATE INDEX IF NOT EXISTS idx_news_pipeline_queue_claim ON news_pipeline_queue(run_id, source_id, stage, status, available_at);
  CREATE TABLE IF NOT EXISTS source_retrieval_state (
    source_id TEXT PRIMARY KEY,
    adapter TEXT NOT NULL DEFAULT '',
    retrieval_method TEXT NOT NULL DEFAULT '',
    health_status TEXT NOT NULL DEFAULT 'Healthy',
    consecutive_failures INTEGER NOT NULL DEFAULT 0,
    last_checked_at TEXT,
    last_success_at TEXT,
    last_article_at TEXT,
    last_article_id TEXT,
    last_seen_url TEXT,
    last_publication_date TEXT,
    etag TEXT,
    last_modified TEXT,
    response_time_ms INTEGER,
    articles_found INTEGER NOT NULL DEFAULT 0,
    articles_accepted INTEGER NOT NULL DEFAULT 0,
    articles_rejected INTEGER NOT NULL DEFAULT 0,
    extraction_failures INTEGER NOT NULL DEFAULT 0,
    image_failures INTEGER NOT NULL DEFAULT 0,
    http_errors INTEGER NOT NULL DEFAULT 0,
    last_error TEXT NOT NULL DEFAULT '',
    updated_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS homepage_recovery_logs (
    id TEXT PRIMARY KEY,
    trigger_type TEXT NOT NULL,
    outcome TEXT NOT NULL,
    selected_id TEXT,
    report TEXT NOT NULL DEFAULT '{}',
    created_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_homepage_recovery_created ON homepage_recovery_logs(created_at DESC);
  CREATE TABLE IF NOT EXISTS homepage_snapshot (
    snapshot_key TEXT PRIMARY KEY,
    story TEXT NOT NULL,
    selected_reason TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
`);
try{database.exec("ALTER TABLE social_trends ADD COLUMN normalized TEXT NOT NULL DEFAULT '{}'");}catch{}

const recommendedSources: Array<{ title:string; status:string; data:Record<string, unknown> }> = [
  { title:"وكالة الأنباء السعودية (واس)", status:"نشط", data:{ englishName:"Saudi Press Agency", type:"وكالة أنباء رسمية", tier:"رسمي حكومي", country:"السعودية", language:"العربية", category:"رسمي، محليات، سياسة، اقتصاد", categories:"رسمي، محليات، سياسة، اقتصاد، مجتمع، رياضة", geography:"السعودية، إقليمي، دولي", contentTypes:"نص، صور، فيديو، بيانات رسمية", trust:100, priority:1, url:"https://www.spa.gov.sa", fetchMethod:"صفحة أخبار رسمية", updateFrequency:"كل 15 دقيقة", maxItems:50, publicationMode:"مراجعة تحريرية", sensitiveReview:true, copyrightMode:"ملخص أصلي مع رابط المصدر", role:"مصدر أساسي للبيانات الرسمية", notes:"يُقدّم على المصادر الداعمة عند تكرار الخبر الرسمي."} },
  { title:"قناة الإخبارية السعودية", status:"نشط", data:{ englishName:"Al Ekhbariya", type:"قناة رسمية", tier:"رسمي حكومي", country:"السعودية", language:"العربية", category:"عاجل، محليات، لقاءات، فيديو", categories:"رسمي، محليات، سياسة، اقتصاد، تنمية، مجتمع", geography:"السعودية، إقليمي، دولي", contentTypes:"نص، فيديو، بث مباشر، تقارير، مقابلات", trust:100, priority:1, url:"https://www.alekhbariya.net", youtubeUrl:"https://www.youtube.com/@alekhbariyatv", fetchMethod:"موقع رسمي / فيديو", updateFrequency:"كل 15 دقيقة", maxItems:50, publicationMode:"مراجعة تحريرية", sensitiveReview:true, copyrightMode:"ملخص أصلي وتضمين مرخّص فقط", role:"مصدر أساسي للبث والتصريحات والمقابلات", notes:"مصدر داعم لواس في البيانات المكتوبة وأساسي للمحتوى المرئي والمباشر."} },
  { title:"صحيفة عكاظ", status:"نشط", data:{ type:"صحيفة وطنية", tier:"صحافة وطنية معروفة", country:"السعودية", language:"العربية", category:"عام", categories:"محليات، سياسة، مجتمع، اقتصاد، ثقافة", trust:90, priority:3, url:"https://www.okaz.com.sa", fetchMethod:"موقع إخباري", updateFrequency:"كل ساعة", maxItems:30, publicationMode:"مسودة", sensitiveReview:true, copyrightMode:"عنوان وملخص أصلي ورابط فقط"} },
  { title:"صحيفة الرياض", status:"نشط", data:{ type:"صحيفة وطنية", tier:"صحافة وطنية معروفة", country:"السعودية", language:"العربية", category:"عام", categories:"محليات، اقتصاد، مجتمع، ثقافة", trust:90, priority:3, url:"https://www.alriyadh.com", fetchMethod:"موقع إخباري", updateFrequency:"كل ساعة", maxItems:30, publicationMode:"مسودة", sensitiveReview:true, copyrightMode:"عنوان وملخص أصلي ورابط فقط"} },
  { title:"صحيفة سبق", status:"نشط", data:{ type:"صحيفة إلكترونية", tier:"صحافة وطنية معروفة", country:"السعودية", language:"العربية", category:"عام وعاجل", categories:"محليات، مجتمع، رياضة، تقنية", trust:86, priority:4, url:"https://sabq.org", fetchMethod:"موقع إخباري", updateFrequency:"كل 30 دقيقة", maxItems:30, publicationMode:"مسودة", sensitiveReview:true, copyrightMode:"عنوان وملخص أصلي ورابط فقط"} },
  { title:"العربية", status:"نشط", data:{ type:"قناة إخبارية", tier:"قناة رئيسية", country:"السعودية", language:"العربية", category:"سياسة واقتصاد", categories:"سياسة، اقتصاد، إقليمي، دولي", trust:91, priority:3, url:"https://www.alarabiya.net", fetchMethod:"موقع / فيديو", updateFrequency:"كل 30 دقيقة", maxItems:30, publicationMode:"مسودة", sensitiveReview:true, copyrightMode:"ملخص أصلي ورابط المصدر"} },
  { title:"الشرق للأعمال مع بلومبرغ", status:"نشط", data:{ type:"مصدر اقتصادي متخصص", tier:"متخصص معتمد", country:"السعودية", language:"العربية", category:"اقتصاد", categories:"اقتصاد، أسواق، شركات، طاقة", trust:94, priority:2, url:"https://www.asharqbusiness.com", fetchMethod:"موقع / فيديو", updateFrequency:"كل 30 دقيقة", maxItems:30, publicationMode:"مسودة", sensitiveReview:false, copyrightMode:"ملخص أصلي ورابط المصدر"} },
  { title:"الاقتصادية", status:"نشط", data:{ type:"صحيفة اقتصادية", tier:"متخصص معتمد", country:"السعودية", language:"العربية", category:"اقتصاد", categories:"اقتصاد، أسواق، شركات", trust:92, priority:2, url:"https://www.aleqt.com", fetchMethod:"موقع إخباري", updateFrequency:"كل ساعة", maxItems:30, publicationMode:"مسودة", sensitiveReview:false, copyrightMode:"ملخص أصلي ورابط المصدر"} },
  { title:"الرياضية", status:"نشط", data:{ type:"صحيفة رياضية", tier:"متخصص معتمد", country:"السعودية", language:"العربية", category:"رياضة", categories:"رياضة سعودية، كرة قدم", trust:90, priority:3, url:"https://arriyadiyah.com", fetchMethod:"موقع إخباري", updateFrequency:"كل 30 دقيقة", maxItems:30, publicationMode:"مسودة", sensitiveReview:false, copyrightMode:"ملخص أصلي ورابط المصدر", notes:"تُقدّم حسابات الاتحادات والأندية الرسمية عند التعارض."} },
  { title:"سيدتي", status:"نشط", data:{ type:"مجلة متخصصة", tier:"متخصص معتمد", country:"السعودية", language:"العربية", category:"أسرة ومجتمع", categories:"المرأة، الأسرة، المجتمع، أسلوب حياة", trust:86, priority:4, url:"https://www.sayidaty.net", fetchMethod:"موقع إخباري", updateFrequency:"كل 3 ساعات", maxItems:20, publicationMode:"مسودة", sensitiveReview:false, copyrightMode:"ملخص أصلي ورابط المصدر"} }
];

recommendedSources.push(
  {title:"وزارة الخارجية السعودية",status:"نشط",data:{type:"جهة حكومية رسمية",tier:"رسمي حكومي",url:"https://www.mofa.gov.sa/ar/ministry/news/Pages/default.aspx",articlePathPrefix:"/ar/ministry/news/Pages/",categories:"السياسة",trust:100,priority:1,fetchMethod:"صفحة أخبار رسمية",updateFrequency:"كل ساعة",publicationMode:"مراجعة تحريرية",sensitiveReview:true}},
  {title:"وزارة المالية السعودية",status:"نشط",data:{type:"جهة حكومية رسمية",tier:"رسمي حكومي",url:"https://www.mof.gov.sa/mediacenter/news/Pages/default.aspx",articlePathPrefix:"/mediacenter/news/Pages/",categories:"الاقتصاد",trust:100,priority:1,fetchMethod:"صفحة أخبار رسمية",updateFrequency:"كل 3 ساعات",publicationMode:"مراجعة تحريرية"}},
  {title:"الهيئة العامة للإحصاء",status:"نشط",data:{type:"جهة حكومية رسمية",tier:"رسمي حكومي",url:"https://www.stats.gov.sa/ar/news?delta=20&start=0",categories:"الاقتصاد",trust:100,priority:1,fetchMethod:"صفحة أخبار رسمية",updateFrequency:"كل 6 ساعات",publicationMode:"مراجعة تحريرية"}},
  {title:"تداول السعودية",status:"نشط",data:{type:"سوق مالية رسمية",tier:"رسمي حكومي",url:"https://www.saudiexchange.sa",categories:"الاقتصاد",trust:98,priority:1,fetchMethod:"موقع رسمي",updateFrequency:"كل ساعة",publicationMode:"مراجعة تحريرية"}},
  {title:"وزارة الموارد البشرية والتنمية الاجتماعية",status:"نشط",data:{type:"جهة حكومية رسمية",tier:"رسمي حكومي",url:"https://www.hrsd.gov.sa",categories:"المجتمع",trust:100,priority:1,fetchMethod:"موقع رسمي",updateFrequency:"كل 3 ساعات",publicationMode:"مراجعة تحريرية"}},
  {title:"وزارة الرياضة السعودية",status:"نشط",data:{type:"جهة حكومية رسمية",tier:"رسمي حكومي",url:"https://www.mos.gov.sa",categories:"الرياضة",trust:100,priority:1,fetchMethod:"موقع رسمي",updateFrequency:"كل ساعة",publicationMode:"مراجعة تحريرية"}},
  {title:"الاتحاد السعودي لكرة القدم",status:"نشط",data:{type:"اتحاد رياضي رسمي",tier:"رسمي حكومي",url:"https://www.saff.com.sa",categories:"الرياضة",trust:98,priority:1,fetchMethod:"موقع رسمي",updateFrequency:"كل ساعة",publicationMode:"مراجعة تحريرية"}},
  {title:"وزارة الاتصالات وتقنية المعلومات",status:"نشط",data:{type:"جهة حكومية رسمية",tier:"رسمي حكومي",url:"https://www.mcit.gov.sa",categories:"التقنية، الذكاء الاصطناعي",trust:100,priority:1,fetchMethod:"موقع رسمي",updateFrequency:"كل 3 ساعات",publicationMode:"مراجعة تحريرية"}},
  {title:"هيئة الاتصالات والفضاء والتقنية",status:"نشط",data:{type:"جهة تنظيمية رسمية",tier:"رسمي حكومي",url:"https://www.cst.gov.sa",categories:"التقنية",trust:100,priority:1,fetchMethod:"موقع رسمي",updateFrequency:"كل 3 ساعات",publicationMode:"مراجعة تحريرية"}},
  {title:"الهيئة السعودية للبيانات والذكاء الاصطناعي (سدايا)",status:"نشط",data:{type:"جهة حكومية رسمية",tier:"رسمي حكومي",url:"https://sdaia.gov.sa",categories:"الذكاء الاصطناعي، التقنية",trust:100,priority:1,fetchMethod:"موقع رسمي",updateFrequency:"كل 3 ساعات",publicationMode:"مراجعة تحريرية"}},
  {title:"وزارة الصحة السعودية",status:"نشط",data:{type:"جهة حكومية رسمية",tier:"رسمي حكومي",url:"https://www.moh.gov.sa/Ministry/MediaCenter/News/Pages/default.aspx",categories:"الصحة والجمال",trust:100,priority:1,fetchMethod:"موقع رسمي",updateFrequency:"كل ساعة",publicationMode:"تحقق إلزامي",sensitiveReview:true}},
  {title:"الهيئة العامة للغذاء والدواء",status:"نشط",data:{type:"جهة تنظيمية رسمية",tier:"رسمي حكومي",url:"https://www.sfda.gov.sa",categories:"الصحة والجمال",trust:100,priority:1,fetchMethod:"موقع رسمي",updateFrequency:"كل ساعة",publicationMode:"تحقق إلزامي",sensitiveReview:true}},
  {title:"وزارة الثقافة السعودية",status:"نشط",data:{type:"جهة حكومية رسمية",tier:"رسمي حكومي",url:"https://www.moc.gov.sa",categories:"الثقافة",trust:100,priority:1,fetchMethod:"موقع رسمي",updateFrequency:"كل 3 ساعات",publicationMode:"مراجعة تحريرية"}},
  {title:"هيئة الأدب والنشر والترجمة",status:"نشط",data:{type:"هيئة ثقافية رسمية",tier:"رسمي حكومي",url:"https://lpt.moc.gov.sa",categories:"الثقافة",trust:100,priority:1,fetchMethod:"موقع رسمي",updateFrequency:"كل 6 ساعات",publicationMode:"مراجعة تحريرية"}},
  {title:"وزارة التجارة السعودية",status:"نشط",data:{type:"جهة حكومية رسمية",tier:"رسمي حكومي",url:"https://mc.gov.sa",categories:"السيارات، الاقتصاد",trust:100,priority:1,fetchMethod:"موقع رسمي",updateFrequency:"كل ساعة",publicationMode:"مراجعة تحريرية"}},
  {title:"الهيئة السعودية للمواصفات والمقاييس والجودة",status:"نشط",data:{type:"جهة تنظيمية رسمية",tier:"رسمي حكومي",url:"https://www.saso.gov.sa",categories:"السيارات، التقنية",trust:100,priority:1,fetchMethod:"موقع رسمي",updateFrequency:"كل 3 ساعات",publicationMode:"مراجعة تحريرية"}},
  {title:"المركز السعودي لكفاءة الطاقة",status:"نشط",data:{type:"مركز وطني رسمي",tier:"رسمي حكومي",url:"https://www.seec.gov.sa",categories:"السيارات، الاقتصاد",trust:98,priority:2,fetchMethod:"موقع رسمي",updateFrequency:"كل 6 ساعات",publicationMode:"مراجعة تحريرية"}},
  {title:"وزارة السياحة السعودية",status:"نشط",data:{type:"جهة حكومية رسمية",tier:"رسمي حكومي",url:"https://www.mt.gov.sa",categories:"السفر",trust:100,priority:1,fetchMethod:"موقع رسمي",updateFrequency:"كل 3 ساعات",publicationMode:"مراجعة تحريرية"}},
  {title:"الهيئة السعودية للسياحة",status:"نشط",data:{type:"هيئة حكومية رسمية",tier:"رسمي حكومي",url:"https://cms.sta.gov.sa/ar/news",apiUrl:"https://cms.sta.gov.sa/bin/api/v1/news-main?pagePath=%2Fcontent%2Fsta%2Fsa%2Far%2Fnews&start=0&limit=30",articlePathPrefix:"/ar/news/",categories:"السفر",trust:100,priority:1,fetchMethod:"API رسمي",updateFrequency:"كل 3 ساعات",publicationMode:"مراجعة تحريرية"}},
  {title:"الهيئة العامة للطيران المدني",status:"نشط",data:{type:"جهة تنظيمية رسمية",tier:"رسمي حكومي",url:"https://gaca.gov.sa",categories:"السفر",trust:100,priority:1,fetchMethod:"موقع رسمي",updateFrequency:"كل 3 ساعات",publicationMode:"مراجعة تحريرية"}},
  {title:"وزارة التعليم السعودية",status:"نشط",data:{type:"جهة حكومية رسمية",tier:"رسمي حكومي",url:"https://www.moe.gov.sa/ar/Pages/searchterms.aspx",categories:"التعليم",trust:100,priority:1,fetchMethod:"موقع رسمي",updateFrequency:"كل 3 ساعات",publicationMode:"مراجعة تحريرية"}},
  {title:"المؤسسة العامة للتدريب التقني والمهني",status:"نشط",data:{type:"جهة حكومية رسمية",tier:"رسمي حكومي",url:"https://www.tvtc.gov.sa",categories:"التعليم، التقنية",trust:100,priority:1,fetchMethod:"موقع رسمي",updateFrequency:"كل 3 ساعات",publicationMode:"مراجعة تحريرية"}},
  {title:"جامعة الملك عبدالله للعلوم والتقنية (كاوست)",status:"نشط",data:{type:"جامعة بحثية سعودية",tier:"متخصص معتمد",url:"https://www.kaust.edu.sa/ar/news",additionalUrls:"https://www.kaust.edu.sa/ar/news/2\nhttps://www.kaust.edu.sa/ar/news/3",articlePathPrefix:"/ar/news/",categories:"الذكاء الاصطناعي",trust:98,priority:2,fetchMethod:"موقع رسمي",updateFrequency:"كل 6 ساعات",maxItems:60,publicationMode:"مراجعة تحريرية",strictClassification:true}}
  ,{title:"وزارة الطاقة السعودية",status:"نشط",data:{type:"جهة حكومية رسمية",tier:"رسمي حكومي",url:"https://www.moenergy.gov.sa/ar/mediacenter/news",categories:"الطاقة، الاقتصاد",trust:100,priority:1,fetchMethod:"صفحة أخبار رسمية",updateFrequency:"كل ساعة",publicationMode:"مراجعة تحريرية"}}
  ,{title:"وزارة البلديات والإسكان",status:"نشط",data:{type:"جهة حكومية رسمية",tier:"رسمي حكومي",url:"https://momah.gov.sa/ar/news",categories:"العقارات، المجتمع",trust:100,priority:1,fetchMethod:"صفحة أخبار رسمية",updateFrequency:"كل 3 ساعات",publicationMode:"مراجعة تحريرية"}}
  ,{title:"الهيئة العامة للعقار",status:"نشط",data:{type:"جهة تنظيمية رسمية",tier:"رسمي حكومي",url:"https://rega.gov.sa/media-center/news/",categories:"العقارات",trust:100,priority:1,fetchMethod:"صفحة أخبار رسمية",updateFrequency:"كل 3 ساعات",publicationMode:"مراجعة تحريرية"}}
  ,{title:"وزارة البيئة والمياه والزراعة",status:"نشط",data:{type:"جهة حكومية رسمية",tier:"رسمي حكومي",url:"https://www.mewa.gov.sa/ar/MediaCenter/News/Pages/default.aspx",categories:"البيئة",trust:100,priority:1,fetchMethod:"صفحة أخبار رسمية",updateFrequency:"كل 3 ساعات",publicationMode:"مراجعة تحريرية"}}
  ,{title:"المركز الوطني للأرصاد",status:"نشط",data:{type:"جهة حكومية رسمية",tier:"رسمي حكومي",url:"https://ncm.gov.sa/Ar/MediaCenter/News/Pages/default.aspx",categories:"البيئة",trust:100,priority:1,fetchMethod:"صفحة أخبار رسمية",updateFrequency:"كل ساعة",publicationMode:"مراجعة تحريرية"}}
  ,{title:"المنصة الوطنية الموحدة للتوظيف (جدارات)",status:"نشط",data:{type:"منصة حكومية رسمية",tier:"رسمي حكومي",url:"https://jadarat.sa",categories:"الوظائف",trust:100,priority:1,fetchMethod:"موقع رسمي",updateFrequency:"كل 3 ساعات",publicationMode:"مراجعة تحريرية"}}
  ,{title:"المركز الوطني للفعاليات",status:"نشط",data:{type:"مركز وطني رسمي",tier:"رسمي حكومي",url:"https://nec.gov.sa",categories:"الفعاليات",trust:100,priority:1,fetchMethod:"موقع رسمي",updateFrequency:"كل 3 ساعات",publicationMode:"مراجعة تحريرية"}}
);

const seedData: Partial<Record<AdminResource, Array<{ title: string; status: string; data: Record<string, unknown> }>>> = {
  content: [
    { title:"خدمات رقمية جديدة تعتمد الذكاء الاصطناعي", status:"بانتظار المراجعة", data:{type:"خبر",category:"الذكاء الاصطناعي",author:"أحمد محمد",source:"وكالة رسمية",language:"العربية",featured:true} },
    { title:"الأسواق تترقب بيانات اقتصادية مؤثرة", status:"مسودة", data:{type:"تحليل",category:"الاقتصاد",author:"نورة العتيبي",source:"تقرير اقتصادي",language:"العربية"} },
    { title:"تحديثات جديدة في خدمات المتابعة الصحية", status:"بحاجة إلى تحقق", data:{type:"خبر",category:"الصحة",author:"سلمان الحربي",source:"بوابة صحية",sensitive:true} },
    { title:"استعدادات الفرق قبل المواجهة النهائية", status:"معتمد", data:{type:"تقرير",category:"الرياضة",author:"أحمد محمد",source:"الاتحاد الرسمي"} }
  ],
  sources: [
    { title:"وكالة الأنباء الرسمية", status:"نشط", data:{type:"API",country:"السعودية",language:"العربية",category:"محليات وسياسة",trust:98,priority:1,url:"https://example.com/api",lastRun:"منذ 8 دقائق"} },
    { title:"المركز الوطني للتوعية", status:"نشط", data:{type:"RSS",country:"السعودية",language:"العربية",category:"تقنية",trust:96,priority:2,url:"https://example.com/rss",lastRun:"منذ 21 دقيقة"} },
    { title:"البوابة الصحية الرسمية", status:"نشط", data:{type:"API",country:"السعودية",language:"العربية",category:"صحة",trust:99,priority:1,url:"https://example.com/health",lastRun:"منذ 38 دقيقة"} },
    { title:"مصدر اقتصادي خارجي", status:"متوقف", data:{type:"RSS",country:"دولي",language:"العربية",category:"اقتصاد",trust:82,priority:3,url:"https://example.com/economy",error:"تعذر الاتصال"} }
  ],
  categories: [
    {title:"الذكاء الاصطناعي",status:"ظاهر",data:{slug:"ai",color:"#0e7490",order:1,parent:"—",articles:128,menu:true}},
    {title:"التقنية",status:"ظاهر",data:{slug:"technology",color:"#475569",order:2,parent:"—",articles:214,menu:true}},
    {title:"الصحة",status:"ظاهر",data:{slug:"health",color:"#047857",order:3,parent:"—",articles:96,menu:true}},
    {title:"الرياضة",status:"ظاهر",data:{slug:"sports",color:"#9f1239",order:4,parent:"—",articles:187,menu:true}}
  ],
  tags: [
    {title:"الأمن السيبراني",status:"نشط",data:{slug:"cyber-security",articles:42}},
    {title:"الأسواق",status:"نشط",data:{slug:"markets",articles:38}},
    {title:"الصحة الرقمية",status:"نشط",data:{slug:"digital-health",articles:29}}
  ],
  users: [
    {title:"نورة العتيبي",status:"نشط",data:{email:"nora@almukhtasar.test",role:"رئيس التحرير",twoFactor:true,lastLogin:"منذ 12 دقيقة"}},
    {title:"سلمان الحربي",status:"نشط",data:{email:"salman@almukhtasar.test",role:"مراجع",twoFactor:true,lastLogin:"منذ ساعة"}},
    {title:"ريم خالد",status:"نشط",data:{email:"reem@almukhtasar.test",role:"مدقق حقائق",twoFactor:true,lastLogin:"أمس"}},
    {title:"أحمد محمد",status:"نشط",data:{email:"ahmad@almukhtasar.test",role:"محرر",twoFactor:false,lastLogin:"منذ 31 دقيقة"}}
  ],
  roles: [
    {title:"مدير النظام",status:"نشط",data:{users:1,permissions:["view","create","edit","delete","approve","publish","settings"]}},
    {title:"رئيس التحرير",status:"نشط",data:{users:1,permissions:["view","create","edit","approve","publish"]}},
    {title:"محرر",status:"نشط",data:{users:4,permissions:["view","create","edit"]}},
    {title:"مدقق حقائق",status:"نشط",data:{users:2,permissions:["view","review","fact_check"]}}
  ],
  reviews: [
    {title:"مراجعة المادة الصحية الرقمية",status:"عاجل",data:{assignee:"ريم خالد",confidence:72,sources:2,deadline:"اليوم 19:30"}},
    {title:"تدقيق أرقام تقرير الأسواق",status:"قيد التحقق",data:{assignee:"سلمان الحربي",confidence:84,sources:3,deadline:"غدًا 10:00"}}
  ],
  integrations: [
    {title:"مزود الأخبار RSS",status:"متصل",data:{provider:"RSS",lastTest:"منذ 5 دقائق",attempts:14,secretConfigured:true}},
    {title:"الذكاء الاصطناعي",status:"غير متصل",data:{provider:"OpenAI-compatible",lastTest:"لم يُختبر",attempts:0,secretConfigured:false}},
    {title:"خدمة البريد",status:"غير متصل",data:{provider:"SMTP",lastTest:"لم يُختبر",attempts:0,secretConfigured:false}},
    {title:"Google Analytics",status:"غير متصل",data:{provider:"GA4",lastTest:"لم يُختبر",attempts:0,secretConfigured:false}},
    {title:"التخزين السحابي",status:"غير متصل",data:{provider:"S3",lastTest:"لم يُختبر",attempts:0,secretConfigured:false}}
  ],
  policies: [
    {title:"سياسة الخصوصية",status:"منشور",data:{language:"العربية",version:3,updatedBy:"نورة العتيبي",updatedAt:"2026-07-14"}},
    {title:"سياسة التحرير",status:"منشور",data:{language:"العربية",version:5,updatedBy:"نورة العتيبي",updatedAt:"2026-07-12"}},
    {title:"سياسة استخدام الذكاء الاصطناعي",status:"منشور",data:{language:"العربية",version:2,updatedBy:"سلمان الحربي",updatedAt:"2026-07-10"}},
    {title:"ضوابط الأخبار الحساسة",status:"مسودة",data:{language:"العربية",version:1,updatedBy:"ريم خالد",updatedAt:"2026-07-14"}}
  ],
  media: [
    {title:"غلاف الذكاء الاصطناعي",status:"مستخدم",data:{type:"image/webp",size:"248 KB",alt:"واجهة خدمات رقمية",folder:"الأخبار",url:"/media/ai-cover.webp"}},
    {title:"إنفوجرافيك الأسواق",status:"مستخدم",data:{type:"image/avif",size:"186 KB",alt:"مؤشرات الأسواق",folder:"إنفوجرافيك",url:"/media/markets.avif"}}
  ],
  seo: [
    {title:"الصفحة الرئيسية",status:"مكتمل",data:{score:96,titleLength:38,descriptionLength:142,index:true,canonical:"/"}},
    {title:"تصنيف التقنية",status:"تحذير",data:{score:78,titleLength:22,descriptionLength:0,index:true,issue:"الوصف مفقود"}}
  ],
  ads: [
    {title:"بانر الصفحة الرئيسية",status:"متوقف",data:{placement:"بعد مختصر اليوم",device:"الكل",start:"2026-07-15",end:"2026-08-15",views:0,clicks:0}},
    {title:"إعلان داخل الخبر",status:"نشط",data:{placement:"بعد الفقرة الثالثة",device:"سطح المكتب",views:18240,clicks:214,ctr:"1.17%"}}
  ],
  notifications: [
    {title:"تنبيه خبر عاجل",status:"مسودة",data:{channel:"Web Push",audience:"جميع المستخدمين",scheduledAt:"فوري",language:"العربية"}},
    {title:"تحديثات التقنية المسائية",status:"مجدول",data:{channel:"Web Push",audience:"مهتمو التقنية",scheduledAt:"18:30",language:"العربية"}}
  ],
  newsletters: [
    {title:"الموجز الصباحي",status:"مجدول",data:{subscribers:8420,frequency:"يومي",nextSend:"غدًا 07:00",openRate:"48%",clickRate:"12%"}},
    {title:"حصاد الأسبوع",status:"مسودة",data:{subscribers:5190,frequency:"أسبوعي",nextSend:"الجمعة 09:00",openRate:"52%",clickRate:"16%"}}
  ],
  jobs: [
    {title:"التحديث الرئيسي",status:"نشط",data:{schedule:"15 0 * * *",nextRun:"اليوم 00:15",lastDuration:"2:41",successRate:"99.1%"}},
    {title:"الأخبار العاجلة",status:"نشط",data:{schedule:"*/15 * * * *",nextRun:"بعد 6 دقائق",lastDuration:"0:28",successRate:"98.7%"}},
    {title:"النشرة المسائية",status:"متوقف",data:{schedule:"30 18 * * *",nextRun:"—",lastDuration:"1:12",successRate:"97.4%"}}
  ],
  archives: [
    {title:"أرشيف يوليو 2026",status:"متاح",data:{year:2026,month:7,articles:7,categories:7}},
    {title:"أرشيف يونيو 2026",status:"متاح",data:{year:2026,month:6,articles:1,categories:1}}
  ],
  backups: [
    {title:"نسخة يومية 14 يوليو",status:"سليمة",data:{type:"قاعدة البيانات والإعدادات",size:"18.4 MB",createdAt:"2026-07-14 03:00",checksum:true}}
  ]
};

function seedDatabase() {
  const count = database.prepare("SELECT COUNT(*) AS count FROM admin_records").get() as { count: number };
  if (count.count > 0) return;
  const insert = database.prepare("INSERT INTO admin_records (id, resource, title, status, data, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)");
  const now = new Date().toISOString();
  database.exec("BEGIN");
  try {
    for (const [resource, records] of Object.entries(seedData)) {
      for (const record of records || []) insert.run(randomUUID(), resource, record.title, record.status, JSON.stringify(record.data), now, now);
    }
    database.exec("COMMIT");
  } catch (error) {
    database.exec("ROLLBACK");
    throw error;
  }
}
seedDatabase();

function ensureRecommendedSources() {
  const exists = database.prepare("SELECT id, data FROM admin_records WHERE resource = 'sources' AND title = ? LIMIT 1");
  const insert = database.prepare("INSERT INTO admin_records (id, resource, title, status, data, created_at, updated_at) VALUES (?, 'sources', ?, ?, ?, ?, ?)");
  const update = database.prepare("UPDATE admin_records SET data = ?, updated_at = ? WHERE id = ?");
  const now = new Date().toISOString();
  for (const source of recommendedSources) {
    const approval={approved:true,verificationStatus:"معتمد",verifiedAt:"2026-07-18",officialDomain:new URL(String(source.data.url)).hostname.replace(/^www\./,""),catalogManaged:true};
    const current=exists.get(source.title) as {id:string;data:string}|undefined;
    if (!current) insert.run(randomUUID(), source.title, source.status, JSON.stringify({...source.data,...approval}), now, now);
    else {const next=JSON.stringify({...source.data,...JSON.parse(current.data),url:source.data.url,fetchMethod:source.data.fetchMethod,categories:source.data.categories,...approval});if(next!==current.data)update.run(next,now,current.id);}
  }
}
ensureRecommendedSources();

function archiveNonNewsImports(){
  const policies:Record<string,string>={"وزارة الخارجية السعودية":"/ar/ministry/news/Pages/","وزارة المالية السعودية":"/mediacenter/news/Pages/","الهيئة العامة للإحصاء":"/ar/news/"};
  const rows=database.prepare("SELECT id, data FROM admin_records WHERE resource = 'content' AND deleted = 0 AND status IN ('منشور','معتمد','مؤرشف')").all() as Array<{id:string;data:string}>;
  const archive=database.prepare("UPDATE admin_records SET status = 'مؤرشف', deleted = 1, data = ?, updated_at = ? WHERE id = ?");
  const now=new Date().toISOString();
  for(const row of rows){
    const data=JSON.parse(row.data) as Record<string,unknown>,prefix=policies[String(data.source||"")];
    if(!prefix)continue;
    try{if(new URL(String(data.originalUrl||"")).pathname.startsWith(prefix))continue;}catch{}
    archive.run(JSON.stringify({...data,exclusionReason:"استُبعد لأنه ليس رابط خبر ضمن مركز أخبار المصدر"}),now,row.id);
  }
}
archiveNonNewsImports();

function quarantineLegacyImports(){
  const rows=database.prepare("SELECT id, data FROM admin_records WHERE resource = 'content' AND deleted = 0 AND status IN ('منشور','معتمد')").all() as Array<{id:string;data:string}>;
  const quarantine=database.prepare("UPDATE admin_records SET status = 'بحاجة إلى مراجعة', data = ?, updated_at = ? WHERE id = ?");
  const now=new Date().toISOString();
  for(const row of rows){
    const data=JSON.parse(row.data) as Record<string,unknown>;
    if(data.type!=="خبر مستورد"||Number(data.editorialVersion)>=3)continue;
    quarantine.run(JSON.stringify({...data,verified:false,validationStatus:"يتطلب إعادة تحقق",validationErrors:["أُنشئت المادة قبل تطبيق بوابة التحقق الحالية ويجب إعادة جلب صفحة الخبر وفحصها"],reviewRequired:true,reviewState:"بحاجة إلى إعادة جلب ومراجعة"}),now,row.id);
  }
}
quarantineLegacyImports();

function toRecord(row: Record<string, unknown>): AdminRecord {
  return {
    id: String(row.id), resource: String(row.resource) as AdminResource, title: String(row.title), status: String(row.status),
    data: JSON.parse(String(row.data || "{}")), deleted: Boolean(row.deleted), createdAt: String(row.created_at), updatedAt: String(row.updated_at)
  };
}

export function isAdminResource(value: string): value is AdminResource { return (adminResources as readonly string[]).includes(value); }

export function listRecords(resource: AdminResource, options: { search?: string; status?: string; page?: number; limit?: number; deleted?: boolean } = {}) {
  const page = Math.max(options.page || 1, 1), limit = Math.min(Math.max(options.limit || 20, 1), 100), offset = (page - 1) * limit;
  const conditions = ["resource = ?", "deleted = ?"], values: Array<string | number> = [resource, options.deleted ? 1 : 0];
  if (options.search) { conditions.push("(title LIKE ? OR data LIKE ?)"); values.push(`%${options.search}%`, `%${options.search}%`); }
  if (options.status && options.status !== "الكل") { conditions.push("status = ?"); values.push(options.status); }
  const where = conditions.join(" AND ");
  const rows = database.prepare(`SELECT * FROM admin_records WHERE ${where} ORDER BY updated_at DESC LIMIT ? OFFSET ?`).all(...values, limit, offset) as Record<string, unknown>[];
  const total = database.prepare(`SELECT COUNT(*) AS count FROM admin_records WHERE ${where}`).get(...values) as { count: number };
  return { data: rows.map(toRecord), meta: { page, limit, total: total.count, pages: Math.ceil(total.count / limit) } };
}

export function createRecord(resource: AdminResource, input: { title: string; status?: string; data?: Record<string, unknown> }, actor = "مدير النظام") {
  const id = randomUUID(), now = new Date().toISOString();
  database.prepare("INSERT INTO admin_records (id, resource, title, status, data, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)").run(id, resource, input.title, input.status || "نشط", JSON.stringify(input.data || {}), now, now);
  writeAudit(actor, "CREATE", resource, id, { title: input.title });
  return getRecord(resource, id)!;
}

export function getRecord(resource: AdminResource, id: string) {
  const row = database.prepare("SELECT * FROM admin_records WHERE resource = ? AND id = ?").get(resource, id) as Record<string, unknown> | undefined;
  return row ? toRecord(row) : null;
}

export function findRecordByTitle(resource: AdminResource, title: string) {
  const row = database.prepare("SELECT * FROM admin_records WHERE resource = ? AND title = ? AND deleted = 0 ORDER BY updated_at DESC LIMIT 1").get(resource, title) as Record<string, unknown> | undefined;
  return row ? toRecord(row) : null;
}

export function updateRecord(resource: AdminResource, id: string, input: { title?: string; status?: string; data?: Record<string, unknown>; restore?: boolean }, actor = "مدير النظام") {
  const current = getRecord(resource, id); if (!current) return null;
  const data = input.data ? { ...current.data, ...input.data } : current.data;
  database.prepare("UPDATE admin_records SET title = ?, status = ?, data = ?, deleted = ?, updated_at = ? WHERE id = ? AND resource = ?")
    .run(input.title ?? current.title, input.status ?? current.status, JSON.stringify(data), input.restore ? 0 : current.deleted ? 1 : 0, new Date().toISOString(), id, resource);
  writeAudit(actor, input.restore ? "RESTORE" : "UPDATE", resource, id, { fields: Object.keys(input) });
  return getRecord(resource, id);
}

export function deleteRecord(resource: AdminResource, id: string, actor = "مدير النظام") {
  const current = getRecord(resource, id); if (!current) return false;
  database.prepare("UPDATE admin_records SET deleted = 1, updated_at = ? WHERE id = ? AND resource = ?").run(new Date().toISOString(), id, resource);
  writeAudit(actor, "ARCHIVE", resource, id, { title: current.title }); return true;
}

export function writeAudit(actor: string, action: string, resource: string, recordId?: string, details: Record<string, unknown> = {}) {
  database.prepare("INSERT INTO admin_audit_logs (id, actor, action, resource, record_id, details, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)")
    .run(randomUUID(), actor, action, resource, recordId || null, JSON.stringify(details), new Date().toISOString());
}

export function listAuditLogs(search = "", limit = 100) {
  const rows = search
    ? database.prepare("SELECT * FROM admin_audit_logs WHERE actor LIKE ? OR action LIKE ? OR resource LIKE ? OR details LIKE ? ORDER BY created_at DESC LIMIT ?").all(...Array(4).fill(`%${search}%`), limit)
    : database.prepare("SELECT * FROM admin_audit_logs ORDER BY created_at DESC LIMIT ?").all(limit);
  return (rows as Record<string, unknown>[]).map((row) => ({ id:row.id, actor:row.actor, action:row.action, resource:row.resource, recordId:row.record_id, details:JSON.parse(String(row.details || "{}")), createdAt:row.created_at }));
}

export type SourceRefreshReport = {
  id:string; sourceId:string|null; status:string; startedAt:string; finishedAt:string; actor:string;
  report:Record<string, unknown>;
};

export function saveSourceRefreshRun(sourceId:string|null, status:string, report:Record<string, unknown>, startedAt:string, actor="مدير النظام") {
  const id=randomUUID(), finishedAt=new Date().toISOString();
  database.prepare("INSERT INTO source_refresh_runs (id, source_id, status, report, started_at, finished_at, actor) VALUES (?, ?, ?, ?, ?, ?, ?)")
    .run(id, sourceId, status, JSON.stringify(report), startedAt, finishedAt, actor);
  writeAudit(actor,"SOURCE_REFRESH", "sources", sourceId || undefined, { runId:id, status, ...report });
  return { id, sourceId, status, report, startedAt, finishedAt, actor } satisfies SourceRefreshReport;
}

export function listSourceRefreshRuns(limit=10) {
  const rows=database.prepare("SELECT * FROM source_refresh_runs ORDER BY started_at DESC LIMIT ?").all(Math.min(Math.max(limit,1),50)) as Record<string,unknown>[];
  return rows.map((row)=>({ id:String(row.id), sourceId:row.source_id?String(row.source_id):null, status:String(row.status), report:JSON.parse(String(row.report||"{}")), startedAt:String(row.started_at), finishedAt:String(row.finished_at), actor:String(row.actor) })) satisfies SourceRefreshReport[];
}

export type StoredSocialTrend = {
  id:string; platform:string; account:string; handle:string; verified:boolean; text:string; topic:string;
  publishedAt:string|null; metrics:Array<{label:string;value:string}>; url:string; source:string; retrievedAt:string; normalized?:Record<string,unknown>;
};

export function listStoredSocialTrends() {
  const rows=database.prepare("SELECT * FROM social_trends ORDER BY COALESCE(published_at, retrieved_at) DESC").all() as Record<string,unknown>[];
  return rows.map((row)=>({
    id:String(row.id),platform:String(row.platform),account:String(row.account),handle:String(row.handle||""),verified:Boolean(row.verified),
    text:String(row.text),topic:String(row.topic||""),publishedAt:row.published_at?String(row.published_at):null,
    metrics:JSON.parse(String(row.metrics||"[]")),url:String(row.url),source:String(row.source),retrievedAt:String(row.retrieved_at),normalized:JSON.parse(String(row.normalized||"{}"))
  })) satisfies StoredSocialTrend[];
}

export function replaceStoredSocialTrends(platform:string,items:StoredSocialTrend[]) {
  const remove=database.prepare("DELETE FROM social_trends WHERE platform = ?");
  const insert=database.prepare("INSERT INTO social_trends (id, platform, account, handle, verified, text, topic, published_at, metrics, url, source, retrieved_at, normalized) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
  database.exec("BEGIN");
  try {
    remove.run(platform);
    for(const item of items)insert.run(item.id,platform,item.account,item.handle,item.verified?1:0,item.text,item.topic,item.publishedAt,JSON.stringify(item.metrics),item.url,item.source,item.retrievedAt,JSON.stringify(item.normalized||{}));
    database.exec("COMMIT");
  } catch(error) { database.exec("ROLLBACK"); throw error; }
}

export function saveSocialRefreshStatus(platform:string,status:string,message:string,itemCount:number,startedAt:string) {
  const finishedAt=new Date().toISOString();
  database.prepare("INSERT INTO social_refresh_status (platform, status, message, item_count, started_at, finished_at) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(platform) DO UPDATE SET status=excluded.status, message=excluded.message, item_count=excluded.item_count, started_at=excluded.started_at, finished_at=excluded.finished_at")
    .run(platform,status,message,itemCount,startedAt,finishedAt);
  return {platform,status,message,itemCount,startedAt,finishedAt};
}

export function listSocialRefreshStatuses() {
  return (database.prepare("SELECT * FROM social_refresh_status ORDER BY platform").all() as Record<string,unknown>[]).map((row)=>({
    platform:String(row.platform),status:String(row.status),message:String(row.message||""),itemCount:Number(row.item_count||0),startedAt:String(row.started_at),finishedAt:String(row.finished_at)
  }));
}

export function getSettings(section?: string) {
  const rows = section ? database.prepare("SELECT * FROM admin_settings WHERE section = ?").all(section) : database.prepare("SELECT * FROM admin_settings ORDER BY section").all();
  return (rows as Record<string, unknown>[]).map((row) => ({ section:row.section, value:JSON.parse(String(row.value)), updatedAt:row.updated_at, updatedBy:row.updated_by }));
}

export function saveSettings(section: string, value: Record<string, unknown>, actor = "مدير النظام") {
  const now = new Date().toISOString();
  database.prepare("INSERT INTO admin_settings (section, value, updated_at, updated_by) VALUES (?, ?, ?, ?) ON CONFLICT(section) DO UPDATE SET value=excluded.value, updated_at=excluded.updated_at, updated_by=excluded.updated_by")
    .run(section, JSON.stringify(value), now, actor);
  writeAudit(actor, "SETTINGS_UPDATE", "settings", section, { fields:Object.keys(value) });
  return { section, value, updatedAt:now, updatedBy:actor };
}

export function createPhysicalBackup(title = "نسخة احتياطية يدوية", scope = "قاعدة البيانات", actor = "مدير النظام") {
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const filePath = path.join(adminBackupDirectory, `almukhtasar-${stamp}.db`);
  const sqlPath = filePath.replace(/\\/g, "/").replace(/'/g, "''");
  database.exec(`VACUUM INTO '${sqlPath}'`);
  const size = statSync(filePath).size;
  return createRecord("backups", { title, status:"سليمة", data:{ type:scope, size:`${(size/1024).toFixed(1)} KB`, createdAt:new Date().toLocaleString("ar-SA"), checksum:true, fileName:path.basename(filePath) } }, actor);
}

export type RetrievalSchedule={id:string;name:string;enabled:boolean;targetType:string;targetId:string|null;frequency:string;intervalHours:number;fixedTime:string;weekdays:number[];timezone:string;workflow:string;nextRunAt:string|null;lastRunAt:string|null;createdAt:string;updatedAt:string};
function toRetrievalSchedule(row:Record<string,unknown>):RetrievalSchedule{return {id:String(row.id),name:String(row.name),enabled:Boolean(row.enabled),targetType:String(row.target_type),targetId:row.target_id?String(row.target_id):null,frequency:String(row.frequency),intervalHours:Number(row.interval_hours||1),fixedTime:String(row.fixed_time||"00:00"),weekdays:JSON.parse(String(row.weekdays||"[]")),timezone:String(row.timezone||"Asia/Riyadh"),workflow:String(row.workflow||"review"),nextRunAt:row.next_run_at?String(row.next_run_at):null,lastRunAt:row.last_run_at?String(row.last_run_at):null,createdAt:String(row.created_at),updatedAt:String(row.updated_at)};}
export function listRetrievalSchedules(){return (database.prepare("SELECT * FROM retrieval_schedules ORDER BY created_at").all() as Record<string,unknown>[]).map(toRetrievalSchedule);}
export function getRetrievalSchedule(id:string){const row=database.prepare("SELECT * FROM retrieval_schedules WHERE id = ?").get(id) as Record<string,unknown>|undefined;return row?toRetrievalSchedule(row):null;}
export function saveRetrievalSchedule(input:Partial<RetrievalSchedule>&{name:string;targetType:string;frequency:string},id?:string){
  const now=new Date().toISOString(),scheduleId=id||randomUUID(),current=id?getRetrievalSchedule(id):null;
  const value={name:input.name,enabled:input.enabled??current?.enabled??false,targetType:input.targetType,targetId:input.targetId??null,frequency:input.frequency,intervalHours:Math.max(1,Number(input.intervalHours||1)),fixedTime:input.fixedTime||"00:00",weekdays:input.weekdays||[],timezone:input.timezone||"Asia/Riyadh",workflow:input.workflow||"review",nextRunAt:Object.prototype.hasOwnProperty.call(input,"nextRunAt")?input.nextRunAt??null:current?.nextRunAt??null,lastRunAt:current?.lastRunAt??null};
  database.prepare("INSERT INTO retrieval_schedules (id,name,enabled,target_type,target_id,frequency,interval_hours,fixed_time,weekdays,timezone,workflow,next_run_at,last_run_at,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name,enabled=excluded.enabled,target_type=excluded.target_type,target_id=excluded.target_id,frequency=excluded.frequency,interval_hours=excluded.interval_hours,fixed_time=excluded.fixed_time,weekdays=excluded.weekdays,timezone=excluded.timezone,workflow=excluded.workflow,next_run_at=excluded.next_run_at,updated_at=excluded.updated_at")
    .run(scheduleId,value.name,value.enabled?1:0,value.targetType,value.targetId,value.frequency,value.intervalHours,value.fixedTime,JSON.stringify(value.weekdays),value.timezone,value.workflow,value.nextRunAt,value.lastRunAt,current?.createdAt||now,now);
  return getRetrievalSchedule(scheduleId)!;
}
export function updateRetrievalScheduleRun(id:string,lastRunAt:string,nextRunAt:string|null){database.prepare("UPDATE retrieval_schedules SET last_run_at=?, next_run_at=?, updated_at=? WHERE id=?").run(lastRunAt,nextRunAt,new Date().toISOString(),id);return getRetrievalSchedule(id);}
export function deleteRetrievalSchedule(id:string){return database.prepare("DELETE FROM retrieval_schedules WHERE id=?").run(id).changes>0;}

export function startRetrievalRun(input:{triggerType:string;targetType:string;targetId?:string|null;scheduleId?:string|null;actor:string}){const id=randomUUID(),startedAt=new Date().toISOString();database.prepare("INSERT INTO retrieval_runs (id,trigger_type,target_type,target_id,schedule_id,status,actor,started_at) VALUES (?,?,?,?,?,'running',?,?)").run(id,input.triggerType,input.targetType,input.targetId||null,input.scheduleId||null,input.actor,startedAt);return {id,startedAt};}
export function finishRetrievalRun(id:string,status:string,report:Record<string,unknown>={},error=""){const row=database.prepare("SELECT started_at FROM retrieval_runs WHERE id=?").get(id) as {started_at:string}|undefined,finishedAt=new Date().toISOString(),durationMs=row?Date.now()-Date.parse(row.started_at):0;database.prepare("UPDATE retrieval_runs SET status=?,report=?,error=?,finished_at=?,duration_ms=? WHERE id=?").run(status,JSON.stringify(report),error,finishedAt,durationMs,id);return {id,status,report,error,finishedAt,durationMs};}
export function listRetrievalRuns(limit=50){return (database.prepare("SELECT * FROM retrieval_runs ORDER BY started_at DESC LIMIT ?").all(Math.min(Math.max(limit,1),100)) as Record<string,unknown>[]).map((row)=>({id:String(row.id),triggerType:String(row.trigger_type),targetType:String(row.target_type),targetId:row.target_id?String(row.target_id):null,scheduleId:row.schedule_id?String(row.schedule_id):null,status:String(row.status),actor:String(row.actor),report:JSON.parse(String(row.report||"{}")),error:String(row.error||""),startedAt:String(row.started_at),finishedAt:row.finished_at?String(row.finished_at):null,durationMs:row.duration_ms==null?null:Number(row.duration_ms)}));}

export function acquireRetrievalLock(lockKey:string,runId:string,ttlMs=30*60*1000){
  const now=new Date(),expiresAt=new Date(now.getTime()+ttlMs).toISOString(),family=lockKey.split(":")[0],allKey=`${family}:all`;
  try{database.exec("BEGIN IMMEDIATE");database.prepare("DELETE FROM retrieval_locks WHERE expires_at <= ?").run(now.toISOString());const conflict=lockKey.endsWith(":all")?database.prepare("SELECT lock_key FROM retrieval_locks WHERE lock_key LIKE ? LIMIT 1").get(`${family}:%`):database.prepare("SELECT lock_key FROM retrieval_locks WHERE lock_key IN (?,?) LIMIT 1").get(lockKey,allKey);if(conflict){database.exec("ROLLBACK");return false;}database.prepare("INSERT INTO retrieval_locks (lock_key,run_id,acquired_at,expires_at) VALUES (?,?,?,?)").run(lockKey,runId,now.toISOString(),expiresAt);database.exec("COMMIT");return true;}catch{try{database.exec("ROLLBACK");}catch{}return false;}
}
export function releaseRetrievalLock(lockKey:string,runId:string){database.prepare("DELETE FROM retrieval_locks WHERE lock_key=? AND run_id=?").run(lockKey,runId);}

export type NewsPipelineStage="discovery"|"hydration"|"validation"|"publishing";
export type NewsPipelineQueueItem={id:string;runId:string;sourceId:string;stage:NewsPipelineStage;status:string;externalKey:string;payload:Record<string,unknown>;attempts:number;availableAt:string;startedAt:string|null;finishedAt:string|null;error:string;createdAt:string;updatedAt:string};
function toPipelineQueueItem(row:Record<string,unknown>):NewsPipelineQueueItem{return {id:String(row.id),runId:String(row.run_id),sourceId:String(row.source_id),stage:String(row.stage) as NewsPipelineStage,status:String(row.status),externalKey:String(row.external_key),payload:JSON.parse(String(row.payload||"{}")),attempts:Number(row.attempts||0),availableAt:String(row.available_at),startedAt:row.started_at?String(row.started_at):null,finishedAt:row.finished_at?String(row.finished_at):null,error:String(row.error||""),createdAt:String(row.created_at),updatedAt:String(row.updated_at)};}
export function enqueueNewsPipelineItem(input:{runId:string;sourceId:string;stage:NewsPipelineStage;externalKey:string;payload:Record<string,unknown>;availableAt?:string}){
  const id=randomUUID(),now=new Date().toISOString(),availableAt=input.availableAt||now;
  database.prepare("INSERT INTO news_pipeline_queue (id,run_id,source_id,stage,status,external_key,payload,available_at,created_at,updated_at) VALUES (?,?,?,?, 'queued',?,?,?,?,?) ON CONFLICT(run_id,source_id,stage,external_key) DO UPDATE SET payload=excluded.payload,available_at=excluded.available_at,updated_at=excluded.updated_at").run(id,input.runId,input.sourceId,input.stage,input.externalKey,JSON.stringify(input.payload),availableAt,now,now);
  const row=database.prepare("SELECT * FROM news_pipeline_queue WHERE run_id=? AND source_id=? AND stage=? AND external_key=?").get(input.runId,input.sourceId,input.stage,input.externalKey) as Record<string,unknown>;
  return toPipelineQueueItem(row);
}
export function claimNewsPipelineItems(runId:string,sourceId:string,stage:NewsPipelineStage,limit=10){
  const now=new Date().toISOString(),rows=database.prepare("SELECT * FROM news_pipeline_queue WHERE run_id=? AND source_id=? AND stage=? AND status IN ('queued','retry') AND available_at<=? ORDER BY created_at LIMIT ?").all(runId,sourceId,stage,now,Math.min(Math.max(limit,1),50)) as Record<string,unknown>[];
  if(!rows.length)return [];
  database.exec("BEGIN IMMEDIATE");
  try{const claim=database.prepare("UPDATE news_pipeline_queue SET status='processing',attempts=attempts+1,started_at=?,updated_at=? WHERE id=? AND status IN ('queued','retry')");for(const row of rows)claim.run(now,now,String(row.id));database.exec("COMMIT");}catch(error){database.exec("ROLLBACK");throw error;}
  return rows.map((row)=>toPipelineQueueItem({...row,status:"processing",attempts:Number(row.attempts||0)+1,started_at:now,updated_at:now}));
}
export function finishNewsPipelineItem(id:string,status:"completed"|"failed"|"review",payload?:Record<string,unknown>,error=""){
  const now=new Date().toISOString(),current=database.prepare("SELECT payload FROM news_pipeline_queue WHERE id=?").get(id) as {payload:string}|undefined,nextPayload=payload?JSON.stringify({...JSON.parse(current?.payload||"{}"),...payload}):current?.payload||"{}";
  database.prepare("UPDATE news_pipeline_queue SET status=?,payload=?,error=?,finished_at=?,updated_at=? WHERE id=?").run(status,nextPayload,error,now,now,id);
}
export function retryNewsPipelineItem(id:string,error:string,delayMs:number){
  const availableAt=new Date(Date.now()+Math.max(1000,delayMs)).toISOString(),now=new Date().toISOString();
  database.prepare("UPDATE news_pipeline_queue SET status='retry',error=?,available_at=?,updated_at=? WHERE id=?").run(error,availableAt,now,id);
}
export function recoverStaleNewsPipelineItems(staleMs=30*60*1000){
  const cutoff=new Date(Date.now()-Math.max(60000,staleMs)).toISOString(),now=new Date().toISOString();
  return database.prepare("UPDATE news_pipeline_queue SET status='retry',available_at=?,error=CASE WHEN error='' THEN 'Recovered after interrupted worker' ELSE error END,updated_at=? WHERE status='processing' AND started_at<?").run(now,now,cutoff).changes;
}
export function newsPipelineQueueSummary(runId:string){return (database.prepare("SELECT stage,status,COUNT(*) count FROM news_pipeline_queue WHERE run_id=? GROUP BY stage,status").all(runId) as Array<Record<string,unknown>>).reduce<Record<string,Record<string,number>>>((result,row)=>{const stage=String(row.stage),status=String(row.status);result[stage]||={};result[stage][status]=Number(row.count||0);return result;},{});}

export type SourceRetrievalState={sourceId:string;adapter:string;retrievalMethod:string;healthStatus:string;consecutiveFailures:number;lastCheckedAt:string|null;lastSuccessAt:string|null;lastArticleAt:string|null;lastArticleId:string|null;lastSeenUrl:string|null;lastPublicationDate:string|null;etag:string|null;lastModified:string|null;responseTimeMs:number|null;articlesFound:number;articlesAccepted:number;articlesRejected:number;extractionFailures:number;imageFailures:number;httpErrors:number;lastError:string;updatedAt:string};
function toSourceRetrievalState(row:Record<string,unknown>):SourceRetrievalState{return {sourceId:String(row.source_id),adapter:String(row.adapter||""),retrievalMethod:String(row.retrieval_method||""),healthStatus:String(row.health_status||"Healthy"),consecutiveFailures:Number(row.consecutive_failures||0),lastCheckedAt:row.last_checked_at?String(row.last_checked_at):null,lastSuccessAt:row.last_success_at?String(row.last_success_at):null,lastArticleAt:row.last_article_at?String(row.last_article_at):null,lastArticleId:row.last_article_id?String(row.last_article_id):null,lastSeenUrl:row.last_seen_url?String(row.last_seen_url):null,lastPublicationDate:row.last_publication_date?String(row.last_publication_date):null,etag:row.etag?String(row.etag):null,lastModified:row.last_modified?String(row.last_modified):null,responseTimeMs:row.response_time_ms==null?null:Number(row.response_time_ms),articlesFound:Number(row.articles_found||0),articlesAccepted:Number(row.articles_accepted||0),articlesRejected:Number(row.articles_rejected||0),extractionFailures:Number(row.extraction_failures||0),imageFailures:Number(row.image_failures||0),httpErrors:Number(row.http_errors||0),lastError:String(row.last_error||""),updatedAt:String(row.updated_at)};}
export function getSourceRetrievalState(sourceId:string){const row=database.prepare("SELECT * FROM source_retrieval_state WHERE source_id=?").get(sourceId) as Record<string,unknown>|undefined;return row?toSourceRetrievalState(row):null;}
export function listSourceRetrievalStates(){return (database.prepare("SELECT * FROM source_retrieval_state ORDER BY updated_at DESC").all() as Record<string,unknown>[]).map(toSourceRetrievalState);}
export function saveSourceRetrievalState(sourceId:string,input:Partial<Omit<SourceRetrievalState,"sourceId"|"updatedAt">>){
  const current=getSourceRetrievalState(sourceId),now=new Date().toISOString(),value={adapter:input.adapter??current?.adapter??"",retrievalMethod:input.retrievalMethod??current?.retrievalMethod??"",healthStatus:input.healthStatus??current?.healthStatus??"Healthy",consecutiveFailures:input.consecutiveFailures??current?.consecutiveFailures??0,lastCheckedAt:input.lastCheckedAt??current?.lastCheckedAt??null,lastSuccessAt:input.lastSuccessAt??current?.lastSuccessAt??null,lastArticleAt:input.lastArticleAt??current?.lastArticleAt??null,lastArticleId:input.lastArticleId??current?.lastArticleId??null,lastSeenUrl:input.lastSeenUrl??current?.lastSeenUrl??null,lastPublicationDate:input.lastPublicationDate??current?.lastPublicationDate??null,etag:input.etag??current?.etag??null,lastModified:input.lastModified??current?.lastModified??null,responseTimeMs:input.responseTimeMs??current?.responseTimeMs??null,articlesFound:input.articlesFound??current?.articlesFound??0,articlesAccepted:input.articlesAccepted??current?.articlesAccepted??0,articlesRejected:input.articlesRejected??current?.articlesRejected??0,extractionFailures:input.extractionFailures??current?.extractionFailures??0,imageFailures:input.imageFailures??current?.imageFailures??0,httpErrors:input.httpErrors??current?.httpErrors??0,lastError:input.lastError??current?.lastError??""};
  database.prepare("INSERT INTO source_retrieval_state (source_id,adapter,retrieval_method,health_status,consecutive_failures,last_checked_at,last_success_at,last_article_at,last_article_id,last_seen_url,last_publication_date,etag,last_modified,response_time_ms,articles_found,articles_accepted,articles_rejected,extraction_failures,image_failures,http_errors,last_error,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(source_id) DO UPDATE SET adapter=excluded.adapter,retrieval_method=excluded.retrieval_method,health_status=excluded.health_status,consecutive_failures=excluded.consecutive_failures,last_checked_at=excluded.last_checked_at,last_success_at=excluded.last_success_at,last_article_at=excluded.last_article_at,last_article_id=excluded.last_article_id,last_seen_url=excluded.last_seen_url,last_publication_date=excluded.last_publication_date,etag=excluded.etag,last_modified=excluded.last_modified,response_time_ms=excluded.response_time_ms,articles_found=excluded.articles_found,articles_accepted=excluded.articles_accepted,articles_rejected=excluded.articles_rejected,extraction_failures=excluded.extraction_failures,image_failures=excluded.image_failures,http_errors=excluded.http_errors,last_error=excluded.last_error,updated_at=excluded.updated_at").run(sourceId,value.adapter,value.retrievalMethod,value.healthStatus,value.consecutiveFailures,value.lastCheckedAt,value.lastSuccessAt,value.lastArticleAt,value.lastArticleId,value.lastSeenUrl,value.lastPublicationDate,value.etag,value.lastModified,value.responseTimeMs,value.articlesFound,value.articlesAccepted,value.articlesRejected,value.extractionFailures,value.imageFailures,value.httpErrors,value.lastError,now);
  return getSourceRetrievalState(sourceId)!;
}

function ensureRetrievalSchedules(){if(!listRetrievalSchedules().length){saveRetrievalSchedule({name:"تحديث الأخبار",targetType:"news",frequency:"hourly",intervalHours:1,fixedTime:"00:00",timezone:"Asia/Riyadh",workflow:"review",enabled:true});saveRetrievalSchedule({name:"تحديث منصات التواصل",targetType:"social",frequency:"hourly",intervalHours:1,fixedTime:"00:00",timezone:"Asia/Riyadh",workflow:"review",enabled:true});}else database.prepare("UPDATE retrieval_schedules SET enabled=1, updated_at=? WHERE name='تحديث منصات التواصل' AND last_run_at IS NULL").run(new Date().toISOString());}
ensureRetrievalSchedules();

export function saveHomepageRecoveryLog(triggerType:string,outcome:string,selectedId:string|null,report:Record<string,unknown>){const createdAt=new Date().toISOString(),signature=JSON.stringify({triggerType,outcome,selectedId,report});const recent=database.prepare("SELECT report,outcome,selected_id,created_at FROM homepage_recovery_logs ORDER BY created_at DESC LIMIT 1").get() as Record<string,unknown>|undefined;if(recent&&Date.now()-Date.parse(String(recent.created_at))<300000&&String(recent.outcome)===outcome&&String(recent.selected_id||"")===String(selectedId||"")&&JSON.stringify({triggerType,outcome,selectedId,report:JSON.parse(String(recent.report||"{}"))})===signature)return;database.prepare("INSERT INTO homepage_recovery_logs (id,trigger_type,outcome,selected_id,report,created_at) VALUES (?,?,?,?,?,?)").run(randomUUID(),triggerType,outcome,selectedId,JSON.stringify(report),createdAt);}
export function listHomepageRecoveryLogs(limit=30){return (database.prepare("SELECT * FROM homepage_recovery_logs ORDER BY created_at DESC LIMIT ?").all(Math.min(Math.max(limit,1),100)) as Record<string,unknown>[]).map((row)=>({id:String(row.id),triggerType:String(row.trigger_type),outcome:String(row.outcome),selectedId:row.selected_id?String(row.selected_id):null,report:JSON.parse(String(row.report||"{}")),createdAt:String(row.created_at)}));}
export function saveHomepageSnapshot(story:Record<string,unknown>,selectedReason:string){const updatedAt=new Date().toISOString();database.prepare("INSERT INTO homepage_snapshot (snapshot_key,story,selected_reason,updated_at) VALUES ('main',?,?,?) ON CONFLICT(snapshot_key) DO UPDATE SET story=excluded.story,selected_reason=excluded.selected_reason,updated_at=excluded.updated_at").run(JSON.stringify(story),selectedReason,updatedAt);return {story,selectedReason,updatedAt};}
export function getHomepageSnapshot(){const row=database.prepare("SELECT story,selected_reason,updated_at FROM homepage_snapshot WHERE snapshot_key='main'").get() as Record<string,unknown>|undefined;return row?{story:JSON.parse(String(row.story||"{}")) as Record<string,unknown>,selectedReason:String(row.selected_reason),updatedAt:String(row.updated_at)}:null;}
