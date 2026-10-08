import "server-only";
import { createHash, randomUUID } from "node:crypto";
import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { DEFAULT_SETTINGS } from "@/config/defaults";
import { classifyArticle, isApprovedSource, isNonNewsTitle, isNonNewsUrl, isSourceBoilerplate, cleanSummaryText, summarizeArticle, summaryQuality } from "@/lib/content-policy";
import { activeNewsWindow, isInActiveNewsWindow, rollingNewsDays } from "@/lib/news-window";
import { balanceCategories, classifyGeography, scoreEditorialPriority } from "@/lib/editorial-policy";
import { extractSemanticTags } from "@/lib/semantic-tags";
import type { Article, ArchiveStatus, QueueName, SiteSettings, Source, SocialPost, TrendTopic, DailyBrief } from "@/types/news";

function initDatabase(): DatabaseSync {
  const defaultPath = path.resolve(process.cwd(), process.env.DATABASE_PATH || "database/light-news.db");
  const isLambda = Boolean(process.env.AWS_LAMBDA_FUNCTION_NAME || process.env.LAMBDA_TASK_ROOT);

  let databasePath = defaultPath;

  if (isLambda) {
    const tmpDb = "/tmp/light-news.db";
    if (!existsSync(tmpDb)) {
      const candidates = [
        defaultPath,
        path.resolve(process.cwd(), "light-version/database/light-news.db"),
        path.resolve(process.cwd(), "../database/light-news.db"),
        path.resolve(process.env.LAMBDA_TASK_ROOT || "", "database/light-news.db"),
        path.resolve(process.env.LAMBDA_TASK_ROOT || "", "light-version/database/light-news.db"),
        path.resolve(process.env.LAMBDA_TASK_ROOT || "", "src/database/light-news.db"),
        path.resolve(process.env.LAMBDA_TASK_ROOT || "", ".next/server/database/light-news.db")
      ];
      for (const candidate of candidates) {
        if (existsSync(candidate)) {
          try {
            copyFileSync(candidate, tmpDb);
            if (existsSync(`${candidate}-wal`)) {
              try { copyFileSync(`${candidate}-wal`, `${tmpDb}-wal`); } catch {}
            }
            if (existsSync(`${candidate}-shm`)) {
              try { copyFileSync(`${candidate}-shm`, `${tmpDb}-shm`); } catch {}
            }
            break;
          } catch {}
        }
      }
    }
    databasePath = tmpDb;
  } else {
    try {
      mkdirSync(path.dirname(databasePath), { recursive: true });
    } catch {}
  }

  let dbInstance: DatabaseSync;
  try {
    dbInstance = new DatabaseSync(databasePath);
  } catch (openErr) {
    const tmpDb = "/tmp/light-news.db";
    if (databasePath !== tmpDb) {
      try {
        if (!existsSync(tmpDb) && existsSync(databasePath)) {
          copyFileSync(databasePath, tmpDb);
        }
        dbInstance = new DatabaseSync(tmpDb);
      } catch {
        throw openErr;
      }
    } else {
      throw openErr;
    }
  }

  try {
    dbInstance.exec("PRAGMA busy_timeout=30000; PRAGMA foreign_keys=ON;");
    const journalMode = dbInstance.prepare("PRAGMA journal_mode").get() as { journal_mode: string };
    if (String(journalMode?.journal_mode).toLowerCase() !== "wal") {
      dbInstance.exec("PRAGMA journal_mode=WAL;");
    }
  } catch {}
  return dbInstance;
}

const db = initDatabase();

try {
  const socialInfo = db.prepare("PRAGMA table_info(social_posts)").all() as Array<{ name: string }>;
  if (socialInfo.length > 0 && !socialInfo.some((c) => c.name === "post_id")) {
    db.exec("ALTER TABLE social_posts RENAME TO legacy_social_posts;");
  }
} catch {}

db.exec(`
CREATE TABLE IF NOT EXISTS sources (
  id TEXT PRIMARY KEY,name TEXT NOT NULL,domain TEXT NOT NULL DEFAULT '',source_type TEXT NOT NULL DEFAULT 'news',
  country TEXT NOT NULL DEFAULT '',language TEXT NOT NULL DEFAULT 'ar',reliability_score INTEGER NOT NULL DEFAULT 80,
  priority INTEGER NOT NULL DEFAULT 5,status TEXT NOT NULL DEFAULT 'active',health TEXT NOT NULL DEFAULT 'Healthy',
  api_endpoint TEXT NOT NULL DEFAULT '',rss_endpoint TEXT NOT NULL DEFAULT '',listing_url TEXT NOT NULL DEFAULT '',
  main_categories TEXT NOT NULL DEFAULT '[]',subcategories TEXT NOT NULL DEFAULT '[]',
  keywords TEXT NOT NULL DEFAULT '[]',excluded_keywords TEXT NOT NULL DEFAULT '[]',retrieval_method TEXT NOT NULL DEFAULT 'rss',
  fallback_methods TEXT NOT NULL DEFAULT '[]',last_successful_fetch TEXT,last_seen_article_id TEXT NOT NULL DEFAULT '',
  last_seen_guid TEXT NOT NULL DEFAULT '',last_seen_url TEXT NOT NULL DEFAULT '',last_seen_published_at TEXT,last_seen_modified_at TEXT,
  etag TEXT NOT NULL DEFAULT '',last_modified TEXT NOT NULL DEFAULT '',automatic_publication_enabled INTEGER NOT NULL DEFAULT 0,
  requires_editorial_review INTEGER NOT NULL DEFAULT 1,consecutive_failures INTEGER NOT NULL DEFAULT 0,
  last_error TEXT NOT NULL DEFAULT '',updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sources_status_priority ON sources(status,priority);
CREATE TABLE IF NOT EXISTS articles (
  id TEXT PRIMARY KEY,slug TEXT NOT NULL UNIQUE,title TEXT NOT NULL,normalized_title TEXT NOT NULL,summary TEXT NOT NULL,
  content TEXT NOT NULL DEFAULT '[]',main_category TEXT NOT NULL,subcategory TEXT NOT NULL DEFAULT '',source_id TEXT,
  source_name TEXT NOT NULL,source_url TEXT NOT NULL,canonical_url TEXT NOT NULL,source_article_id TEXT NOT NULL DEFAULT '',
  rss_guid TEXT NOT NULL DEFAULT '',author TEXT NOT NULL DEFAULT '',region TEXT NOT NULL DEFAULT '',
  source_published_at TEXT NOT NULL,source_updated_at TEXT,retrieved_at TEXT NOT NULL,
  view_count INTEGER NOT NULL DEFAULT 0,share_count INTEGER NOT NULL DEFAULT 0,
  image_original_url TEXT NOT NULL DEFAULT '',image_local_url TEXT NOT NULL DEFAULT '',image_thumbnail_url TEXT NOT NULL DEFAULT '',
  image_alt TEXT NOT NULL DEFAULT '',image_caption TEXT NOT NULL DEFAULT '',image_credit TEXT NOT NULL DEFAULT '',image_width INTEGER,image_height INTEGER,image_status TEXT NOT NULL DEFAULT 'fallback',
  publication_status TEXT NOT NULL DEFAULT 'review',archive_status TEXT NOT NULL DEFAULT 'current',
  validation_status TEXT NOT NULL DEFAULT 'pending',category_confidence INTEGER NOT NULL DEFAULT 0,
  content_hash TEXT NOT NULL,event_fingerprint TEXT NOT NULL,badge TEXT,created_at TEXT NOT NULL,updated_at TEXT NOT NULL,
  FOREIGN KEY(source_id) REFERENCES sources(id) ON DELETE SET NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_articles_canonical_url ON articles(canonical_url);
CREATE UNIQUE INDEX IF NOT EXISTS uq_articles_source_article ON articles(source_id,source_article_id) WHERE source_article_id<>'';
CREATE UNIQUE INDEX IF NOT EXISTS uq_articles_source_guid ON articles(source_id,rss_guid) WHERE rss_guid<>'';
CREATE INDEX IF NOT EXISTS idx_articles_publication_status ON articles(publication_status);
CREATE INDEX IF NOT EXISTS idx_articles_source_published ON articles(source_published_at DESC);
CREATE INDEX IF NOT EXISTS idx_articles_main_category ON articles(main_category,source_published_at DESC);
CREATE INDEX IF NOT EXISTS idx_articles_subcategory ON articles(subcategory,source_published_at DESC);
CREATE INDEX IF NOT EXISTS idx_articles_content_hash ON articles(content_hash);
CREATE INDEX IF NOT EXISTS idx_articles_event_fingerprint ON articles(event_fingerprint);
CREATE INDEX IF NOT EXISTS idx_articles_archive_status ON articles(archive_status,source_published_at DESC);
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,value TEXT NOT NULL,updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS retrieval_runs (
  id TEXT PRIMARY KEY,trigger TEXT NOT NULL,target_type TEXT NOT NULL,target_id TEXT,status TEXT NOT NULL,
  discovered INTEGER NOT NULL DEFAULT 0,known INTEGER NOT NULL DEFAULT 0,processed INTEGER NOT NULL DEFAULT 0,
  imported INTEGER NOT NULL DEFAULT 0,rejected INTEGER NOT NULL DEFAULT 0,
  duplicates INTEGER NOT NULL DEFAULT 0,images_retrieved INTEGER NOT NULL DEFAULT 0,image_failures INTEGER NOT NULL DEFAULT 0,
  published INTEGER NOT NULL DEFAULT 0,review INTEGER NOT NULL DEFAULT 0,failed INTEGER NOT NULL DEFAULT 0,
  sources_processed INTEGER NOT NULL DEFAULT 0,archived INTEGER NOT NULL DEFAULT 0,error TEXT NOT NULL DEFAULT '',
  started_at TEXT NOT NULL,finished_at TEXT,duration_ms INTEGER
);
CREATE INDEX IF NOT EXISTS idx_retrieval_runs_started ON retrieval_runs(started_at DESC);
CREATE TABLE IF NOT EXISTS pipeline_jobs (
  id TEXT PRIMARY KEY,run_id TEXT NOT NULL,source_id TEXT,queue TEXT NOT NULL,status TEXT NOT NULL DEFAULT 'queued',
  payload TEXT NOT NULL DEFAULT '{}',attempts INTEGER NOT NULL DEFAULT 0,error TEXT NOT NULL DEFAULT '',
  available_at TEXT NOT NULL,started_at TEXT,finished_at TEXT,created_at TEXT NOT NULL,updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_pipeline_jobs_claim ON pipeline_jobs(queue,status,available_at);
CREATE TABLE IF NOT EXISTS retrieval_locks (
  source_id TEXT PRIMARY KEY,run_id TEXT NOT NULL,expires_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS repair_log (
  id TEXT PRIMARY KEY,article_id TEXT,issue TEXT NOT NULL,action TEXT NOT NULL,details TEXT NOT NULL DEFAULT '{}',created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS cache_versions (
  key TEXT PRIMARY KEY,version INTEGER NOT NULL DEFAULT 1,updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS source_retrieval_results (
  id TEXT PRIMARY KEY,run_id TEXT NOT NULL,source_id TEXT NOT NULL,status TEXT NOT NULL,method TEXT NOT NULL DEFAULT '',
  checked_at TEXT NOT NULL,articles_available INTEGER NOT NULL DEFAULT 0,discovered INTEGER NOT NULL DEFAULT 0,
  known INTEGER NOT NULL DEFAULT 0,processed INTEGER NOT NULL DEFAULT 0,rejected INTEGER NOT NULL DEFAULT 0,
  published INTEGER NOT NULL DEFAULT 0,review INTEGER NOT NULL DEFAULT 0,failed INTEGER NOT NULL DEFAULT 0,
  latest_source_date TEXT,latest_imported_date TEXT,failure_reason TEXT NOT NULL DEFAULT '',details TEXT NOT NULL DEFAULT '{}'
);
CREATE INDEX IF NOT EXISTS idx_source_results_source_checked ON source_retrieval_results(source_id,checked_at DESC);
CREATE INDEX IF NOT EXISTS idx_source_results_run ON source_retrieval_results(run_id);
CREATE TABLE IF NOT EXISTS article_retrieval_log (
  id TEXT PRIMARY KEY,run_id TEXT NOT NULL,source_id TEXT NOT NULL,url TEXT NOT NULL DEFAULT '',stage TEXT NOT NULL,
  status TEXT NOT NULL,reason TEXT NOT NULL DEFAULT '',duplicate_id TEXT,similarity_score REAL,created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_article_retrieval_run ON article_retrieval_log(run_id,source_id,created_at);
CREATE TABLE IF NOT EXISTS article_source_checks (
  id TEXT PRIMARY KEY,article_id TEXT NOT NULL,source_id TEXT,checked_at TEXT NOT NULL,http_status INTEGER,
  source_status TEXT NOT NULL,content_changed INTEGER NOT NULL DEFAULT 0,source_updated_at TEXT,
  final_url TEXT NOT NULL DEFAULT '',reason TEXT NOT NULL DEFAULT '',attempt INTEGER NOT NULL DEFAULT 1,
  FOREIGN KEY(article_id) REFERENCES articles(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_article_source_checks_article ON article_source_checks(article_id,checked_at DESC);
CREATE TABLE IF NOT EXISTS retrieval_schedules (
  id TEXT PRIMARY KEY,name TEXT NOT NULL,target_type TEXT NOT NULL DEFAULT 'all',target_id TEXT NOT NULL DEFAULT '',
  frequency_minutes INTEGER NOT NULL DEFAULT 10,timezone TEXT NOT NULL DEFAULT 'Asia/Riyadh',enabled INTEGER NOT NULL DEFAULT 1,
  last_run_at TEXT,next_run_at TEXT,last_status TEXT NOT NULL DEFAULT 'pending',last_error TEXT NOT NULL DEFAULT '',updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS social_posts (
  id TEXT PRIMARY KEY,platform TEXT NOT NULL,post_id TEXT NOT NULL,
  author_username TEXT NOT NULL,author_name TEXT NOT NULL,author_avatar_url TEXT NOT NULL DEFAULT '',author_verified INTEGER NOT NULL DEFAULT 0,
  content TEXT NOT NULL,url TEXT NOT NULL,published_at TEXT NOT NULL,
  media_type TEXT NOT NULL DEFAULT 'text',media_urls TEXT NOT NULL DEFAULT '[]',thumbnail_url TEXT NOT NULL DEFAULT '',
  likes_count INTEGER NOT NULL DEFAULT 0,reposts_count INTEGER NOT NULL DEFAULT 0,replies_count INTEGER NOT NULL DEFAULT 0,views_count INTEGER NOT NULL DEFAULT 0,
  engagement_score REAL NOT NULL DEFAULT 0,trend_score REAL NOT NULL DEFAULT 0,
  hashtags TEXT NOT NULL DEFAULT '[]',language TEXT NOT NULL DEFAULT 'ar',sentiment TEXT NOT NULL DEFAULT 'neutral',
  status TEXT NOT NULL DEFAULT 'published',article_id TEXT,created_at TEXT NOT NULL,updated_at TEXT NOT NULL,
  FOREIGN KEY(article_id) REFERENCES articles(id) ON DELETE SET NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_social_posts_platform_id ON social_posts(platform, post_id);
CREATE INDEX IF NOT EXISTS idx_social_posts_published ON social_posts(published_at DESC);
CREATE INDEX IF NOT EXISTS idx_social_posts_trend ON social_posts(trend_score DESC, published_at DESC);
CREATE INDEX IF NOT EXISTS idx_social_posts_platform ON social_posts(platform, trend_score DESC);

CREATE TABLE IF NOT EXISTS trends (
  id TEXT PRIMARY KEY,topic TEXT NOT NULL,slug TEXT NOT NULL UNIQUE,
  type TEXT NOT NULL DEFAULT 'story',platform TEXT NOT NULL DEFAULT 'all',
  mention_count INTEGER NOT NULL DEFAULT 1,source_count INTEGER NOT NULL DEFAULT 1,
  x_engagement INTEGER NOT NULL DEFAULT 0,ig_engagement INTEGER NOT NULL DEFAULT 0,
  velocity REAL NOT NULL DEFAULT 0,trend_score REAL NOT NULL DEFAULT 0,
  summary TEXT NOT NULL DEFAULT '',category TEXT NOT NULL DEFAULT 'عام',
  related_article_ids TEXT NOT NULL DEFAULT '[]',related_social_post_ids TEXT NOT NULL DEFAULT '[]',
  first_detected_at TEXT NOT NULL,peak_at TEXT NOT NULL,last_updated_at TEXT NOT NULL,
  is_active INTEGER NOT NULL DEFAULT 1
);
CREATE INDEX IF NOT EXISTS idx_trends_score ON trends(trend_score DESC, is_active);
CREATE INDEX IF NOT EXISTS idx_trends_velocity ON trends(velocity DESC, is_active);
CREATE INDEX IF NOT EXISTS idx_trends_platform ON trends(platform, trend_score DESC);

CREATE TABLE IF NOT EXISTS daily_briefs (
  id TEXT PRIMARY KEY,date TEXT NOT NULL UNIQUE,title TEXT NOT NULL,
  summary TEXT NOT NULL,top_stories TEXT NOT NULL DEFAULT '[]',stats TEXT NOT NULL DEFAULT '{}',
  published_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_daily_briefs_date ON daily_briefs(date DESC);
`);

function migrateArticleImageSchema(){
  const columns=new Set((db.prepare("PRAGMA table_info(articles)").all() as Array<{name:string}>).map((column)=>column.name));
  if(!columns.has("image_caption"))db.exec("ALTER TABLE articles ADD COLUMN image_caption TEXT NOT NULL DEFAULT ''");
  if(!columns.has("image_credit"))db.exec("ALTER TABLE articles ADD COLUMN image_credit TEXT NOT NULL DEFAULT ''");
}
migrateArticleImageSchema();
function migrateArticleEngagementSchema(){
  const columns=new Set((db.prepare("PRAGMA table_info(articles)").all() as Array<{name:string}>).map((column)=>column.name));
  if(!columns.has("view_count"))db.exec("ALTER TABLE articles ADD COLUMN view_count INTEGER NOT NULL DEFAULT 0");
  if(!columns.has("share_count"))db.exec("ALTER TABLE articles ADD COLUMN share_count INTEGER NOT NULL DEFAULT 0");
}
migrateArticleEngagementSchema();
function migrateArticleEditorialSchema(){
  const columns=new Set((db.prepare("PRAGMA table_info(articles)").all() as Array<{name:string}>).map((column)=>column.name));
  const additions:Array<[string,string]>=[["geographic_relevance","TEXT NOT NULL DEFAULT 'unspecified'"],["importance_level","TEXT NOT NULL DEFAULT 'عادي'"],["priority_score","INTEGER NOT NULL DEFAULT 0"],["manual_priority_override","INTEGER"],["homepage_pinned","INTEGER NOT NULL DEFAULT 0"],["homepage_excluded","INTEGER NOT NULL DEFAULT 0"]];
  for(const [name,definition] of additions)if(!columns.has(name))db.exec(`ALTER TABLE articles ADD COLUMN ${name} ${definition}`);
  db.exec("CREATE INDEX IF NOT EXISTS idx_articles_homepage_priority ON articles(homepage_excluded,homepage_pinned,priority_score DESC,source_published_at DESC)");
  db.exec(`UPDATE articles SET
    geographic_relevance=CASE WHEN region<>'' THEN 'saudi_region' WHEN main_category IN ('أخبار السعودية','المناطق') THEN 'saudi_national' WHEN main_category IN ('السياسة','العالم') THEN 'international' ELSE geographic_relevance END,
    importance_level=CASE WHEN badge='عاجل' THEN 'عاجل' WHEN priority_score>=82 THEN 'أولوية قصوى' WHEN priority_score>=62 THEN 'مهم' ELSE importance_level END,
    priority_score=CASE WHEN priority_score=0 THEN CASE main_category WHEN 'أخبار السعودية' THEN 55 WHEN 'المناطق' THEN 52 WHEN 'الاقتصاد' THEN 48 WHEN 'الصحة' THEN 47 WHEN 'التعليم' THEN 47 WHEN 'المجتمع' THEN 44 WHEN 'الرياضة' THEN 42 WHEN 'التقنية' THEN 40 ELSE 35 END ELSE priority_score END
    WHERE geographic_relevance='unspecified' OR priority_score=0`);
}
migrateArticleEditorialSchema();

function migrateBreakingNewsSchema(){
  const articleColumns=new Set((db.prepare("PRAGMA table_info(articles)").all() as Array<{name:string}>).map((column)=>column.name));
  const articleAdditions:Array<[string,string]>=[["is_breaking","INTEGER NOT NULL DEFAULT 0"],["breaking_source","TEXT NOT NULL DEFAULT ''"],["breaking_detected_by","TEXT"],["breaking_verified_at","TEXT"],["breaking_expires_at","TEXT"]];
  for(const [name,definition] of articleAdditions)if(!articleColumns.has(name))db.exec(`ALTER TABLE articles ADD COLUMN ${name} ${definition}`);
  const sourceColumns=new Set((db.prepare("PRAGMA table_info(sources)").all() as Array<{name:string}>).map((column)=>column.name));
  const sourceAdditions:Array<[string,string]>=[["last_breaking_check","TEXT"],["last_breaking_detected_at","TEXT"],["last_breaking_imported_at","TEXT"],["breaking_latency_seconds","INTEGER"],["breaking_health","TEXT NOT NULL DEFAULT 'Healthy'"]];
  for(const [name,definition] of sourceAdditions)if(!sourceColumns.has(name))db.exec(`ALTER TABLE sources ADD COLUMN ${name} ${definition}`);
  db.exec("CREATE INDEX IF NOT EXISTS idx_articles_verified_breaking ON articles(is_breaking,breaking_expires_at,source_published_at DESC)");
  db.exec("UPDATE articles SET badge=NULL,importance_level=CASE WHEN importance_level='عاجل' THEN 'عادي' ELSE importance_level END WHERE badge='عاجل' AND is_breaking=0");
}
migrateBreakingNewsSchema();

function migrateSemanticTagsSchema(){
  const columns=new Set((db.prepare("PRAGMA table_info(articles)").all() as Array<{name:string}>).map((column)=>column.name));
  if(!columns.has("tags"))db.exec("ALTER TABLE articles ADD COLUMN tags TEXT NOT NULL DEFAULT '[]'");
  if(!columns.has("keyphrases"))db.exec("ALTER TABLE articles ADD COLUMN keyphrases TEXT NOT NULL DEFAULT '[]'");
  const rows=db.prepare(`SELECT a.id,a.title,a.content,a.main_category,a.subcategory,a.region,a.source_name,a.tags,s.domain source_domain
    FROM articles a LEFT JOIN sources s ON s.id=a.source_id WHERE a.tags='[]' OR a.tags=''`).all() as Array<Record<string,unknown>>;
  const update=db.prepare("UPDATE articles SET tags=?,keyphrases=? WHERE id=?");
  for(const row of rows){const semantic=extractSemanticTags({title:String(row.title),body:jsonArray(row.content),category:String(row.main_category),subcategory:String(row.subcategory||""),region:String(row.region||""),sourceName:String(row.source_name),sourceDomain:String(row.source_domain||"")});update.run(JSON.stringify(semantic.tags),JSON.stringify(semantic.keyphrases),String(row.id));}
}
migrateSemanticTagsSchema();

function migrateRemoveSourceBoilerplate(){
  const key="cleanup_source_boilerplate_v1";
  const marker=db.prepare("SELECT value FROM settings WHERE key=?").get(key) as {value:string}|undefined;
  if(marker)return;
  const rows=db.prepare("SELECT id, summary, content FROM articles").all() as Array<{id:string;summary:string;content:string}>;
  const update=db.prepare("UPDATE articles SET summary=?, content=? WHERE id=?");
  let cleanedCount=0;
  for(const row of rows){
    let changed=false;
    let paragraphs:string[]=[];
    try{paragraphs=JSON.parse(row.content);}catch{paragraphs=[];}
    const filteredParagraphs=paragraphs.filter((p)=>!isSourceBoilerplate(p));
    if(filteredParagraphs.length!==paragraphs.length)changed=true;
    const cleanedSummary=cleanSummaryText(row.summary);
    if(cleanedSummary!==row.summary)changed=true;
    if(changed){
      update.run(cleanedSummary,JSON.stringify(filteredParagraphs),row.id);
      cleanedCount++;
    }
  }
  const now=new Date().toISOString();
  db.prepare("INSERT OR REPLACE INTO settings (key,value,updated_at) VALUES (?,?,?)").run(key,JSON.stringify({cleanedCount,cleanedAt:now}),now);
}
migrateRemoveSourceBoilerplate();

function migrateArticleClassificationSchema(){
  const columns=new Set((db.prepare("PRAGMA table_info(articles)").all() as Array<{name:string}>).map((column)=>column.name));
  const additions:Array<[string,string]>=[["classification_status","TEXT NOT NULL DEFAULT 'classified'"],["classification_reason","TEXT NOT NULL DEFAULT ''"],["classification_alternatives","TEXT NOT NULL DEFAULT '[]'"]];
  for(const [name,definition] of additions)if(!columns.has(name))db.exec(`ALTER TABLE articles ADD COLUMN ${name} ${definition}`);
  db.exec("CREATE INDEX IF NOT EXISTS idx_articles_classification_status ON articles(classification_status,publication_status)");
}
migrateArticleClassificationSchema();

function migrateArticleSourceStatusSchema(){
  const columns=new Set((db.prepare("PRAGMA table_info(articles)").all() as Array<{name:string}>).map((column)=>column.name)),additions:Array<[string,string]>=[
    ["source_status","TEXT NOT NULL DEFAULT 'Active'"],["last_source_check_at","TEXT"],["last_source_http_status","INTEGER"],
    ["source_check_attempts","INTEGER NOT NULL DEFAULT 0"],["source_consecutive_failures","INTEGER NOT NULL DEFAULT 0"],
    ["source_status_reason","TEXT NOT NULL DEFAULT ''"],["source_redirect_url","TEXT NOT NULL DEFAULT ''"],
    ["source_removed_at","TEXT"],["source_previous_publication_status","TEXT"],["last_source_etag","TEXT NOT NULL DEFAULT ''"],
    ["last_source_modified","TEXT NOT NULL DEFAULT ''"]
  ];
  for(const [name,definition] of additions)if(!columns.has(name))db.exec(`ALTER TABLE articles ADD COLUMN ${name} ${definition}`);
  db.exec("CREATE INDEX IF NOT EXISTS idx_articles_source_status_check ON articles(source_status,last_source_check_at,source_published_at DESC)");
}
migrateArticleSourceStatusSchema();

function migrateSourceManagementSchema(){
  const columns=new Set((db.prepare("PRAGMA table_info(sources)").all() as Array<{name:string}>).map((column)=>column.name));
  const additions:Array<[string,string]>=[["sitemap_endpoint","TEXT NOT NULL DEFAULT ''"],["region","TEXT NOT NULL DEFAULT ''"],["retrieval_frequency_minutes","INTEGER NOT NULL DEFAULT 60"],["schedule_enabled","INTEGER NOT NULL DEFAULT 1"],["last_seen_modified_at","TEXT"]];
  for(const [name,definition] of additions)if(!columns.has(name))db.exec(`ALTER TABLE sources ADD COLUMN ${name} ${definition}`);
  db.exec("UPDATE sources SET last_seen_modified_at=last_seen_published_at WHERE last_seen_modified_at IS NULL AND last_seen_published_at IS NOT NULL");
  const scheduleColumns=new Set((db.prepare("PRAGMA table_info(retrieval_schedules)").all() as Array<{name:string}>).map((column)=>column.name));
  const scheduleAdditions:Array<[string,string]>=[["frequency_minutes","INTEGER NOT NULL DEFAULT 10"],["last_status","TEXT NOT NULL DEFAULT 'pending'"],["last_error","TEXT NOT NULL DEFAULT ''"]];
  for(const [name,definition] of scheduleAdditions)if(!scheduleColumns.has(name))db.exec(`ALTER TABLE retrieval_schedules ADD COLUMN ${name} ${definition}`);
  if(scheduleColumns.has("interval_hours")&&!scheduleColumns.has("frequency_minutes"))db.exec("UPDATE retrieval_schedules SET frequency_minutes=MAX(5,CAST(interval_hours AS INTEGER)*60)");
  const now=new Date().toISOString();
  db.prepare("UPDATE retrieval_schedules SET target_type='all',name='تحديث جميع مصادر الأخبار',frequency_minutes=120,timezone='Asia/Riyadh',updated_at=? WHERE target_type='news'").run(now);
  db.prepare("UPDATE retrieval_schedules SET enabled=0,last_status='disabled',last_error='social_retrieval_removed',updated_at=? WHERE target_type='social'").run(now);
  db.prepare("UPDATE retrieval_schedules SET frequency_minutes=120,timezone='Asia/Riyadh',updated_at=? WHERE target_type='all'").run(now);
  const existing=db.prepare("SELECT id FROM retrieval_schedules WHERE target_type='all' AND enabled=1 LIMIT 1").get();
  if(!existing){const legacyFrequency=scheduleColumns.has("frequency")?",frequency":"",legacyValue=scheduleColumns.has("frequency")?",?":"",legacyCreated=scheduleColumns.has("created_at")?",created_at":"",createdValue=scheduleColumns.has("created_at")?",?":"";db.prepare(`INSERT INTO retrieval_schedules (id,name,target_type,frequency_minutes${legacyFrequency},timezone,enabled,next_run_at,updated_at${legacyCreated}) VALUES (?,?,?,?${legacyValue},?,?,?,?${createdValue})`).run(...([randomUUID(),"تحديث جميع مصادر الأخبار","all",120,...(scheduleColumns.has("frequency")?["120m"]:[]),"Asia/Riyadh",1,now,now,...(scheduleColumns.has("created_at")?[now]:[])] as SqlValue[]));}
  const breakingSchedule=db.prepare("SELECT id FROM retrieval_schedules WHERE target_type='breaking' AND enabled=1 LIMIT 1").get();
  if(!breakingSchedule){const legacyFrequency=scheduleColumns.has("frequency")?",frequency":"",legacyValue=scheduleColumns.has("frequency")?",?":"",legacyCreated=scheduleColumns.has("created_at")?",created_at":"",createdValue=scheduleColumns.has("created_at")?",?":"";db.prepare(`INSERT INTO retrieval_schedules (id,name,target_type,frequency_minutes${legacyFrequency},timezone,enabled,next_run_at,updated_at${legacyCreated}) VALUES (?,?,?,?${legacyValue},?,?,?,?${createdValue})`).run(...([randomUUID(),"متابعة الأخبار العاجلة","breaking",5,...(scheduleColumns.has("frequency")?["5m"]:[]),"Asia/Riyadh",1,now,now,...(scheduleColumns.has("created_at")?[now]:[])] as SqlValue[]));}
  const recoverySchedule=db.prepare("SELECT id FROM retrieval_schedules WHERE target_type='recovery' AND enabled=1 LIMIT 1").get();
  if(!recoverySchedule){const legacyFrequency=scheduleColumns.has("frequency")?",frequency":"",legacyValue=scheduleColumns.has("frequency")?",?":"",legacyCreated=scheduleColumns.has("created_at")?",created_at":"",createdValue=scheduleColumns.has("created_at")?",?":"";db.prepare(`INSERT INTO retrieval_schedules (id,name,target_type,frequency_minutes${legacyFrequency},timezone,enabled,next_run_at,updated_at${legacyCreated}) VALUES (?,?,?,?${legacyValue},?,?,?,?${createdValue})`).run(...([randomUUID(),"استكمال تغطية آخر 7 أيام","recovery",60,...(scheduleColumns.has("frequency")?["60m"]:[]),"Asia/Riyadh",1,now,now,...(scheduleColumns.has("created_at")?[now]:[])] as SqlValue[]));}
}
migrateSourceManagementSchema();

function migrateRetrievalRunsSchema(){
  const info=db.prepare("PRAGMA table_info(retrieval_runs)").all() as Array<{name:string;notnull:number;dflt_value:unknown}>,existing=new Set(info.map((column)=>String(column.name)));
  const additions:Array<[string,string]>= [
    ["trigger","TEXT NOT NULL DEFAULT 'legacy'"],
    ["target_type","TEXT NOT NULL DEFAULT 'all'"],
    ["target_id","TEXT"],
    ["status","TEXT NOT NULL DEFAULT 'completed'"],
    ["discovered","INTEGER NOT NULL DEFAULT 0"],
    ["known","INTEGER NOT NULL DEFAULT 0"],
    ["processed","INTEGER NOT NULL DEFAULT 0"],
    ["imported","INTEGER NOT NULL DEFAULT 0"],
    ["rejected","INTEGER NOT NULL DEFAULT 0"],
    ["duplicates","INTEGER NOT NULL DEFAULT 0"],
    ["images_retrieved","INTEGER NOT NULL DEFAULT 0"],
    ["image_failures","INTEGER NOT NULL DEFAULT 0"],
    ["published","INTEGER NOT NULL DEFAULT 0"],
    ["review","INTEGER NOT NULL DEFAULT 0"],
    ["failed","INTEGER NOT NULL DEFAULT 0"],
    ["sources_processed","INTEGER NOT NULL DEFAULT 0"],
    ["archived","INTEGER NOT NULL DEFAULT 0"],
    ["error","TEXT NOT NULL DEFAULT ''"],
    ["started_at","TEXT"],
    ["finished_at","TEXT"],
    ["duration_ms","INTEGER"]
  ];
  const legacyColumns=["trigger_type","schedule_id","actor","report"];
  db.exec("BEGIN IMMEDIATE");
  try{
    if(legacyColumns.some((name)=>existing.has(name))){
      const value=(name:string,fallback:string)=>existing.has(name)?name:fallback,trigger=existing.has("trigger")?"trigger":value("trigger_type","'legacy'");
      db.exec("ALTER TABLE retrieval_runs RENAME TO retrieval_runs_legacy_migration");
      db.exec("DROP INDEX IF EXISTS idx_retrieval_runs_started");
      db.exec(`CREATE TABLE retrieval_runs (
        id TEXT PRIMARY KEY,trigger TEXT NOT NULL,target_type TEXT NOT NULL,target_id TEXT,status TEXT NOT NULL,
        discovered INTEGER NOT NULL DEFAULT 0,known INTEGER NOT NULL DEFAULT 0,processed INTEGER NOT NULL DEFAULT 0,imported INTEGER NOT NULL DEFAULT 0,rejected INTEGER NOT NULL DEFAULT 0,
        duplicates INTEGER NOT NULL DEFAULT 0,images_retrieved INTEGER NOT NULL DEFAULT 0,image_failures INTEGER NOT NULL DEFAULT 0,
        published INTEGER NOT NULL DEFAULT 0,review INTEGER NOT NULL DEFAULT 0,failed INTEGER NOT NULL DEFAULT 0,sources_processed INTEGER NOT NULL DEFAULT 0,
        archived INTEGER NOT NULL DEFAULT 0,error TEXT NOT NULL DEFAULT '',
        started_at TEXT NOT NULL,finished_at TEXT,duration_ms INTEGER
      )`);
      db.exec(`INSERT INTO retrieval_runs (id,trigger,target_type,target_id,status,discovered,known,processed,imported,rejected,duplicates,images_retrieved,image_failures,published,review,failed,sources_processed,archived,error,started_at,finished_at,duration_ms)
        SELECT id,COALESCE(${trigger},'legacy'),COALESCE(${value("target_type","'all'")},'all'),${value("target_id","NULL")},COALESCE(${value("status","'completed'")},'completed'),
        ${value("discovered","0")},${value("known","0")},${value("processed","0")},${value("imported","0")},${value("rejected","0")},${value("duplicates","0")},${value("images_retrieved","0")},${value("image_failures","0")},
        ${value("published","0")},${value("review","0")},${value("failed","0")},${value("sources_processed","0")},${value("archived","0")},COALESCE(${value("error","''")},''),COALESCE(${value("started_at","CURRENT_TIMESTAMP")},CURRENT_TIMESTAMP),
        ${value("finished_at","NULL")},${value("duration_ms","NULL")} FROM retrieval_runs_legacy_migration`);
      db.exec("DROP TABLE retrieval_runs_legacy_migration");
      db.exec("CREATE INDEX idx_retrieval_runs_started ON retrieval_runs(started_at DESC)");
    }else{
      for(const [name,definition] of additions)if(!existing.has(name))db.exec(`ALTER TABLE retrieval_runs ADD COLUMN ${name} ${definition}`);
    }
    db.exec("COMMIT");
  }catch(error){
    db.exec("ROLLBACK");
    throw error;
  }
}
migrateRetrievalRunsSchema();
function migrateRetrievalLocksSchema(){
  const columns=new Set((db.prepare("PRAGMA table_info(retrieval_locks)").all() as Array<{name:string}>).map((column)=>String(column.name)));
  if(columns.has("source_id")&&!columns.has("acquired_at"))return;
  db.exec("BEGIN IMMEDIATE");
  try{
    db.exec("ALTER TABLE retrieval_locks RENAME TO retrieval_locks_legacy_migration");
    db.exec("CREATE TABLE retrieval_locks (source_id TEXT PRIMARY KEY,run_id TEXT NOT NULL,expires_at TEXT NOT NULL)");
    const key=columns.has("source_id")?"source_id":"lock_key";
    db.exec(`INSERT OR IGNORE INTO retrieval_locks (source_id,run_id,expires_at) SELECT ${key},run_id,expires_at FROM retrieval_locks_legacy_migration WHERE expires_at>CURRENT_TIMESTAMP`);
    db.exec("DROP TABLE retrieval_locks_legacy_migration");
    db.exec("COMMIT");
  }catch(error){db.exec("ROLLBACK");throw error;}
}
migrateRetrievalLocksSchema();
// Full source recovery can legitimately run for several minutes. Only mark a run
// interrupted after its session lease would also have expired.
db.prepare("UPDATE retrieval_runs SET status='interrupted',error=CASE WHEN error='' THEN 'server_restarted_before_completion' ELSE error END,finished_at=COALESCE(finished_at,?),duration_ms=COALESCE(duration_ms,0) WHERE status='running' AND started_at<?").run(new Date().toISOString(),new Date(Date.now()-3*3600000).toISOString());

type SqlValue=string|number|bigint|Uint8Array|null;
function sqlValue(value:unknown):SqlValue{if(value===null||value===undefined)return null;if(typeof value==="number"||typeof value==="bigint"||typeof value==="string"||value instanceof Uint8Array)return value;return String(value);}
function jsonArray(value:unknown):string[]{try{const parsed=typeof value==="string"?JSON.parse(value):value;return Array.isArray(parsed)?parsed.map(String):[];}catch{return String(value||"").split(/[،,\n]+/).map((item)=>item.trim()).filter(Boolean);}}
function normalizeTitle(value:string){return value.normalize("NFKC").replace(/[\u064B-\u065F\u0670]/g,"").replace(/[^\p{L}\p{N}]+/gu," ").trim().toLocaleLowerCase("ar");}
function safeUrl(value:unknown){try{const url=new URL(String(value||""));return ["http:","https:"].includes(url.protocol)&&!["localhost","127.0.0.1","::1"].includes(url.hostname.toLowerCase())?url.toString():"";}catch{return "";}}
function digest(value:string){return createHash("sha256").update(value).digest("hex");}
function archiveStatus(date:string):ArchiveStatus{return isInActiveNewsWindow(date,DEFAULT_SETTINGS.timezone)?"current":"archived";}
function rowExists(table:string){return Boolean(db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=?").get(table));}

function migrateLegacy(){
  if(!rowExists("admin_records"))return;
  const marker=db.prepare("SELECT value FROM settings WHERE key='legacy_migration_complete'").get() as {value:string}|undefined;
  if(marker)return;
  const now=new Date().toISOString();
  const sourceRows=db.prepare("SELECT * FROM admin_records WHERE resource='sources' AND deleted=0").all() as Array<Record<string,unknown>>;
  for(const row of sourceRows){
    let data:Record<string,unknown>={};try{data=JSON.parse(String(row.data||"{}"));}catch{}
    const url=safeUrl(data.url),domain=url?new URL(url).hostname:"";
    db.prepare(`INSERT OR IGNORE INTO sources (id,name,domain,source_type,country,language,reliability_score,priority,status,health,api_endpoint,rss_endpoint,listing_url,main_categories,subcategories,keywords,excluded_keywords,retrieval_method,fallback_methods,automatic_publication_enabled,requires_editorial_review,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
      .run(String(row.id),String(row.title),domain,String(data.type||"news"),String(data.country||""),String(data.language||"ar"),Number(data.trust||80),Number(data.priority||5),String(row.status)==="نشط"?"active":"paused",String(row.status)==="نشط"?"Healthy":"Paused",String(data.apiEndpoint||""),String(data.rssUrl||data.rssEndpoint||""),url,JSON.stringify(jsonArray(data.categories||data.category)),JSON.stringify(jsonArray(data.subcategories)),JSON.stringify(jsonArray(data.keywords)),JSON.stringify(jsonArray(data.excludedKeywords)),String(data.fetchMethod||"").toLowerCase().includes("rss")?"rss":"html",JSON.stringify(["jsonld","html"]),Boolean(data.autoPublish)?1:0,Boolean(data.sensitiveReview??true)?1:0,now);
  }
  const contentRows=db.prepare("SELECT * FROM admin_records WHERE resource='content' AND deleted=0 AND status IN ('منشور','معتمد') ORDER BY created_at").all() as Array<Record<string,unknown>>;
  const insert=db.prepare(`INSERT OR IGNORE INTO articles (id,slug,title,normalized_title,summary,content,main_category,subcategory,source_id,source_name,source_url,canonical_url,source_article_id,rss_guid,author,region,source_published_at,source_updated_at,retrieved_at,image_original_url,image_local_url,image_thumbnail_url,image_alt,image_width,image_height,image_status,publication_status,archive_status,validation_status,category_confidence,content_hash,event_fingerprint,badge,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);
  for(const row of contentRows){
    let data:Record<string,unknown>={};try{data=JSON.parse(String(row.data||"{}"));}catch{}
    const title=String(row.title||"").trim(),summary=String(data.summary||"").trim(),canonical=safeUrl(data.originalUrl||data.sourceUrl);
    const details=Array.isArray(data.details)?data.details.map(String):String(data.details||"").split(/\n{2,}/).map((item)=>item.trim()).filter(Boolean);
    const combined=[summary,...details].join(" "),publishedRaw=String(data.originalPublishedAt||data.sourcePublishedAt||data.ingestedAt||row.created_at||"");
    const published=new Date(publishedRaw),normalized=normalizeTitle(title),invalidPage=/(من نحن|عن الموقع|برنامج|خدماتنا|سياسة الخصوصية|اتصل بنا)/u.test(title);
    if(!title||!summary||combined.length<90||!canonical||Number.isNaN(published.getTime())||invalidPage){
      db.prepare("INSERT INTO repair_log (id,article_id,issue,action,details,created_at) VALUES (?,?,?,?,?,?)").run(randomUUID(),String(row.id),"invalid_legacy_item","excluded",JSON.stringify({title}),now);continue;
    }
    const sourceName=String(data.source||"مصدر معتمد"),sourceId=sourceRows.find((source)=>String(source.title)===sourceName)?.id;
    const categoryParts=String(data.category||"عام").split(/[،,]/).map((item)=>item.trim());
    const image=String(data.imageUrl||""),imageValid=Boolean(safeUrl(image));
    const contentHash=digest(`${normalized}|${combined}`),eventFingerprint=digest(`${normalized}|${categoryParts[0]}|${published.toISOString().slice(0,10)}`);
    insert.run(String(row.id),`imported-${String(row.id)}`,title,normalized,summary,JSON.stringify(details),categoryParts[0]||"عام",String(data.subcategory||categoryParts[1]||""),sourceId?String(sourceId):null,sourceName,canonical,canonical,String(data.sourceArticleId||""),String(data.rssGuid||""),String(data.author||""),String(data.region||""),published.toISOString(),data.originalModifiedAt?new Date(String(data.originalModifiedAt)).toISOString():null,String(data.ingestedAt||row.created_at||now),imageValid?image:"",imageValid?`/api/media/${row.id}`:"",imageValid?`/api/media/${row.id}?variant=thumbnail`:`/api/media/fallback/${encodeURIComponent(categoryParts[0]||"عام")}`,String(data.imageAlt||title),Number(data.imageWidth)||null,Number(data.imageHeight)||null,imageValid?"valid":"fallback","published",archiveStatus(published.toISOString()),"valid",Number(data.categoryConfidence||90),contentHash,eventFingerprint,data.breaking===true?"عاجل":data.updatedBadge===true?"محدّث":null,String(row.created_at||now),String(row.updated_at||now));
  }
  db.prepare("INSERT OR REPLACE INTO settings (key,value,updated_at) VALUES ('legacy_migration_complete','true',?)").run(now);
}

function repairExistingData(){
  const marker=db.prepare("SELECT value FROM settings WHERE key='repair_v1_complete'").get() as {value:string}|undefined;
  if(marker)return;
  const now=new Date().toISOString(),rows=db.prepare("SELECT * FROM articles ORDER BY source_published_at,id").all() as Record<string,unknown>[],seenTitles=new Map<string,string>(),seenEvents=new Map<string,string>();
  const record=(articleId:string,issue:string,action:string,details:Record<string,unknown>={})=>db.prepare("INSERT INTO repair_log (id,article_id,issue,action,details,created_at) VALUES (?,?,?,?,?,?)").run(randomUUID(),articleId,issue,action,JSON.stringify(details),now);
  for(const row of rows){
    const id=String(row.id),title=String(row.title),summary=String(row.summary),sourceUrl=safeUrl(row.source_url),published=Date.parse(String(row.source_published_at)),content=jsonArray(row.content);
    const cleaned=content.filter((paragraph,index,all)=>paragraph.length>35&&!isNearText(paragraph,summary)&&all.findIndex((candidate)=>isNearText(candidate,paragraph))===index);
    if(cleaned.length!==content.length){db.prepare("UPDATE articles SET content=?,updated_at=? WHERE id=?").run(JSON.stringify(cleaned),now,id);record(id,"repeated_content","cleaned",{removed:content.length-cleaned.length});}
    if(!title||!summary||summary.length<35||!sourceUrl||!Number.isFinite(published)){db.prepare("UPDATE articles SET publication_status='review',validation_status='invalid',updated_at=? WHERE id=?").run(now,id);record(id,"incomplete_or_invalid","sent_to_review");continue;}
    const normalized=String(row.normalized_title||normalizeTitle(title)),event=String(row.event_fingerprint||"");
    const duplicateOf=seenTitles.get(normalized)||seenEvents.get(event);
    if(duplicateOf){db.prepare("UPDATE articles SET publication_status='rejected',validation_status='duplicate',updated_at=? WHERE id=?").run(now,id);record(id,"duplicate_or_near_duplicate","merged",{primaryId:duplicateOf});continue;}
    seenTitles.set(normalized,id);if(event)seenEvents.set(event,id);
    const status=archiveStatus(new Date(published).toISOString());
    if(status!==row.archive_status){db.prepare("UPDATE articles SET archive_status=?,updated_at=? WHERE id=?").run(status,now,id);record(id,"incorrect_age","lifecycle_corrected",{status});}
    if(!row.image_thumbnail_url){const fallback=`/api/media/fallback/${encodeURIComponent(String(row.main_category||"عام"))}`;db.prepare("UPDATE articles SET image_thumbnail_url=?,image_status='fallback',updated_at=? WHERE id=?").run(fallback,now,id);record(id,"missing_image","category_fallback_applied");}
  }
  db.prepare("INSERT OR REPLACE INTO settings (key,value,updated_at) VALUES ('repair_v1_complete','true',?)").run(now);
}
function rejectPublishedNonArticles(){
  const now=new Date().toISOString(),rows=db.prepare("SELECT id,title,canonical_url,content,publication_status FROM articles WHERE publication_status IN ('published','review')").all() as Array<Record<string,unknown>>;
  const update=db.prepare("UPDATE articles SET publication_status='rejected',validation_status='invalid',updated_at=? WHERE id=?");
  const log=db.prepare("INSERT INTO repair_log (id,article_id,issue,action,details,created_at) VALUES (?,?,?,?,?,?)");
  db.exec("BEGIN IMMEDIATE");
  try{
    for(const row of rows){
      const title=String(row.title||""),url=String(row.canonical_url||""),content=jsonArray(row.content),contentLength=content.join(" ").trim().length;
      const reason=isNonNewsTitle(title)||isNonNewsUrl(url)?"institutional_or_landing_page":contentLength<100?"missing_substantive_content":"";
      if(!reason)continue;
      update.run(now,String(row.id));
      log.run(randomUUID(),String(row.id),reason,"rejected",JSON.stringify({title,previousStatus:String(row.publication_status),contentLength}),now);
    }
    db.exec("COMMIT");
  }catch(error){db.exec("ROLLBACK");throw error;}
}
function repairWeakPublishedSummaries(){
  const marker=db.prepare("SELECT value FROM settings WHERE key='repair_v2_summary_quality_complete'").get() as {value:string}|undefined;
  if(marker)return;
  const now=new Date().toISOString(),rows=db.prepare("SELECT id,title,summary,content FROM articles WHERE publication_status='published'").all() as Array<Record<string,unknown>>;
  const update=db.prepare("UPDATE articles SET summary=?,content=?,updated_at=? WHERE id=?"),review=db.prepare("UPDATE articles SET publication_status='review',validation_status='invalid',updated_at=? WHERE id=?"),log=db.prepare("INSERT INTO repair_log (id,article_id,issue,action,details,created_at) VALUES (?,?,?,?,?,?)");
  db.exec("BEGIN IMMEDIATE");
  try{
    for(const row of rows){
      const id=String(row.id),title=String(row.title),summary=String(row.summary),quality=summaryQuality(summary,title);
      if(quality.valid)continue;
      const regenerated=summarizeArticle(title,jsonArray(row.content));
      if(regenerated.summary&&regenerated.content.join(" ").length>=100){
        update.run(regenerated.summary,JSON.stringify(regenerated.content),now,id);
        log.run(randomUUID(),id,"weak_summary","regenerated",JSON.stringify({previousReasons:quality.reasons}),now);
      }else{
        review.run(now,id);
        log.run(randomUUID(),id,"weak_summary","sent_to_review",JSON.stringify({previousReasons:quality.reasons,newReasons:regenerated.quality.reasons}),now);
      }
    }
    db.prepare("INSERT OR REPLACE INTO settings (key,value,updated_at) VALUES ('repair_v2_summary_quality_complete','true',?)").run(now);
    db.exec("COMMIT");
  }catch(error){db.exec("ROLLBACK");throw error;}
}
function isNearText(first:string,second:string){const a=new Set(normalizeTitle(first).split(" ")),b=new Set(normalizeTitle(second).split(" "));if(!a.size||!b.size)return false;let matches=0;for(const value of a)if(b.has(value))matches++;return matches/Math.max(a.size,b.size)>.82;}
function nearTextScore(first:string,second:string){const a=new Set(normalizeTitle(first).split(" ").filter(Boolean)),b=new Set(normalizeTitle(second).split(" ").filter(Boolean));if(!a.size||!b.size)return 0;let matches=0;for(const value of a)if(b.has(value))matches++;return matches/Math.max(a.size,b.size);}

const settingsRow=db.prepare("SELECT value FROM settings WHERE key='site'").get() as {value:string}|undefined;
if(!settingsRow)db.prepare("INSERT INTO settings (key,value,updated_at) VALUES ('site',?,?)").run(JSON.stringify(DEFAULT_SETTINGS),new Date().toISOString());
db.exec(`UPDATE articles SET main_category='المجتمع' WHERE main_category IN ('المرأة','الأسرة','أسلوب حياة');
  UPDATE articles SET image_alt=title WHERE image_alt IN ('','undefined','null') OR image_alt IS NULL;
  UPDATE articles SET image_original_url='',image_local_url='',image_thumbnail_url='/api/media/fallback/'||main_category,image_status='fallback'
  WHERE lower(image_original_url) LIKE '%no-image%' OR lower(image_original_url) LIKE '%placeholder%';
  UPDATE sources SET domain='tvtc.gov.sa',listing_url='https://tvtc.gov.sa/ar/MediaCenter/News/Pages/default.aspx' WHERE domain='www.tvtc.gov.sa';
  UPDATE sources SET listing_url='https://www.mewa.gov.sa/ar/MediaCenter/Pages/Media.aspx' WHERE domain='www.mewa.gov.sa';
  UPDATE sources SET listing_url='https://www.ncm.gov.sa/ar' WHERE domain='ncm.gov.sa';
  UPDATE sources SET listing_url='https://mc.gov.sa/ar/mediacenter/news/pages/default.aspx?pageindex=1' WHERE domain='mc.gov.sa';
  UPDATE sources SET listing_url='https://www.spa.gov.sa/news/' WHERE domain='www.spa.gov.sa';`);
migrateLegacy();
repairExistingData();
rejectPublishedNonArticles();
repairWeakPublishedSummaries();

function repairPoliticalPublishingBacklog(){
  const now=new Date().toISOString(),cutoff=new Date(Date.now()-30*86400000).toISOString();
  db.prepare(`UPDATE articles SET main_category='الاقتصاد',updated_at=? WHERE main_category='السياسة' AND publication_status='review' AND (title LIKE '%ذهب%' OR title LIKE '%تضخم%' OR title LIKE '%رسوم جمركية%' OR title LIKE '%أسواق%' OR title LIKE '%أسهم%')`).run(now);
  db.prepare(`UPDATE articles SET main_category='البيئة والمناخ',updated_at=? WHERE main_category='السياسة' AND publication_status='review' AND title LIKE '%حريق%'`).run(now);
  db.prepare(`UPDATE articles SET main_category='السفر',updated_at=? WHERE main_category='السياسة' AND publication_status='review' AND (title LIKE '%سياحة%' OR title LIKE '%سياحي%')`).run(now);
  db.prepare(`UPDATE articles SET main_category='الطاقة والصناعة',updated_at=? WHERE main_category='السياسة' AND publication_status='review' AND title LIKE '%النفط%'`).run(now);
  const result=db.prepare(`UPDATE articles SET publication_status='published',updated_at=?
    WHERE publication_status='review' AND validation_status='valid' AND main_category='السياسة'
    AND source_published_at>=? AND image_status='valid' AND category_confidence>=75
    AND source_id IN (SELECT id FROM sources WHERE reliability_score>=85 AND status='active' AND domain NOT IN ('example.com','news.google.com'))`).run(now,cutoff);
  void result;
}
repairPoliticalPublishingBacklog();

function articleFromRow(row:Record<string,unknown>):Article{
  const rawContent=jsonArray(row.content);
  const cleanContent=rawContent.filter((p)=>!isSourceBoilerplate(p));
  const cleanSummary=cleanSummaryText(String(row.summary));
  return {
  id:String(row.id),slug:String(row.slug),title:String(row.title),summary:cleanSummary,content:cleanContent,
  category:String(row.main_category),subcategory:String(row.subcategory||""),sourceName:String(row.source_name),sourceUrl:String(row.source_url),
  canonicalUrl:String(row.canonical_url),author:String(row.author||""),region:String(row.region||""),
  sourcePublishedAt:String(row.source_published_at),sourceUpdatedAt:row.source_updated_at?String(row.source_updated_at):null,retrievedAt:String(row.retrieved_at),
  imageUrl:String(row.image_thumbnail_url||row.image_local_url||""),imageOriginalUrl:String(row.image_original_url||""),imageAlt:String(row.image_alt||row.title),imageCaption:String(row.image_caption||""),imageCredit:String(row.image_credit||""),
  imageWidth:row.image_width==null?null:Number(row.image_width),imageHeight:row.image_height==null?null:Number(row.image_height),
  imageStatus:String(row.image_status),publicationStatus:String(row.publication_status) as Article["publicationStatus"],
  archiveStatus:String(row.archive_status) as Article["archiveStatus"],badge:row.badge==="عاجل"&&(!row.breaking_expires_at||Date.parse(String(row.breaking_expires_at))<=Date.now())?null:row.badge?String(row.badge):null,updatedAt:String(row.updated_at),
  geographicRelevance:String(row.geographic_relevance||"unspecified") as Article["geographicRelevance"],importanceLevel:String(row.importance_level||"عادي") as Article["importanceLevel"],priorityScore:Number(row.manual_priority_override??row.priority_score??0),manualPriorityOverride:row.manual_priority_override==null?null:Number(row.manual_priority_override),homepagePinned:Boolean(row.homepage_pinned),homepageExcluded:Boolean(row.homepage_excluded),
  isBreaking:Boolean(row.is_breaking),breakingSource:String(row.breaking_source||""),breakingDetectedBy:row.breaking_detected_by?String(row.breaking_detected_by) as Article["breakingDetectedBy"]:null,breakingVerifiedAt:row.breaking_verified_at?String(row.breaking_verified_at):null,breakingExpiresAt:row.breaking_expires_at?String(row.breaking_expires_at):null
  ,tags:jsonArray(row.tags),keyphrases:jsonArray(row.keyphrases),sourceStatus:String(row.source_status||"Active") as Article["sourceStatus"],lastSourceCheckAt:row.last_source_check_at?String(row.last_source_check_at):null,lastSourceHttpStatus:row.last_source_http_status==null?null:Number(row.last_source_http_status),sourceStatusReason:String(row.source_status_reason||"")
};}

const categoryCache=new Map<string,{expires:number;version:number;data:Article[]}>();
function cacheVersion(){return Number((db.prepare("SELECT COALESCE(MAX(version),1) version FROM cache_versions").get() as {version:number}).version||1);}
export function getSettings():SiteSettings{
  const row=db.prepare("SELECT value FROM settings WHERE key='site'").get() as {value:string}|undefined;
  try{const settings={...DEFAULT_SETTINGS,...JSON.parse(row?.value||"{}")} as SiteSettings,homepageCategories=[...settings.homepageCategories,...DEFAULT_SETTINGS.homepageCategories.filter((category)=>!settings.homepageCategories.includes(category))];return {...settings,homepageCategories,recoveryDays:Math.max(30,Number(settings.recoveryDays)||30)};}catch{return DEFAULT_SETTINGS;}
}
export function saveSettings(value:Partial<SiteSettings>){const next={...getSettings(),...value};db.prepare("INSERT OR REPLACE INTO settings (key,value,updated_at) VALUES ('site',?,?)").run(JSON.stringify(next),new Date().toISOString());invalidateCache("all");return next;}
export function listHomepageArticles(category:string,limit:number){const settings=getSettings(),window=activeNewsWindow(settings.timezone),version=cacheVersion(),key=`${category}:${limit}:${window.start}`,cached=categoryCache.get(key);if(cached&&cached.expires>Date.now()&&cached.version===version)return cached.data;const data=(db.prepare("SELECT * FROM articles WHERE publication_status='published' AND archive_status='current' AND main_category=? AND source_published_at>=? AND source_published_at<=? ORDER BY source_published_at DESC,id DESC LIMIT ?").all(category,window.start,window.end,limit) as Record<string,unknown>[]).map(articleFromRow);categoryCache.set(key,{expires:Date.now()+30000,version,data});return data;}
export function listCurrentArticles(page=1,limit=30){const window=activeNewsWindow(getSettings().timezone),total=Number((db.prepare("SELECT COUNT(*) count FROM articles WHERE publication_status='published' AND archive_status='current' AND source_published_at>=? AND source_published_at<=?").get(window.start,window.end) as {count:number}).count),data=(db.prepare("SELECT * FROM articles WHERE publication_status='published' AND archive_status='current' AND source_published_at>=? AND source_published_at<=? ORDER BY source_published_at DESC,id DESC LIMIT ? OFFSET ?").all(window.start,window.end,limit,(page-1)*limit) as Record<string,unknown>[]).map(articleFromRow);return {data,total,pages:Math.max(1,Math.ceil(total/limit)),window};}
export function listHomepagePriorityArticles(limit=5){
  const settings=getSettings(),window=activeNewsWindow(settings.timezone),rows=db.prepare(`SELECT a.*,s.reliability_score source_reliability,s.priority source_priority,s.source_type source_type,s.domain source_domain,s.country source_country,s.region source_region,
    (SELECT COUNT(*) FROM repair_log r WHERE r.article_id=a.id AND r.action='supporting_reference') supporting_sources
    FROM articles a LEFT JOIN sources s ON s.id=a.source_id
    WHERE a.publication_status='published' AND a.validation_status='valid' AND a.archive_status='current' AND a.homepage_excluded=0 AND a.source_published_at>=? AND a.source_published_at<=?
    ORDER BY a.homepage_pinned DESC,a.source_published_at DESC LIMIT 160`).all(window.start,window.end) as Record<string,unknown>[];
  const ranked=rows.map((row)=>{const article=articleFromRow(row),source={reliabilityScore:Number(row.source_reliability||70),priority:Number(row.source_priority||10),sourceType:String(row.source_type||"news"),domain:String(row.source_domain||""),country:String(row.source_country||""),region:String(row.source_region||"")},geo=article.geographicRelevance==="unspecified"?classifyGeography(article.title,article.content,source):{geographicRelevance:article.geographicRelevance,region:article.region},editorial=scoreEditorialPriority({title:article.title,body:article.content,category:article.category,publishedAt:article.sourcePublishedAt,source,geographicRelevance:geo.geographicRelevance,breaking:article.badge==="عاجل",supportingSourceCount:Number(row.supporting_sources||0),settings});return {...article,region:article.region||geo.region,geographicRelevance:geo.geographicRelevance,importanceLevel:article.manualPriorityOverride==null?editorial.importanceLevel:article.importanceLevel,priorityScore:article.manualPriorityOverride??editorial.priorityScore};});
  return balanceCategories(ranked,limit,settings.maxHomepageItemsPerCategory);
}
export type NewsCursor={sourcePublishedAt:string;id:string};
export function listHomepageMoreArticles(cursor:NewsCursor|undefined,limit=12,now=new Date()){
  const safeLimit=Math.min(Math.max(1,Math.floor(limit)),24),window=activeNewsWindow(getSettings().timezone,now),cutoff=window.start,end=window.end;
  const cursorDate=cursor&&Date.parse(cursor.sourcePublishedAt),hasCursor=Boolean(cursor&&Number.isFinite(cursorDate)&&cursor.id);
  const args:SqlValue[]=[cutoff,end];
  let cursorSql="";
  if(hasCursor){cursorSql=" AND (source_published_at<? OR (source_published_at=? AND id<?))";args.push(cursor!.sourcePublishedAt,cursor!.sourcePublishedAt,cursor!.id);}
  args.push(safeLimit+1);
  const rows=db.prepare(`SELECT * FROM articles
    WHERE publication_status='published' AND validation_status='valid'
    AND source_published_at>=? AND source_published_at<=?${cursorSql}
    ORDER BY source_published_at DESC,id DESC LIMIT ?`).all(...args) as Record<string,unknown>[];
  const hasMore=rows.length>safeLimit,data=rows.slice(0,safeLimit).map(articleFromRow),last=data.at(-1);
  return {data,hasMore,nextCursor:last?{sourcePublishedAt:last.sourcePublishedAt,id:last.id}:cursor||null};
}
export function listBreakingArticles(limit:number){
  const settings=getSettings(),window=activeNewsWindow(settings.timezone),now=new Date().toISOString();
  return (db.prepare(`SELECT a.* FROM articles a LEFT JOIN sources s ON s.id=a.source_id
    WHERE a.publication_status='published' AND a.archive_status='current'
    AND a.is_breaking=1 AND a.breaking_detected_by IS NOT NULL AND a.breaking_verified_at IS NOT NULL
    AND a.breaking_expires_at>? AND a.source_published_at<=?
    ORDER BY a.source_published_at DESC,a.priority_score DESC,COALESCE(s.reliability_score,0) DESC,COALESCE(s.priority,999),a.id DESC LIMIT ?`)
    .all(now,window.end,limit) as Record<string,unknown>[]).map(articleFromRow);
}
export function listBreakingPage(page=1,limit=20){const now=new Date().toISOString(),where="publication_status='published' AND validation_status='valid' AND is_breaking=1 AND breaking_detected_by IS NOT NULL AND breaking_verified_at IS NOT NULL AND breaking_expires_at>?",total=Number((db.prepare(`SELECT COUNT(*) count FROM articles WHERE ${where}`).get(now) as {count:number}).count),data=(db.prepare(`SELECT * FROM articles WHERE ${where} ORDER BY source_published_at DESC,priority_score DESC,id DESC LIMIT ? OFFSET ?`).all(now,limit,(page-1)*limit) as Record<string,unknown>[]).map(articleFromRow);return {data,total,pages:Math.max(1,Math.ceil(total/limit))};}
export function listCurrentCategories(){const window=activeNewsWindow(getSettings().timezone);return (db.prepare("SELECT main_category category,COUNT(*) count FROM articles WHERE publication_status='published' AND archive_status='current' AND source_published_at>=? AND source_published_at<=? GROUP BY main_category ORDER BY MAX(source_published_at) DESC").all(window.start,window.end) as Array<{category:string;count:number}>).map((row)=>({category:String(row.category),count:Number(row.count)}));}
export type CategoryStatusFilter="all"|"urgent"|"new";
export type CategoryPeriodFilter="auto"|"today"|"3d"|"7d"|"30d"|"all";
export type CategorySort="latest"|"views"|"shares";
export function listCategoryArticles(category:string,{page=1,limit=20,subcategory="",status="all",period="auto",sort="latest"}:{page?:number;limit?:number;subcategory?:string;status?:CategoryStatusFilter;period?:CategoryPeriodFilter;sort?:CategorySort}={}){
  const now=new Date(),settings=getSettings(),window=activeNewsWindow(settings.timezone,now),clauses=["publication_status='published'","validation_status='valid'","main_category=?"],args:SqlValue[]=[category];
  if(subcategory){clauses.push("subcategory=?");args.push(subcategory);}
  if(status==="urgent")clauses.push("badge='عاجل'");
  if(status==="new"){clauses.push("source_published_at>=?");args.push(new Date(now.getTime()-24*3600000).toISOString());}
  const starts={today:rollingNewsDays(settings.timezone,now)[0].start,"3d":new Date(now.getTime()-3*86400000).toISOString(),"7d":window.start,"30d":new Date(now.getTime()-30*86400000).toISOString()};
  let effectivePeriod:Exclude<CategoryPeriodFilter,"auto">=period==="auto"?"today":period;
  if(period==="auto"){
    const availableSince=(start:string)=>Number((db.prepare(`SELECT COUNT(*) count FROM articles WHERE ${clauses.join(" AND ")} AND source_published_at>=? AND source_published_at<=?`).get(...args,start,now.toISOString()) as {count:number}).count);
    effectivePeriod=availableSince(starts.today)>=settings.minimumFreshPriorityPosts?"today":availableSince(starts["7d"])>=settings.minimumFreshPriorityPosts?"7d":availableSince(starts["30d"])>0?"30d":"all";
  }
  if(effectivePeriod!=="all"){clauses.push("source_published_at>=? AND source_published_at<=?");args.push(starts[effectivePeriod],now.toISOString());}
  else{clauses.push("source_published_at<=?");args.push(now.toISOString());}
  const where=clauses.join(" AND "),order=sort==="views"?"view_count DESC,source_published_at DESC,id DESC":sort==="shares"?"share_count DESC,source_published_at DESC,id DESC":"source_published_at DESC,id DESC",total=Number((db.prepare(`SELECT COUNT(*) count FROM articles WHERE ${where}`).get(...args) as {count:number}).count);
  const data=(db.prepare(`SELECT * FROM articles WHERE ${where} ORDER BY ${order} LIMIT ? OFFSET ?`).all(...args,limit,(page-1)*limit) as Record<string,unknown>[]).map(articleFromRow).map((article)=>{
    if(period!=="auto")return article;
    const age=now.getTime()-Date.parse(article.sourcePublishedAt);
    return {...article,freshnessLabel:age>7*86400000?"من الأرشيف القريب" as const:age>48*3600000?"من الأسبوع الماضي" as const:undefined};
  });
  return {data,total,pages:Math.max(1,Math.ceil(total/limit)),freshnessWindowUsed:effectivePeriod==="today"?"48h":effectivePeriod};
}
export function listCategorySubcategories(category:string){return (db.prepare("SELECT DISTINCT subcategory FROM articles WHERE publication_status='published' AND main_category=? AND subcategory<>'' ORDER BY subcategory").all(category) as Array<{subcategory:string}>).map((row)=>row.subcategory);}
export function getArticle(slugOrId:string){const decoded=decodeURIComponent(slugOrId);const row=db.prepare("SELECT * FROM articles WHERE (slug=? OR id=? OR slug=? OR id=?) AND publication_status='published'").get(slugOrId,slugOrId,decoded,decoded) as Record<string,unknown>|undefined;return row?articleFromRow(row):null;}
export function adminArticleQueue(status:"published"|"review",limit=80){return (db.prepare("SELECT * FROM articles WHERE publication_status=? ORDER BY source_published_at DESC LIMIT ?").all(status,limit) as Record<string,unknown>[]).map(articleFromRow);}
export function setArticlePublicationStatus(id:string,status:"published"|"review"|"rejected"){
  const row=db.prepare("SELECT source_url,summary,content,validation_status,source_status FROM articles WHERE id=?").get(id) as {source_url:string;summary:string;content:string;validation_status:string;source_status:string}|undefined;
  if(!row)return {ok:false,error:"article_not_found"};
  if(status==="published"&&row.source_status==="Removed")return {ok:false,error:"source_removed_from_original"};
  if(status==="published"&&(!row.source_url||row.summary.length<35||row.content.length<100||row.validation_status!=="valid"))return {ok:false,error:"mandatory_integrity_checks_not_passed"};
  db.prepare("UPDATE articles SET publication_status=?,classification_status=CASE WHEN ?='published' THEN 'manual_approved' ELSE classification_status END,updated_at=? WHERE id=?").run(status,status,new Date().toISOString(),id);invalidateCache("all");return {ok:true};
}
export function relatedArticles(article:Article,limit=4){const tags=JSON.stringify(article.tags),rows=db.prepare(`SELECT a.*,(SELECT COUNT(*) FROM json_each(a.tags) candidate JOIN json_each(?) selected ON candidate.value=selected.value) tag_overlap FROM articles a WHERE a.publication_status='published' AND a.id<>? AND (a.main_category=? OR EXISTS (SELECT 1 FROM json_each(a.tags) candidate JOIN json_each(?) selected ON candidate.value=selected.value)) ORDER BY tag_overlap DESC,CASE WHEN a.main_category=? THEN 1 ELSE 0 END DESC,a.source_published_at DESC LIMIT ?`).all(tags,article.id,article.category,tags,article.category,limit) as Record<string,unknown>[];return rows.map(articleFromRow);}
export function searchArticles(query:string,page=1,limit=20){const term=`%${query.trim()}%`,window=activeNewsWindow(getSettings().timezone),where="publication_status='published' AND archive_status='current' AND source_published_at>=? AND source_published_at<=? AND (title LIKE ? OR summary LIKE ? OR main_category LIKE ? OR tags LIKE ? OR keyphrases LIKE ?)",args:SqlValue[]=[window.start,window.end,term,term,term,term,term],total=Number((db.prepare(`SELECT COUNT(*) count FROM articles WHERE ${where}`).get(...args) as {count:number}).count),data=(db.prepare(`SELECT * FROM articles WHERE ${where} ORDER BY source_published_at DESC,id DESC LIMIT ? OFFSET ?`).all(...args,limit,(page-1)*limit) as Record<string,unknown>[]).map(articleFromRow);return {data,total,pages:Math.max(1,Math.ceil(total/limit))};}
export function tagArticleCount(tag:string){const clean=tag.replace(/^#/,"").trim(),withHash=clean?`#${clean}`:"";return Number((db.prepare("SELECT COUNT(*) count FROM articles a WHERE a.publication_status='published' AND (EXISTS (SELECT 1 FROM json_each(a.tags) WHERE value=? OR value=? OR value=?) OR EXISTS (SELECT 1 FROM json_each(a.keyphrases) WHERE value=? OR value=?) OR a.title LIKE ?)").get(tag,clean,withHash,tag,clean,`%${clean}%`) as {count:number}).count);}
export function listTagArticles(tag:string,page=1,limit=20){const clean=tag.replace(/^#/,"").trim(),withHash=clean?`#${clean}`:"",total=tagArticleCount(tag),data=(db.prepare("SELECT a.* FROM articles a WHERE a.publication_status='published' AND (EXISTS (SELECT 1 FROM json_each(a.tags) WHERE value=? OR value=? OR value=?) OR EXISTS (SELECT 1 FROM json_each(a.keyphrases) WHERE value=? OR value=?) OR a.title LIKE ?) ORDER BY a.source_published_at DESC LIMIT ? OFFSET ?").all(tag,clean,withHash,tag,clean,`%${clean}%`,limit,(page-1)*limit) as Record<string,unknown>[]).map(articleFromRow);return {data,total,pages:Math.max(1,Math.ceil(total/limit))};}
export function listIndexableTags(minimum=3){return db.prepare("SELECT j.value tag,COUNT(*) count,MAX(a.updated_at) updated_at FROM articles a,json_each(a.tags) j WHERE a.publication_status='published' GROUP BY j.value HAVING COUNT(*)>=? ORDER BY COUNT(*) DESC").all(minimum) as Array<{tag:string;count:number;updated_at:string}>;}
export function archiveFacets(){return db.prepare("SELECT substr(source_published_at,1,4) year,substr(source_published_at,6,2) month,substr(source_published_at,9,2) day,COUNT(*) count FROM articles WHERE publication_status='published' AND archive_status='archived' GROUP BY year,month,day ORDER BY year DESC,month DESC,day DESC").all() as Array<{year:string;month:string;day:string;count:number}>;}
export type ArchivePeriodScope="all"|"year"|"day"|"week"|"month";
function archivePeriodRange(scope:ArchivePeriodScope,date:string){if(scope==="year"&&/^\d{4}$/.test(date))return [new Date(`${date}-01-01T00:00:00.000Z`).toISOString(),new Date(`${Number(date)+1}-01-01T00:00:00.000Z`).toISOString()] as const;if(scope==="day"&&/^\d{4}-\d{2}-\d{2}$/.test(date))return [new Date(`${date}T00:00:00.000Z`).toISOString(),new Date(`${date}T23:59:59.999Z`).toISOString()] as const;if(scope==="month"&&/^\d{4}-\d{2}$/.test(date)){const [year,month]=date.split("-").map(Number),start=new Date(Date.UTC(year,month-1,1)),end=new Date(Date.UTC(year,month,1));return [start.toISOString(),end.toISOString()] as const;}if(scope==="week"&&/^\d{4}-W\d{2}$/.test(date)){const [year,week]=[Number(date.slice(0,4)),Number(date.slice(6))],anchor=new Date(Date.UTC(year,0,4)),day=anchor.getUTCDay()||7,start=new Date(anchor);start.setUTCDate(anchor.getUTCDate()-day+1+(week-1)*7);const end=new Date(start);end.setUTCDate(start.getUTCDate()+7);return [start.toISOString(),end.toISOString()] as const;}return null;}
export function listArchivedArticles(page=1,limit=20,filters:{scope?:ArchivePeriodScope;date?:string}={}){const range=archivePeriodRange(filters.scope||"all",filters.date||""),where=`publication_status='published' AND archive_status='archived'${range?" AND source_published_at>=? AND source_published_at<?":""}`,args:SqlValue[]=range?[...range]:[],total=Number((db.prepare(`SELECT COUNT(*) count FROM articles WHERE ${where}`).get(...args) as {count:number}).count),data=(db.prepare(`SELECT * FROM articles WHERE ${where} ORDER BY source_published_at DESC,id DESC LIMIT ? OFFSET ?`).all(...args,limit,(page-1)*limit) as Record<string,unknown>[]).map(articleFromRow);return {data,total,pages:Math.max(1,Math.ceil(total/limit))};}
export function archiveArticles(year:string,month?:string,day?:string,filters:{category?:string;subcategory?:string;source?:string;region?:string}={}){let sql="SELECT * FROM articles WHERE publication_status='published' AND archive_status='archived' AND substr(source_published_at,1,4)=?",args:SqlValue[]=[year];if(month){sql+=" AND substr(source_published_at,6,2)=?";args.push(month.padStart(2,"0"));}if(day){sql+=" AND substr(source_published_at,9,2)=?";args.push(day.padStart(2,"0"));}for(const [column,value] of [["main_category",filters.category],["subcategory",filters.subcategory],["source_name",filters.source],["region",filters.region]] as const)if(value){sql+=` AND ${column}=?`;args.push(value);}sql+=" ORDER BY source_published_at DESC LIMIT 200";return (db.prepare(sql).all(...args) as Record<string,unknown>[]).map(articleFromRow);}

function sourceFromRow(row:Record<string,unknown>):Source{return {id:String(row.id),name:String(row.name),domain:String(row.domain),sourceType:String(row.source_type),country:String(row.country),language:String(row.language),reliabilityScore:Number(row.reliability_score),priority:Number(row.priority),status:String(row.status),health:String(row.health) as Source["health"],apiEndpoint:String(row.api_endpoint),rssEndpoint:String(row.rss_endpoint),listingUrl:String(row.listing_url),sitemapEndpoint:String(row.sitemap_endpoint||""),region:String(row.region||""),retrievalFrequencyMinutes:Number(row.retrieval_frequency_minutes||60),scheduleEnabled:Boolean(row.schedule_enabled),mainCategories:jsonArray(row.main_categories),subcategories:jsonArray(row.subcategories),keywords:jsonArray(row.keywords),excludedKeywords:jsonArray(row.excluded_keywords),retrievalMethod:String(row.retrieval_method) as Source["retrievalMethod"],fallbackMethods:jsonArray(row.fallback_methods) as Source["fallbackMethods"],lastSuccessfulFetch:row.last_successful_fetch?String(row.last_successful_fetch):null,lastSeenArticleId:String(row.last_seen_article_id),lastSeenGuid:String(row.last_seen_guid),lastSeenUrl:String(row.last_seen_url),lastSeenPublishedAt:row.last_seen_published_at?String(row.last_seen_published_at):null,lastSeenModifiedAt:row.last_seen_modified_at?String(row.last_seen_modified_at):null,etag:String(row.etag),lastModified:String(row.last_modified),automaticPublicationEnabled:Boolean(row.automatic_publication_enabled),requiresEditorialReview:Boolean(row.requires_editorial_review),consecutiveFailures:Number(row.consecutive_failures||0),lastError:String(row.last_error||""),updatedAt:String(row.updated_at||""),lastBreakingCheck:row.last_breaking_check?String(row.last_breaking_check):null,lastBreakingDetectedAt:row.last_breaking_detected_at?String(row.last_breaking_detected_at):null,lastBreakingImportedAt:row.last_breaking_imported_at?String(row.last_breaking_imported_at):null,breakingLatencySeconds:row.breaking_latency_seconds==null?null:Number(row.breaking_latency_seconds),breakingHealth:String(row.breaking_health||"Healthy") as Source["breakingHealth"]};}
export function listSources():Source[]{return (db.prepare("SELECT * FROM sources ORDER BY priority,reliability_score DESC").all() as Record<string,unknown>[]).map(sourceFromRow);}
export function getSource(id:string){return listSources().find((source)=>source.id===id)||null;}
export function updateSourceState(id:string,value:Record<string,unknown>){const allowed:Record<string,string>={health:"health",lastSuccessfulFetch:"last_successful_fetch",lastSeenArticleId:"last_seen_article_id",lastSeenGuid:"last_seen_guid",lastSeenUrl:"last_seen_url",lastSeenPublishedAt:"last_seen_published_at",lastSeenModifiedAt:"last_seen_modified_at",etag:"etag",lastModified:"last_modified",lastError:"last_error",consecutiveFailures:"consecutive_failures",lastBreakingCheck:"last_breaking_check",lastBreakingDetectedAt:"last_breaking_detected_at",lastBreakingImportedAt:"last_breaking_imported_at",breakingLatencySeconds:"breaking_latency_seconds",breakingHealth:"breaking_health"};const entries=Object.entries(value).filter(([key])=>allowed[key]);if(!entries.length)return;const values:SqlValue[]=[...entries.map(([,item])=>sqlValue(item)),new Date().toISOString(),id];db.prepare(`UPDATE sources SET ${entries.map(([key])=>`${allowed[key]}=?`).join(",")},updated_at=? WHERE id=?`).run(...values);}
const sourceFields:Record<string,{column:string,kind?:"json"|"boolean"}>={name:{column:"name"},sourceType:{column:"source_type"},country:{column:"country"},region:{column:"region"},language:{column:"language"},reliabilityScore:{column:"reliability_score"},priority:{column:"priority"},status:{column:"status"},apiEndpoint:{column:"api_endpoint"},rssEndpoint:{column:"rss_endpoint"},sitemapEndpoint:{column:"sitemap_endpoint"},listingUrl:{column:"listing_url"},mainCategories:{column:"main_categories",kind:"json"},subcategories:{column:"subcategories",kind:"json"},keywords:{column:"keywords",kind:"json"},excludedKeywords:{column:"excluded_keywords",kind:"json"},retrievalMethod:{column:"retrieval_method"},fallbackMethods:{column:"fallback_methods",kind:"json"},automaticPublicationEnabled:{column:"automatic_publication_enabled",kind:"boolean"},requiresEditorialReview:{column:"requires_editorial_review",kind:"boolean"},retrievalFrequencyMinutes:{column:"retrieval_frequency_minutes"},scheduleEnabled:{column:"schedule_enabled",kind:"boolean"}};
function sourceFieldValue(key:string,value:unknown){const kind=sourceFields[key]?.kind;return kind==="json"?JSON.stringify(Array.isArray(value)?value:[]):kind==="boolean"?(value?1:0):sqlValue(value);}
export function createSource(value:Partial<Source>){
  const listing=safeUrl(value.listingUrl||value.apiEndpoint||value.rssEndpoint||value.sitemapEndpoint);if(!value.name||!listing)throw new Error("source_name_and_valid_endpoint_required");
  const id=randomUUID(),now=new Date().toISOString(),domain=new URL(listing).hostname.replace(/^www\./,"");
  db.prepare(`INSERT INTO sources (id,name,domain,source_type,country,region,language,reliability_score,priority,status,health,api_endpoint,rss_endpoint,sitemap_endpoint,listing_url,main_categories,subcategories,keywords,excluded_keywords,retrieval_method,fallback_methods,automatic_publication_enabled,requires_editorial_review,retrieval_frequency_minutes,schedule_enabled,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(id,String(value.name),domain,String(value.sourceType||"news"),String(value.country||""),String(value.region||""),String(value.language||"ar"),Number(value.reliabilityScore||80),Number(value.priority||5),"paused","Paused",String(value.apiEndpoint||""),String(value.rssEndpoint||""),String(value.sitemapEndpoint||""),String(value.listingUrl||listing),JSON.stringify(value.mainCategories||[]),JSON.stringify(value.subcategories||[]),JSON.stringify(value.keywords||[]),JSON.stringify(value.excludedKeywords||[]),String(value.retrievalMethod||"html"),JSON.stringify(value.fallbackMethods||[]),value.automaticPublicationEnabled?1:0,value.requiresEditorialReview===false?0:1,Number(value.retrievalFrequencyMinutes||60),value.scheduleEnabled===false?0:1,now);
  return getSource(id);
}
export function updateSource(id:string,value:Partial<Source>){const entries=Object.entries(value).filter(([key])=>sourceFields[key]);if(!entries.length)return getSource(id);const sets=entries.map(([key])=>`${sourceFields[key].column}=?`),values=entries.map(([key,item])=>sourceFieldValue(key,item));if(value.listingUrl){const listing=safeUrl(value.listingUrl);if(!listing)throw new Error("invalid_listing_url");sets.push("domain=?");values.push(new URL(listing).hostname.replace(/^www\./,""));}if(value.status){sets.push("health=CASE WHEN ? IN ('paused','disabled') THEN 'Paused' WHEN health='Paused' THEN 'Healthy' ELSE health END");values.push(value.status);}values.push(new Date().toISOString(),id);db.prepare(`UPDATE sources SET ${sets.join(",")},updated_at=? WHERE id=?`).run(...values.map(sqlValue));return getSource(id);}
export function updateSourcePolicy(id:string,value:{automaticPublicationEnabled:boolean;requiresEditorialReview:boolean;status:string}){return updateSource(id,value);}
export function deleteSource(id:string){return Number(db.prepare("DELETE FROM sources WHERE id=?").run(id).changes)>0;}
export function findDuplicate(input:{canonicalUrl:string;sourceId:string;sourceArticleId:string;guid:string;normalizedTitle:string;contentHash:string;eventFingerprint:string;sourcePublishedAt:string;category:string}){
  const exact=db.prepare("SELECT id,slug,title,image_status,image_original_url,source_updated_at,content_hash,CASE WHEN canonical_url=? THEN 'canonical_url' WHEN source_id=? AND source_article_id<>'' AND source_article_id=? THEN 'source_article_id' ELSE 'rss_guid' END match_type FROM articles WHERE canonical_url=? OR (source_id=? AND source_article_id<>'' AND source_article_id=?) OR (source_id=? AND rss_guid<>'' AND rss_guid=?) LIMIT 1").get(input.canonicalUrl,input.sourceId,input.sourceArticleId,input.canonicalUrl,input.sourceId,input.sourceArticleId,input.sourceId,input.guid) as {id:string;slug:string;title:string;image_status:string;image_original_url:string;source_updated_at:string|null;content_hash:string;match_type:string}|undefined;
  if(exact)return {...exact,similarityScore:100};
  const content=db.prepare("SELECT id,slug,title,image_status,image_original_url,NULL source_updated_at,content_hash,CASE WHEN normalized_title=? THEN 'normalized_title' ELSE 'content_hash' END match_type FROM articles WHERE normalized_title=? OR content_hash=? LIMIT 1").get(input.normalizedTitle,input.normalizedTitle,input.contentHash) as {id:string;slug:string;title:string;image_status:string;image_original_url:string;source_updated_at:null;content_hash:string;match_type:string}|undefined;
  if(content)return {...content,similarityScore:content.match_type==="normalized_title"?100:98};
  const event=db.prepare("SELECT id,slug,title,image_status,image_original_url,NULL source_updated_at,content_hash,'event_similarity' match_type FROM articles WHERE event_fingerprint=? LIMIT 1").get(input.eventFingerprint) as {id:string;slug:string;title:string;image_status:string;image_original_url:string;source_updated_at:null;content_hash:string;match_type:string}|undefined;
  if(event)return {...event,similarityScore:90};
  const published=Date.parse(input.sourcePublishedAt),candidates=Number.isFinite(published)?db.prepare("SELECT id,slug,title,image_status,image_original_url,NULL source_updated_at,content_hash FROM articles WHERE main_category=? AND source_published_at BETWEEN ? AND ? ORDER BY source_published_at DESC LIMIT 80").all(input.category,new Date(published-36*3600000).toISOString(),new Date(published+36*3600000).toISOString()) as Array<{id:string;slug:string;title:string;image_status:string;image_original_url:string;source_updated_at:null;content_hash:string}>:[];
  const similar=candidates.map((candidate)=>({...candidate,similarityScore:Math.round(nearTextScore(candidate.title,input.normalizedTitle)*100)})).sort((a,b)=>b.similarityScore-a.similarityScore)[0];
  return similar&&similar.similarityScore>=82?{...similar,match_type:"title_similarity"}:undefined;
}
export function findKnownDiscoveredArticle(input:{sourceId:string;sourceArticleId:string;guid:string;url:string}){
  return db.prepare(`SELECT id,source_updated_at FROM articles
    WHERE canonical_url=? OR source_url=?
      OR (source_id=? AND source_article_id<>'' AND source_article_id=?)
      OR (source_id=? AND rss_guid<>'' AND rss_guid=?) LIMIT 1`)
    .get(input.url,input.url,input.sourceId,input.sourceArticleId,input.sourceId,input.guid) as {id:string;source_updated_at:string|null}|undefined;
}
export function insertArticle(input:Record<string,unknown>){
  const now=new Date().toISOString(),id=String(input.id||randomUUID()),slug=String(input.slug||`news-${id}`),columns=["id","slug","title","normalized_title","summary","content","main_category","subcategory","source_id","source_name","source_url","canonical_url","source_article_id","rss_guid","author","region","source_published_at","source_updated_at","retrieved_at","image_original_url","image_local_url","image_thumbnail_url","image_alt","image_caption","image_credit","image_width","image_height","image_status","publication_status","archive_status","validation_status","category_confidence","classification_status","classification_reason","classification_alternatives","content_hash","event_fingerprint","badge","geographic_relevance","importance_level","priority_score","manual_priority_override","homepage_pinned","homepage_excluded","is_breaking","breaking_source","breaking_detected_by","breaking_verified_at","breaking_expires_at","tags","keyphrases","created_at","updated_at"],values:SqlValue[]=[id,slug,input.title,input.normalizedTitle,input.summary,JSON.stringify(input.content||[]),input.category,input.subcategory||"",input.sourceId,input.sourceName,input.sourceUrl,input.canonicalUrl,input.sourceArticleId||"",input.guid||"",input.author||"",input.region||"",input.sourcePublishedAt,input.sourceUpdatedAt||null,input.retrievedAt||now,input.imageOriginalUrl||"",input.imageLocalUrl||"",input.imageThumbnailUrl||"",input.imageAlt||input.title,input.imageCaption||"",input.imageCredit||"",input.imageWidth||null,input.imageHeight||null,input.imageStatus||"fallback",input.publicationStatus||"review",input.archiveStatus||"current",input.validationStatus||"valid",input.categoryConfidence||0,input.classificationStatus||"classified",input.classificationReason||"",JSON.stringify(input.classificationAlternatives||[]),input.contentHash,input.eventFingerprint,input.badge||null,input.geographicRelevance||"unspecified",input.importanceLevel||"عادي",input.priorityScore||0,input.manualPriorityOverride??null,input.homepagePinned?1:0,input.homepageExcluded?1:0,input.isBreaking?1:0,input.breakingSource||"",input.breakingDetectedBy||null,input.breakingVerifiedAt||null,input.breakingExpiresAt||null,JSON.stringify(input.tags||[]),JSON.stringify(input.keyphrases||[]),now,now].map(sqlValue);
  db.prepare(`INSERT INTO articles (${columns.join(",")}) VALUES (${columns.map(()=>"?").join(",")})`).run(...values);invalidateCache("all");return slug;
}
export function updateArticleEditorial(id:string,value:{category?:string;subcategory?:string;region?:string;importanceLevel?:string;manualPriorityOverride?:number|null;homepagePinned?:boolean;homepageExcluded?:boolean}){
  const fields:Record<string,string>={category:"main_category",subcategory:"subcategory",region:"region",importanceLevel:"importance_level",manualPriorityOverride:"manual_priority_override",homepagePinned:"homepage_pinned",homepageExcluded:"homepage_excluded"},entries=Object.entries(value).filter(([key])=>fields[key]);
  if(!entries.length)return {ok:false,error:"no_editorial_fields"};
  const values=entries.map(([key,item])=>key==="homepagePinned"||key==="homepageExcluded"?(item?1:0):item),result=db.prepare(`UPDATE articles SET ${entries.map(([key])=>`${fields[key]}=?`).join(",")},updated_at=? WHERE id=?`).run(...values.map(sqlValue),new Date().toISOString(),id);invalidateCache("all");return result.changes?{ok:true}:{ok:false,error:"article_not_found"};
}
export function updateSupportingReference(articleId:string,sourceName:string,url:string){db.prepare("INSERT INTO repair_log (id,article_id,issue,action,details,created_at) VALUES (?,?,?,?,?,?)").run(randomUUID(),articleId,"event_duplicate","supporting_reference",JSON.stringify({sourceName,url}),new Date().toISOString());}
export function updateArticleBreaking(articleId:string,input:{source:string;detectedBy:string;verifiedAt:string;expiresAt:string}){db.prepare("UPDATE articles SET is_breaking=1,breaking_source=?,breaking_detected_by=?,breaking_verified_at=?,breaking_expires_at=?,badge='عاجل',importance_level='عاجل',updated_at=? WHERE id=?").run(input.source,input.detectedBy,input.verifiedAt,input.expiresAt,new Date().toISOString(),articleId);invalidateCache("all");}
export function updateMaterialArticle(articleId:string,input:{title:string;normalizedTitle:string;summary:string;content:string[];sourceUpdatedAt:string|null;retrievedAt:string;contentHash:string;eventFingerprint:string;tags:string[];keyphrases:string[]}){db.prepare("UPDATE articles SET title=?,normalized_title=?,summary=?,content=?,source_updated_at=?,retrieved_at=?,content_hash=?,event_fingerprint=?,tags=?,keyphrases=?,badge='محدّث',updated_at=? WHERE id=?").run(input.title,input.normalizedTitle,input.summary,JSON.stringify(input.content),input.sourceUpdatedAt,input.retrievedAt,input.contentHash,input.eventFingerprint,JSON.stringify(input.tags),JSON.stringify(input.keyphrases),new Date().toISOString(),articleId);invalidateCache("all");}
export function updateArticleImage(articleId:string,image:{url:string;localUrl:string;thumbnailUrl:string;width:number|null;height:number|null;status:string;alt?:string;caption?:string;credit?:string;origin?:string},alt:string){
  const now=new Date().toISOString();
  db.prepare("UPDATE articles SET image_original_url=?,image_local_url=?,image_thumbnail_url=?,image_alt=?,image_caption=?,image_credit=?,image_width=?,image_height=?,image_status=?,updated_at=? WHERE id=?")
    .run(image.url,image.localUrl,image.thumbnailUrl,image.alt||alt,image.caption||"",image.credit||"",image.width,image.height,image.status,now,articleId);
  db.prepare("INSERT INTO repair_log (id,article_id,issue,action,details,created_at) VALUES (?,?,?,?,?,?)")
    .run(randomUUID(),articleId,"missing_image","retrieved_original_image",JSON.stringify({url:image.url,width:image.width,height:image.height,origin:image.origin||"",caption:image.caption||"",credit:image.credit||""}),now);
  invalidateCache("all");
}
export function listArticlesMissingImages(limit=200,articleIds:string[]=[]){
  const ids=[...new Set(articleIds.filter(Boolean))].slice(0,200),idFilter=ids.length?` AND id IN (${ids.map(()=>"?").join(",")})`:"",publicationFilter=ids.length?"publication_status IN ('published','review')":"publication_status='published'";
  return db.prepare(`SELECT id,title,source_id,source_url FROM articles
    WHERE ${publicationFilter} AND validation_status='valid' AND image_status<>'valid' AND source_id IS NOT NULL AND source_published_at>=?${idFilter}
    ORDER BY source_published_at DESC LIMIT ?`).all(new Date(Date.now()-getSettings().recoveryDays*86400000).toISOString(),...ids,limit) as Array<{id:string;title:string;source_id:string;source_url:string}>;
}

export function acquireSourceLock(sourceId:string,runId:string,ttlMs=20*60000){const now=new Date(),expires=new Date(now.getTime()+ttlMs).toISOString();db.prepare("DELETE FROM retrieval_locks WHERE expires_at<=?").run(now.toISOString());try{db.prepare("INSERT INTO retrieval_locks (source_id,run_id,expires_at) VALUES (?,?,?)").run(sourceId,runId,expires);return true;}catch{return false;}}
export function releaseSourceLock(sourceId:string,runId:string){db.prepare("DELETE FROM retrieval_locks WHERE source_id=? AND run_id=?").run(sourceId,runId);}
export function retrievalSessionActive(){return Boolean(db.prepare("SELECT 1 active FROM retrieval_locks WHERE source_id='__retrieval_session__' AND expires_at>?").get(new Date().toISOString()));}
export function startRun(trigger:string,targetType:string,targetId=""){const id=randomUUID(),startedAt=new Date().toISOString();db.prepare("INSERT INTO retrieval_runs (id,trigger,target_type,target_id,status,started_at) VALUES (?,?,?,?,?,?)").run(id,trigger,targetType,targetId,"running",startedAt);return {id,startedAt};}
export function finishRun(id:string,metrics:Record<string,number>,error=""){const row=db.prepare("SELECT started_at FROM retrieval_runs WHERE id=?").get(id) as {started_at:string};const finished=new Date().toISOString();db.prepare("UPDATE retrieval_runs SET status=?,discovered=?,known=?,processed=?,imported=?,rejected=?,duplicates=?,images_retrieved=?,image_failures=?,published=?,review=?,failed=?,sources_processed=?,archived=?,error=?,finished_at=?,duration_ms=? WHERE id=?").run(error?"completed_with_errors":"completed",metrics.discovered||0,metrics.known||0,metrics.processed||0,metrics.imported||0,metrics.rejected||0,metrics.duplicates||0,metrics.imagesRetrieved||0,metrics.imageFailures||0,metrics.published||0,metrics.review||0,metrics.failed||0,metrics.sourcesProcessed||0,metrics.archived||0,error,finished,Date.now()-Date.parse(row.started_at),id);}
export function enqueue(runId:string,sourceId:string|null,queue:QueueName,payload:Record<string,unknown>){const now=new Date().toISOString(),id=randomUUID();db.prepare("INSERT INTO pipeline_jobs (id,run_id,source_id,queue,status,payload,attempts,available_at,started_at,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)").run(id,runId,sourceId,queue,"running",JSON.stringify(payload),1,now,now,now,now);return id;}
export function retryJob(id:string){db.prepare("UPDATE pipeline_jobs SET attempts=attempts+1,error='',updated_at=? WHERE id=?").run(new Date().toISOString(),id);}
export function claimJob(queue:QueueName){const row=db.prepare("SELECT * FROM pipeline_jobs WHERE queue=? AND status='queued' AND available_at<=? ORDER BY created_at LIMIT 1").get(queue,new Date().toISOString()) as Record<string,unknown>|undefined;if(!row)return null;db.prepare("UPDATE pipeline_jobs SET status='running',started_at=?,attempts=attempts+1,updated_at=? WHERE id=? AND status='queued'").run(new Date().toISOString(),new Date().toISOString(),String(row.id));return {...row,payload:JSON.parse(String(row.payload||"{}"))};}
export function finishJob(id:string,error=""){db.prepare("UPDATE pipeline_jobs SET status=?,error=?,finished_at=?,updated_at=? WHERE id=?").run(error?"failed":"completed",error,new Date().toISOString(),new Date().toISOString(),id);}
export function listRuns(limit=30){return db.prepare("SELECT * FROM retrieval_runs ORDER BY started_at DESC LIMIT ?").all(limit) as Record<string,unknown>[];}
export function queueStats(){return db.prepare("SELECT queue,status,COUNT(*) count FROM pipeline_jobs GROUP BY queue,status").all() as Record<string,unknown>[];}
export function monitoringSummary(){const inventory=db.prepare("SELECT publication_status,archive_status,COUNT(*) count FROM articles GROUP BY publication_status,archive_status").all(),sources=db.prepare("SELECT health,COUNT(*) count FROM sources GROUP BY health").all(),lastRun=db.prepare("SELECT * FROM retrieval_runs ORDER BY started_at DESC LIMIT 1").get();return {inventory,sources,lastRun,queues:queueStats()};}
export function logArticleRetrieval(input:{runId:string;sourceId:string;url:string;stage:string;status:string;reason?:string;duplicateId?:string;similarityScore?:number}){
  db.prepare("INSERT INTO article_retrieval_log (id,run_id,source_id,url,stage,status,reason,duplicate_id,similarity_score,created_at) VALUES (?,?,?,?,?,?,?,?,?,?)").run(randomUUID(),input.runId,input.sourceId,input.url,input.stage,input.status,input.reason||"",input.duplicateId||null,input.similarityScore??null,new Date().toISOString());
}
export function recordSourceResult(input:{runId:string;sourceId:string;status:string;method:string;articlesAvailable:number;discovered:number;known:number;processed:number;rejected:number;published:number;review:number;failed:number;latestSourceDate?:string|null;latestImportedDate?:string|null;failureReason?:string;details?:Record<string,unknown>}){
  db.prepare("INSERT INTO source_retrieval_results (id,run_id,source_id,status,method,checked_at,articles_available,discovered,known,processed,rejected,published,review,failed,latest_source_date,latest_imported_date,failure_reason,details) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)").run(randomUUID(),input.runId,input.sourceId,input.status,input.method,new Date().toISOString(),input.articlesAvailable,input.discovered,input.known,input.processed,input.rejected,input.published,input.review,input.failed,input.latestSourceDate||null,input.latestImportedDate||null,input.failureReason||"",JSON.stringify(input.details||{}));
}
export function sourceHealthRows(){return db.prepare(`SELECT s.*,
  (SELECT COUNT(*) FROM articles a WHERE a.source_id=s.id AND a.is_breaking=1 AND a.breaking_verified_at>=datetime('now','start of day')) breaking_today,
  r.checked_at,r.status retrieval_status,r.method actual_method,r.articles_available,r.discovered last_discovered,
  r.known last_known,r.processed last_processed,r.rejected last_rejected,r.published last_published,r.review last_review,
  r.failed last_failed,r.latest_source_date,r.latest_imported_date,r.failure_reason
  FROM sources s LEFT JOIN source_retrieval_results r ON r.id=(SELECT id FROM source_retrieval_results WHERE source_id=s.id ORDER BY checked_at DESC LIMIT 1)
  ORDER BY s.priority,s.reliability_score DESC`).all() as Record<string,unknown>[];}
export function recentRetrievalLogs(limit=100){return db.prepare("SELECT l.*,s.name source_name FROM article_retrieval_log l LEFT JOIN sources s ON s.id=l.source_id ORDER BY l.created_at DESC LIMIT ?").all(limit) as Record<string,unknown>[];}
export type ArticleSourceStatus="Active"|"Updated"|"Removed"|"Unavailable"|"Redirected"|"Temporarily Unreachable";
export function articlesDueForSourceCheck(limit=60,{breakingOnly=false,intervalMinutes=120}:{breakingOnly?:boolean;intervalMinutes?:number}={}){
  const cutoff=new Date(Date.now()-Math.max(1,intervalMinutes)*60000).toISOString(),breaking=breakingOnly?" AND a.is_breaking=1":" AND a.is_breaking=0";
  return db.prepare(`SELECT a.id,a.title,a.source_id,a.source_url,a.canonical_url,a.source_status,a.publication_status,a.source_previous_publication_status,
    a.source_updated_at,a.last_source_check_at,a.last_source_etag,a.last_source_modified,a.source_check_attempts,a.source_consecutive_failures,a.is_breaking,
    s.name source_name,s.domain source_domain,s.status source_record_status,s.health source_health
    FROM articles a JOIN sources s ON s.id=a.source_id
    WHERE (a.publication_status IN ('published','review') OR a.source_status='Removed') AND a.validation_status='valid'
    AND a.source_url<>'' AND s.status='active'${breaking} AND (a.last_source_check_at IS NULL OR a.last_source_check_at<=?)
    ORDER BY a.is_breaking DESC,COALESCE(a.last_source_check_at,'') ASC,a.source_published_at DESC LIMIT ?`).all(cutoff,limit) as Array<Record<string,unknown>>;
}
export function trackedArticleForRefresh(id:string){return db.prepare("SELECT id,title,source_id,source_url,source_article_id,rss_guid,source_published_at,source_status FROM articles WHERE id=?").get(id) as Record<string,unknown>|undefined;}
export function recordArticleSourceCheck(input:{articleId:string;sourceId:string;status:ArticleSourceStatus;httpStatus:number|null;reason:string;finalUrl:string;contentChanged:boolean;sourceUpdatedAt:string|null;etag:string;lastModified:string;restorePublication?:boolean}){
  const before=db.prepare("SELECT publication_status,source_status,source_previous_publication_status,source_removed_at FROM articles WHERE id=?").get(input.articleId) as {publication_status:string;source_status:string;source_previous_publication_status:string|null;source_removed_at:string|null}|undefined;if(!before)return {hidden:false,restored:false};
  const now=new Date().toISOString(),temporary=input.status==="Unavailable"||input.status==="Temporarily Unreachable",removed=input.status==="Removed",restoring=Boolean(before.source_status==="Removed"||before.source_previous_publication_status)&&!removed&&!temporary&&input.restorePublication!==false,previous=before.source_previous_publication_status||before.publication_status,nextPublication=removed?"review":restoring&&previous==="published"?"published":before.publication_status,hidden=removed&&before.publication_status==="published",restored=restoring&&nextPublication==="published";
  db.prepare(`UPDATE articles SET source_status=?,last_source_check_at=?,last_source_http_status=?,source_check_attempts=source_check_attempts+1,
    source_consecutive_failures=?,source_status_reason=?,source_redirect_url=?,source_removed_at=?,source_previous_publication_status=?,
    last_source_etag=?,last_source_modified=?,source_updated_at=COALESCE(?,source_updated_at),publication_status=?,updated_at=? WHERE id=?`)
    .run(input.status,now,input.httpStatus,temporary?Number((db.prepare("SELECT source_consecutive_failures FROM articles WHERE id=?").get(input.articleId) as {source_consecutive_failures:number}).source_consecutive_failures||0)+1:0,input.reason,input.status==="Redirected"?input.finalUrl:"",removed?now:restoring?null:before.source_removed_at,removed?(before.source_previous_publication_status||before.publication_status):restoring?null:before.source_previous_publication_status,input.etag,input.lastModified,input.sourceUpdatedAt,nextPublication,now,input.articleId);
  const attempt=Number((db.prepare("SELECT source_check_attempts FROM articles WHERE id=?").get(input.articleId) as {source_check_attempts:number}).source_check_attempts||1);
  db.prepare("INSERT INTO article_source_checks (id,article_id,source_id,checked_at,http_status,source_status,content_changed,source_updated_at,final_url,reason,attempt) VALUES (?,?,?,?,?,?,?,?,?,?,?)").run(randomUUID(),input.articleId,input.sourceId,now,input.httpStatus,input.status,input.contentChanged?1:0,input.sourceUpdatedAt,input.finalUrl,input.reason,attempt);
  if(hidden||restored||input.contentChanged)invalidateCache("all");return {hidden,restored};
}
export function recentArticleSourceChecks(limit=120){return db.prepare(`SELECT c.*,a.title,s.name source_name FROM article_source_checks c JOIN articles a ON a.id=c.article_id LEFT JOIN sources s ON s.id=c.source_id ORDER BY c.checked_at DESC LIMIT ?`).all(limit) as Record<string,unknown>[];}
export function schedulerHealth(){
  const last=lastSuccessfulFullRetrieval(),next=db.prepare("SELECT MIN(next_run_at) next_run_at FROM retrieval_schedules WHERE enabled=1 AND target_type='all'").get() as {next_run_at:string|null},lastAt=last?.finished_at?Date.parse(String(last.finished_at)):0;
  const failedSources=last?.id?Number((db.prepare("SELECT COUNT(*) count FROM source_retrieval_results WHERE run_id=? AND status<>'Healthy'").get(String(last.id)) as {count:number}).count):0;
  return {scheduler:"Running",workers:retrievalSessionActive()?"Processing":"Online",lastFullRetrieval:{...(last||{}),failed_sources:failedSources},nextRetrieval:next.next_run_at||new Date(lastAt+120*60000).toISOString(),healthy:Boolean(last&&Date.now()-lastAt<150*60000)};
}
export function lastSuccessfulFullRetrieval(){return db.prepare("SELECT * FROM retrieval_runs WHERE target_type IN ('all','recovery') AND status IN ('completed','completed_with_errors') AND sources_processed>0 AND finished_at IS NOT NULL ORDER BY finished_at DESC LIMIT 1").get() as Record<string,unknown>|undefined;}
export function retrievalFreshness(intervalMinutes=Math.max(30,Number(process.env.RETRIEVAL_INTERVAL_MINUTES)||120)){const last=lastSuccessfulFullRetrieval(),lastAt=last?.finished_at?Date.parse(String(last.finished_at)):0,nextAt=lastAt+intervalMinutes*60000;return {due:!lastAt||Date.now()>=nextAt,lastSuccessfulAt:lastAt?new Date(lastAt).toISOString():null,nextDueAt:lastAt?new Date(nextAt).toISOString():new Date().toISOString(),intervalMinutes,lastRun:last||{}};}
export function listSchedules(){return db.prepare("SELECT * FROM retrieval_schedules ORDER BY enabled DESC,next_run_at").all() as Record<string,unknown>[];}
export function saveSchedule(value:Record<string,unknown>){const id=String(value.id||randomUUID()),now=new Date().toISOString(),targetType=String(value.targetType||"all"),frequency=targetType==="all"?120:Math.max(5,Number(value.frequencyMinutes||120)),next=value.nextRunAt?new Date(String(value.nextRunAt)).toISOString():new Date(Date.now()+frequency*60000).toISOString(),columns=new Set((db.prepare("PRAGMA table_info(retrieval_schedules)").all() as Array<{name:string}>).map((column)=>column.name)),legacy=columns.has("frequency"),created=columns.has("created_at"),legacyColumn=legacy?",frequency":"",legacyPlaceholder=legacy?",?":"",createdColumn=created?",created_at":"",createdPlaceholder=created?",?":"",values:SqlValue[]=[id,String(value.name||"جدول الاسترجاع"),targetType,String(value.targetId||""),frequency,...(legacy?[`${frequency}m`]:[]),String(value.timezone||"Asia/Riyadh"),value.enabled===false?0:1,next,now,...(created?[now]:[])];db.prepare(`INSERT INTO retrieval_schedules (id,name,target_type,target_id,frequency_minutes${legacyColumn},timezone,enabled,next_run_at,updated_at${createdColumn}) VALUES (?,?,?,?,?${legacyPlaceholder},?,?,?,?${createdPlaceholder}) ON CONFLICT(id) DO UPDATE SET name=excluded.name,target_type=excluded.target_type,target_id=excluded.target_id,frequency_minutes=excluded.frequency_minutes${legacy?",frequency=excluded.frequency":""},timezone=excluded.timezone,enabled=excluded.enabled,next_run_at=excluded.next_run_at,updated_at=excluded.updated_at`).run(...values);return db.prepare("SELECT * FROM retrieval_schedules WHERE id=?").get(id);}
export function deleteSchedule(id:string){return Number(db.prepare("DELETE FROM retrieval_schedules WHERE id=?").run(id).changes)>0;}
export function dueSchedules(){return db.prepare("SELECT * FROM retrieval_schedules WHERE enabled=1 AND next_run_at<=? ORDER BY next_run_at").all(new Date().toISOString()) as Record<string,unknown>[];}
export function finishSchedule(id:string,status:string,error=""){const row=db.prepare("SELECT frequency_minutes FROM retrieval_schedules WHERE id=?").get(id) as {frequency_minutes:number}|undefined;if(!row)return;const now=new Date();db.prepare("UPDATE retrieval_schedules SET last_run_at=?,next_run_at=?,last_status=?,last_error=?,updated_at=? WHERE id=?").run(now.toISOString(),new Date(now.getTime()+row.frequency_minutes*60000).toISOString(),status,error,now.toISOString(),id);}
export function finishAllSourceSchedules(status:string,error=""){const schedules=db.prepare("SELECT id FROM retrieval_schedules WHERE enabled=1 AND target_type='all'").all() as Array<{id:string}>;for(const schedule of schedules)finishSchedule(schedule.id,status,error);}
export function adminDashboardSummary(){
  const today=new Date();today.setHours(0,0,0,0);const cutoff=today.toISOString(),count=(sql:string,...args:SqlValue[])=>Number((db.prepare(sql).get(...args) as {count:number}).count);
  return {activeSources:count("SELECT COUNT(*) count FROM sources WHERE status='active'"),healthySources:count("SELECT COUNT(*) count FROM sources WHERE status='active' AND health='Healthy'"),failingSources:count("SELECT COUNT(*) count FROM sources WHERE status='active' AND health IN ('Failing','Degraded','Misconfigured','Rate limited','RateLimited')"),retrievedToday:count("SELECT COUNT(*) count FROM articles WHERE retrieved_at>=?",cutoff),publishedToday:count("SELECT COUNT(*) count FROM articles WHERE publication_status='published' AND updated_at>=?",cutoff),awaitingReview:count("SELECT COUNT(*) count FROM articles WHERE publication_status='review'"),duplicatesToday:count("SELECT COUNT(*) count FROM article_retrieval_log WHERE status='skipped' AND reason LIKE 'duplicate_%' AND created_at>=?",cutoff),missingImages:count("SELECT COUNT(*) count FROM articles WHERE publication_status='published' AND image_status<>'valid'"),failedJobs:count("SELECT COUNT(*) count FROM pipeline_jobs WHERE status='failed'"),archivedToday:count("SELECT COUNT(*) count FROM articles WHERE archive_status='archived' AND updated_at>=?",cutoff)};
}
export function workflowSummary(){return {discovered:Number((db.prepare("SELECT COUNT(*) count FROM article_retrieval_log WHERE stage='discovery'").get() as {count:number}).count),processing:Number((db.prepare("SELECT COUNT(*) count FROM pipeline_jobs WHERE status='running'").get() as {count:number}).count),validationFailed:Number((db.prepare("SELECT COUNT(*) count FROM articles WHERE validation_status='invalid'").get() as {count:number}).count),duplicate:Number((db.prepare("SELECT COUNT(*) count FROM articles WHERE validation_status='duplicate'").get() as {count:number}).count),draft:Number((db.prepare("SELECT COUNT(*) count FROM articles WHERE publication_status='draft'").get() as {count:number}).count),pendingReview:Number((db.prepare("SELECT COUNT(*) count FROM articles WHERE publication_status='review'").get() as {count:number}).count),approved:Number((db.prepare("SELECT COUNT(*) count FROM articles WHERE publication_status='review' AND validation_status='valid'").get() as {count:number}).count),published:Number((db.prepare("SELECT COUNT(*) count FROM articles WHERE publication_status='published'").get() as {count:number}).count),scheduled:0,archived:Number((db.prepare("SELECT COUNT(*) count FROM articles WHERE archive_status='archived'").get() as {count:number}).count),failed:Number((db.prepare("SELECT COUNT(*) count FROM pipeline_jobs WHERE status='failed'").get() as {count:number}).count)};}
export type CategoryMonitoringRow={category:string;assignedSources:number;activeSources:number;lastRetrieval:string|null;latestSourceArticle:string|null;latestPublishedArticle:string|null;discovered:number;published:number;rejected:number;duplicates:number;failedSources:number;failureReasons:string[];fresh:number;visiblePostCount:number;freshnessWindowUsed:"48h"|"7d"|"30d"|"none";retrievalStatus:"Fresh"|"Needs Update"|"Using 7-Day Fallback"|"Using 30-Day Fallback"|"Source Problem"|"Needs Review";outOfSync:boolean;stale:boolean;sources:string[]};
export function categoryMonitoringRows():CategoryMonitoringRow[]{
  const settings=getSettings(),window=activeNewsWindow(settings.timezone),sources=listSources(),categories=[...new Set([...settings.homepageCategories,...sources.flatMap((source)=>source.mainCategories)])].filter(Boolean);
  const latestResults=db.prepare("SELECT r.* FROM source_retrieval_results r WHERE r.id=(SELECT r2.id FROM source_retrieval_results r2 WHERE r2.source_id=r.source_id ORDER BY r2.checked_at DESC LIMIT 1)").all() as Array<Record<string,unknown>>;
  return categories.map((category)=>{
    const assigned=sources.filter((source)=>source.mainCategories.includes(category)),active=assigned.filter((source)=>isApprovedSource(source)&&source.scheduleEnabled),sourceIds=new Set(assigned.map((source)=>source.id)),results=latestResults.filter((row)=>sourceIds.has(String(row.source_id))),latest=(key:string)=>results.map((row)=>row[key]?String(row[key]):"").filter(Boolean).sort().at(-1)||null;
    const count=(sql:string,...args:SqlValue[])=>Number((db.prepare(sql).get(...args) as {count:number}).count),latestPublished=db.prepare("SELECT MAX(source_published_at) latest FROM articles WHERE main_category=? AND publication_status='published' AND source_published_at>=? AND source_published_at<=?").get(category,window.start,window.end) as {latest:string|null},seven=count("SELECT COUNT(*) count FROM articles WHERE main_category=? AND publication_status='published' AND validation_status='valid' AND source_published_at>=? AND source_published_at<=?",category,window.start,window.end),latestSourceArticle=latest("latest_source_date"),failureRows=results.filter((row)=>String(row.status)!=="Healthy"),failureReasons=[...new Set(failureRows.map((row)=>String(row.failure_reason||row.status)).filter(Boolean))],outOfSync=Boolean(latestSourceArticle&&Date.parse(latestSourceArticle)>=Date.parse(window.start)&&(!latestPublished.latest||Date.parse(latestSourceArticle)>Date.parse(latestPublished.latest))),stale=active.length>0&&(seven<settings.minimumFreshPriorityPosts||outOfSync),freshnessWindowUsed=seven>0?"7d" as const:"none" as const,retrievalStatus=active.length===0?"Source Problem" as const:outOfSync?"Needs Update" as const:seven>=settings.minimumFreshPriorityPosts?"Fresh" as const:"Needs Review" as const;
    return {category,assignedSources:assigned.length,activeSources:active.length,lastRetrieval:latest("checked_at"),latestSourceArticle,latestPublishedArticle:latestPublished.latest,discovered:results.reduce((total,row)=>total+Number(row.discovered||0),0),published:results.reduce((total,row)=>total+Number(row.published||0),0),rejected:results.reduce((total,row)=>total+Number(row.rejected||0),0),duplicates:results.reduce((total,row)=>total+Number(row.known||0),0),failedSources:failureRows.length,failureReasons,fresh:seven,visiblePostCount:seven,freshnessWindowUsed,retrievalStatus,outOfSync,stale,sources:assigned.map((source)=>source.name)};
  });
}
export function categoryCoverage(){return categoryMonitoringRows().map(({category,activeSources,sources,fresh,stale})=>({category,sourceCount:activeSources,sources,fresh,insufficient:stale}));}
export type DailyCoverageCategory={category:string;count:number;subcategories:Record<string,number>;assignedSources:number;sourcesChecked:number;complete:boolean};
export type DailyCoverageRow={date:string;offset:number;start:string;end:string;articleCount:number;sourcesChecked:number;expectedSources:number;lastSuccessfulRetrieval:string|null;latestPublishedArticle:string|null;complete:boolean;missingCategories:string[];laggingSources:string[];categories:DailyCoverageCategory[]};
export function rollingCoverageRows(now=new Date()):DailyCoverageRow[]{
  const settings=getSettings(),days=rollingNewsDays(settings.timezone,now),sources=listSources(),active=sources.filter((source)=>isApprovedSource(source)&&source.scheduleEnabled),categories=[...new Set([...settings.homepageCategories,...active.flatMap((source)=>source.mainCategories)])].filter(Boolean),lastFull=lastSuccessfulFullRetrieval(),runStart=lastFull?.started_at?String(lastFull.started_at):new Date(0).toISOString(),latestResults=db.prepare("SELECT r.* FROM source_retrieval_results r WHERE r.id=(SELECT r2.id FROM source_retrieval_results r2 WHERE r2.source_id=r.source_id ORDER BY r2.checked_at DESC LIMIT 1)").all() as Array<Record<string,unknown>>,checkedIds=new Set(latestResults.filter((row)=>String(row.checked_at)>=runStart).map((row)=>String(row.source_id))),lagCutoff=Date.now()-Math.max(150,Number(process.env.RETRIEVAL_INTERVAL_MINUTES)||120)*60000,lagging=active.filter((source)=>!source.lastSuccessfulFetch||Date.parse(source.lastSuccessfulFetch)<lagCutoff||["Failing","Misconfigured","Rate limited"].includes(source.health));
  return days.map((day)=>{
    const rows=db.prepare(`SELECT main_category,subcategory,COUNT(*) count,MAX(source_published_at) latest
      FROM articles WHERE publication_status='published' AND validation_status='valid'
      AND source_published_at>=? AND source_published_at<? GROUP BY main_category,subcategory`).all(day.start,day.end) as Array<{main_category:string;subcategory:string;count:number;latest:string}>;
    const categoryRows=categories.map((category)=>{const assigned=active.filter((source)=>source.mainCategories.includes(category)),matching=rows.filter((row)=>String(row.main_category)===category),count=matching.reduce((total,row)=>total+Number(row.count),0),subcategories=Object.fromEntries(matching.filter((row)=>row.subcategory).map((row)=>[String(row.subcategory),Number(row.count)]));return {category,count,subcategories,assignedSources:assigned.length,sourcesChecked:assigned.filter((source)=>checkedIds.has(source.id)).length,complete:assigned.length===0||count>=1};}),missingCategories=categoryRows.filter((row)=>row.assignedSources>0&&!row.complete).map((row)=>row.category),latestPublishedArticle=rows.map((row)=>String(row.latest||"")).filter(Boolean).sort().at(-1)||null;
    return {date:day.date,offset:day.offset,start:day.start,end:day.end,articleCount:categoryRows.reduce((total,row)=>total+row.count,0),sourcesChecked:active.filter((source)=>checkedIds.has(source.id)).length,expectedSources:active.length,lastSuccessfulRetrieval:active.map((source)=>source.lastSuccessfulFetch||"").filter(Boolean).sort().at(-1)||null,latestPublishedArticle,complete:missingCategories.length===0&&active.every((source)=>checkedIds.has(source.id))&&lagging.length===0,missingCategories,laggingSources:lagging.map((source)=>source.name),categories:categoryRows};
  });
}
export function freshnessInventory(){
  const settings=getSettings(),window=activeNewsWindow(settings.timezone),fresh=Number((db.prepare("SELECT COUNT(*) count FROM articles WHERE publication_status='published' AND validation_status='valid' AND source_published_at>=? AND source_published_at<=?").get(window.start,window.end) as {count:number}).count),reserve=Number((db.prepare("SELECT COUNT(*) count FROM articles WHERE publication_status IN ('published','review') AND validation_status='valid' AND source_published_at>=? AND source_published_at<=?").get(window.start,window.end) as {count:number}).count),categories=Object.fromEntries(settings.homepageCategories.map((category)=>[category,Number((db.prepare("SELECT COUNT(*) count FROM articles WHERE publication_status='published' AND validation_status='valid' AND main_category=? AND source_published_at>=? AND source_published_at<=?").get(category,window.start,window.end) as {count:number}).count)])),coverage=categoryMonitoringRows(),days=rollingCoverageRows();
  return {fresh,reserve,categories,days:days.map(({date,articleCount,complete,missingCategories})=>({date,articleCount,complete,missingCategories})),needsRecovery:fresh<settings.minimumFreshHomepagePosts||reserve<settings.minimumValidatedReservePosts||coverage.some((row)=>row.stale)||days.some((day)=>!day.complete)};
}
function reclassifyPendingWindowPosts(){
  const settings=getSettings(),window=activeNewsWindow(settings.timezone),sources=new Map(listSources().map((source)=>[source.id,source])),rows=db.prepare(`SELECT * FROM articles WHERE publication_status='review' AND validation_status='valid' AND classification_status='needs_review' AND source_published_at>=? AND source_published_at<=?`).all(window.start,window.end) as Array<Record<string,unknown>>,update=db.prepare("UPDATE articles SET main_category=?,subcategory=?,category_confidence=?,classification_status='classified',classification_reason='',classification_alternatives=?,tags=?,keyphrases=?,updated_at=? WHERE id=?");
  let changed=0;
  for(const row of rows){const source=sources.get(String(row.source_id));if(!source)continue;const content=jsonArray(row.content),classification=classifyArticle({title:String(row.title),body:content} as never,source);if(classification.needsReview)continue;const semantic=extractSemanticTags({title:String(row.title),body:content,category:classification.category,subcategory:classification.subcategory,region:String(row.region||""),sourceName:String(row.source_name),sourceDomain:source.domain});update.run(classification.category,classification.subcategory,classification.confidence,JSON.stringify(classification.alternatives),JSON.stringify(semantic.tags),JSON.stringify(semantic.keyphrases),new Date().toISOString(),String(row.id));changed++;}
  if(changed)invalidateCache("all");return changed;
}
export function recoverEligibleReviewPosts(){
  reclassifyPendingWindowPosts();
  const settings=getSettings(),cutoff=activeNewsWindow(settings.timezone).start,now=new Date().toISOString();
  const result=db.prepare(`UPDATE articles SET publication_status='published',updated_at=?
    WHERE publication_status='review' AND validation_status='valid' AND source_status<>'Removed' AND source_previous_publication_status IS NULL AND source_published_at>=?
    AND source_id IN (SELECT id FROM sources WHERE status='active' AND health<>'Paused' AND domain NOT IN ('example.com','news.google.com'))`).run(now,cutoff);
  if(result.changes)invalidateCache("all");
  return Number(result.changes);
}
export function runArchiveLifecycle(){const window=activeNewsWindow(getSettings().timezone),now=new Date().toISOString();let changed=0;changed+=Number(db.prepare("UPDATE articles SET archive_status='archived',updated_at=? WHERE publication_status='published' AND source_published_at<? AND archive_status<>'archived'").run(now,window.start).changes);changed+=Number(db.prepare("UPDATE articles SET archive_status='current',updated_at=? WHERE publication_status='published' AND source_published_at>=? AND source_published_at<=? AND archive_status<>'current'").run(now,window.start,window.end).changes);if(changed)invalidateCache("all");return changed;}
export function invalidateCache(key:string){const now=new Date().toISOString();categoryCache.clear();db.prepare("INSERT INTO cache_versions (key,version,updated_at) VALUES (?,1,?) ON CONFLICT(key) DO UPDATE SET version=version+1,updated_at=excluded.updated_at").run(key,now);}
export function prepareHomepageSnapshot(){
  const settings=getSettings(),current=listCurrentArticles(1,40),priority=listHomepagePriorityArticles(5),categories=settings.homepageCategories.filter((category)=>!settings.hiddenCategories.includes(category));
  for(const category of categories)listHomepageArticles(category,settings.desktopCount);
  return {preparedAt:new Date().toISOString(),window:current.window,current:current.total,priority:priority.length,categories:Object.fromEntries(categories.map((category)=>[category,listHomepageArticles(category,settings.desktopCount).length]))};
}

export function refreshPublishedSemanticTags(){
  const rows=db.prepare(`SELECT a.id,a.title,a.content,a.main_category,a.subcategory,a.region,a.source_name,s.domain source_domain
    FROM articles a LEFT JOIN sources s ON s.id=a.source_id WHERE a.publication_status='published'`).all() as Array<Record<string,unknown>>;
  const update=db.prepare("UPDATE articles SET tags=?,keyphrases=?,updated_at=? WHERE id=?"),now=new Date().toISOString();
  db.exec("BEGIN IMMEDIATE");
  try{for(const row of rows){const semantic=extractSemanticTags({title:String(row.title),body:jsonArray(row.content),category:String(row.main_category),subcategory:String(row.subcategory||""),region:String(row.region||""),sourceName:String(row.source_name),sourceDomain:String(row.source_domain||"")});update.run(JSON.stringify(semantic.tags),JSON.stringify(semantic.keyphrases),now,String(row.id));}db.exec("COMMIT");}catch(error){db.exec("ROLLBACK");throw error;}
  invalidateCache("all");return rows.length;
}

export type ClassificationAuditResult={scanned:number;reassigned:number;sentToReview:number;unchanged:number;byMove:Record<string,number>};
export function auditPublishedClassifications():ClassificationAuditResult{
  const rows=db.prepare(`SELECT a.*,s.name classifier_source_name,s.domain classifier_source_domain,s.main_categories classifier_source_categories,s.subcategories classifier_subcategories,s.region classifier_source_region
    FROM articles a LEFT JOIN sources s ON s.id=a.source_id WHERE a.publication_status='published'`).all() as Array<Record<string,unknown>>;
  const result:ClassificationAuditResult={scanned:rows.length,reassigned:0,sentToReview:0,unchanged:0,byMove:{}},now=new Date().toISOString();
  const updateClassified=db.prepare("UPDATE articles SET main_category=?,subcategory=?,category_confidence=?,classification_status='classified',classification_reason='',classification_alternatives=?,tags=?,keyphrases=?,updated_at=? WHERE id=?");
  const updateReview=db.prepare("UPDATE articles SET category_confidence=?,classification_status='needs_review',classification_reason=?,classification_alternatives=?,updated_at=? WHERE id=?");
  const log=db.prepare("INSERT INTO repair_log (id,article_id,issue,action,details,created_at) VALUES (?,?,?,?,?,?)");
  db.exec("BEGIN IMMEDIATE");
  try{
    for(const row of rows){
      const oldCategory=String(row.main_category),source={name:String(row.classifier_source_name||row.source_name),domain:String(row.classifier_source_domain||""),subcategories:jsonArray(row.classifier_subcategories),mainCategories:jsonArray(row.classifier_source_categories)} as unknown as Source,content=jsonArray(row.content),classification=classifyArticle({title:String(row.title),body:content} as never,source),alternatives=JSON.stringify(classification.alternatives);
      if(classification.needsReview){
        const reason=classification.reasons.join(" | ")||"ambiguous_category";
        updateReview.run(classification.confidence,reason,alternatives,now,String(row.id));
        log.run(randomUUID(),String(row.id),"low_or_ambiguous_classification","flagged_without_unpublishing",JSON.stringify({oldCategory,candidate:classification.category,confidence:classification.confidence,score:classification.score,margin:classification.margin,alternatives:classification.alternatives}),now);
        result.sentToReview++;
        continue;
      }
      const semantic=extractSemanticTags({title:String(row.title),body:content,category:classification.category,subcategory:classification.subcategory,region:String(row.region||""),sourceName:String(row.source_name),sourceDomain:String(row.classifier_source_domain||"")});
      updateClassified.run(classification.category,classification.subcategory,classification.confidence,alternatives,JSON.stringify(semantic.tags),JSON.stringify(semantic.keyphrases),now,String(row.id));
      if(classification.category!==oldCategory){const move=`${oldCategory} -> ${classification.category}`;result.byMove[move]=(result.byMove[move]||0)+1;result.reassigned++;log.run(randomUUID(),String(row.id),"incorrect_category","classification_reassigned",JSON.stringify({from:oldCategory,to:classification.category,confidence:classification.confidence,score:classification.score,margin:classification.margin}),now);}else result.unchanged++;
    }
    db.exec("COMMIT");
  }catch(error){db.exec("ROLLBACK");throw error;}
  invalidateCache("all");
  return result;
}

function runClassificationAuditOnce(){
  const key="classification_audit_v4",marker=db.prepare("SELECT value FROM settings WHERE key=?").get(key) as {value:string}|undefined;
  if(marker)return;
  const result=auditPublishedClassifications(),now=new Date().toISOString();
  db.prepare("INSERT OR IGNORE INTO settings (key,value,updated_at) VALUES (?,?,?)").run(key,JSON.stringify(result),now);
}
runClassificationAuditOnce();
function refreshSemanticTagsOnce(){
  const key="semantic_tags_v2",marker=db.prepare("SELECT value FROM settings WHERE key=?").get(key) as {value:string}|undefined;
  if(marker)return;
  const refreshed=refreshPublishedSemanticTags(),now=new Date().toISOString();
  db.prepare("INSERT OR IGNORE INTO settings (key,value,updated_at) VALUES (?,?,?)").run(key,JSON.stringify({refreshed}),now);
}
refreshSemanticTagsOnce();

export function insertSocialPost(input:Partial<SocialPost>&{platform:"x"|"instagram";postId:string;content:string;url:string;publishedAt:string;authorUsername:string;authorName:string}){
  const now=new Date().toISOString(),id=input.id||randomUUID();
  db.prepare(`INSERT INTO social_posts (
    id,platform,post_id,author_username,author_name,author_avatar_url,author_verified,
    content,url,published_at,media_type,media_urls,thumbnail_url,
    likes_count,reposts_count,replies_count,views_count,
    engagement_score,trend_score,hashtags,language,sentiment,status,article_id,created_at,updated_at
  ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
  ON CONFLICT(platform,post_id) DO UPDATE SET
    likes_count=excluded.likes_count,reposts_count=excluded.reposts_count,replies_count=excluded.replies_count,
    views_count=excluded.views_count,engagement_score=excluded.engagement_score,trend_score=excluded.trend_score,
    updated_at=excluded.updated_at`).run(
    id,input.platform,input.postId,input.authorUsername,input.authorName,input.authorAvatarUrl||"",input.authorVerified?1:0,
    input.content,input.url,input.publishedAt,input.mediaType||"text",JSON.stringify(input.mediaUrls||[]),input.thumbnailUrl||"",
    input.likesCount||0,input.repostsCount||0,input.repliesCount||0,input.viewsCount||0,
    input.engagementScore||0,input.trendScore||0,JSON.stringify(input.hashtags||[]),input.language||"ar",input.sentiment||"neutral",
    input.status||"published",input.articleId||null,now,now
  );
  return id;
}

export function listSocialPosts(options:{platform?:"x"|"instagram"|"all";limit?:number;minTrendScore?:number}={}):SocialPost[]{
  const {platform="all",limit=30,minTrendScore=0}=options;
  const whereClauses:string[]=["status='published'"],params:unknown[]=[];
  if(platform!=="all"){whereClauses.push("platform=?");params.push(platform);}
  if(minTrendScore>0){whereClauses.push("trend_score>=?");params.push(minTrendScore);}
  params.push(limit);
  const rows=db.prepare(`SELECT * FROM social_posts WHERE ${whereClauses.join(" AND ")} ORDER BY trend_score DESC, published_at DESC LIMIT ?`).all(...params.map(sqlValue)) as Array<Record<string,unknown>>;
  return rows.map((r)=>({
    id:String(r.id),platform:r.platform as "x"|"instagram",postId:String(r.post_id),
    authorUsername:String(r.author_username),authorName:String(r.author_name),authorAvatarUrl:String(r.author_avatar_url||""),
    authorVerified:Boolean(r.author_verified),content:String(r.content),url:String(r.url),publishedAt:String(r.published_at),
    mediaType:(r.media_type||"text") as "text"|"image"|"video"|"album",mediaUrls:jsonArray(r.media_urls),thumbnailUrl:String(r.thumbnail_url||""),
    likesCount:Number(r.likes_count||0),repostsCount:Number(r.reposts_count||0),repliesCount:Number(r.replies_count||0),viewsCount:Number(r.views_count||0),
    engagementScore:Number(r.engagement_score||0),trendScore:Number(r.trend_score||0),hashtags:jsonArray(r.hashtags),
    language:String(r.language||"ar"),sentiment:(r.sentiment||"neutral") as "positive"|"negative"|"neutral",status:(r.status||"published") as "published"|"hidden"|"flagged",
    articleId:r.article_id?String(r.article_id):null,createdAt:String(r.created_at),updatedAt:String(r.updated_at)
  }));
}

export function upsertTrend(input:Partial<TrendTopic>&{topic:string;slug:string;trendScore:number}){
  const now=new Date().toISOString(),id=input.id||randomUUID();
  db.prepare(`INSERT INTO trends (
    id,topic,slug,type,platform,mention_count,source_count,
    x_engagement,ig_engagement,velocity,trend_score,summary,category,
    related_article_ids,related_social_post_ids,first_detected_at,peak_at,last_updated_at,is_active
  ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
  ON CONFLICT(slug) DO UPDATE SET
    mention_count=excluded.mention_count,source_count=excluded.source_count,
    x_engagement=excluded.x_engagement,ig_engagement=excluded.ig_engagement,
    velocity=excluded.velocity,trend_score=excluded.trend_score,
    summary=excluded.summary,last_updated_at=excluded.last_updated_at,
    is_active=excluded.is_active`).run(
    id,input.topic,input.slug,input.type||"story",input.platform||"all",
    input.mentionCount||1,input.sourceCount||1,input.xEngagement||0,input.igEngagement||0,
    input.velocity||0,input.trendScore||0,input.summary||"",input.category||"عام",
    JSON.stringify(input.relatedArticleIds||[]),JSON.stringify(input.relatedSocialPostIds||[]),
    input.firstDetectedAt||now,input.peakAt||now,now,input.isActive!==false?1:0
  );
  return id;
}

export function listTrends(options:{platform?:"all"|"news"|"x"|"instagram";limit?:number;activeOnly?:boolean}={}):TrendTopic[]{
  const {platform="all",limit=20,activeOnly=true}=options;
  const whereClauses:string[]=[],params:unknown[]=[];
  if(activeOnly)whereClauses.push("is_active=1");
  if(platform!=="all"){whereClauses.push("(platform=? OR platform='all')");params.push(platform);}
  const whereSql=whereClauses.length?`WHERE ${whereClauses.join(" AND ")}`:"";
  params.push(limit);
  const rows=db.prepare(`SELECT * FROM trends ${whereSql} ORDER BY trend_score DESC, velocity DESC LIMIT ?`).all(...params.map(sqlValue)) as Array<Record<string,unknown>>;
  return rows.map((r)=>({
    id:String(r.id),topic:String(r.topic),slug:String(r.slug),type:(r.type||"story") as "story"|"hashtag"|"keyword",
    platform:(r.platform||"all") as "all"|"news"|"x"|"instagram",mentionCount:Number(r.mention_count||1),sourceCount:Number(r.source_count||1),
    xEngagement:Number(r.x_engagement||0),igEngagement:Number(r.ig_engagement||0),velocity:Number(r.velocity||0),trendScore:Number(r.trend_score||0),
    summary:String(r.summary||""),category:String(r.category||"عام"),relatedArticleIds:jsonArray(r.related_article_ids),relatedSocialPostIds:jsonArray(r.related_social_post_ids),
    firstDetectedAt:String(r.first_detected_at),peakAt:String(r.peak_at),lastUpdatedAt:String(r.last_updated_at),isActive:Boolean(r.is_active)
  }));
}

export function saveDailyBrief(input:{date:string;title:string;summary:string;topStories:unknown[];stats?:Record<string,unknown>}){
  const id=randomUUID(),now=new Date().toISOString();
  db.prepare(`INSERT INTO daily_briefs (id,date,title,summary,top_stories,stats,published_at)
    VALUES (?,?,?,?,?,?,?)
    ON CONFLICT(date) DO UPDATE SET
      title=excluded.title,summary=excluded.summary,top_stories=excluded.top_stories,
      stats=excluded.stats,published_at=excluded.published_at`).run(id,input.date,input.title,input.summary,JSON.stringify(input.topStories),JSON.stringify(input.stats||{}),now);
  return id;
}

export function getDailyBrief(date?:string):DailyBrief|null{
  const row=(date?db.prepare("SELECT * FROM daily_briefs WHERE date=?").get(date):db.prepare("SELECT * FROM daily_briefs ORDER BY date DESC LIMIT 1").get()) as Record<string,unknown>|undefined;
  if(!row)return null;
  return {
    id:String(row.id),date:String(row.date),title:String(row.title),summary:String(row.summary),
    topStories:(row.top_stories?JSON.parse(String(row.top_stories)):[]) as DailyBrief["topStories"],
    stats:(typeof row.stats==="string"?JSON.parse(row.stats||"{}"):row.stats) as DailyBrief["stats"],
    publishedAt:String(row.published_at)
  };
}

export function listMostEngagedArticles(limit=12):Article[]{
  const rows=db.prepare(`SELECT * FROM articles WHERE publication_status='published' ORDER BY (view_count + share_count * 3) DESC, source_published_at DESC LIMIT ?`).all(limit) as Array<Record<string,unknown>>;
  return rows.map(articleFromRow);
}

export function listTrendingNewsArticles(limit=12):Article[]{
  const rows=db.prepare(`SELECT * FROM articles WHERE publication_status='published' ORDER BY priority_score DESC, source_published_at DESC LIMIT ?`).all(limit) as Array<Record<string,unknown>>;
  return rows.map(articleFromRow);
}

export const database=db;
export const helpers={normalizeTitle,digest,safeUrl,archiveStatus};

