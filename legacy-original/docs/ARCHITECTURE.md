# البنية المقترحة لمنصة المختصر

## 1. نمط النظام
- Monorepo قابل للتوسع.
- واجهة عامة Next.js.
- لوحة إدارة منفصلة أو ضمن نفس المشروع.
- API مستقلة عبر NestJS.
- PostgreSQL للبيانات الأساسية.
- Redis للتخزين المؤقت والجلسات.
- BullMQ للمهام المجدولة ومسارات الجلب والتحليل.
- Meilisearch أو OpenSearch للبحث النصي والدلالي.
- تخزين S3 للصور والملفات والصوت.
- طبقة Providers مستقلة لمزودي الأخبار والذكاء الاصطناعي.

## 2. خط معالجة الخبر
1. Collector: جلب عبر API أو RSS.
2. Normalizer: توحيد الصيغة.
3. Deduplicator: البصمة النصية والتشابه الدلالي.
4. Source Scoring: تقييم المصدر.
5. AI Enrichment: عنوان، ملخص، كلمات مفتاحية، كيانات.
6. Safety Rules: منع النشر الآلي للموضوعات الحساسة.
7. Editorial Queue: مراجعة وتحقق واعتماد.
8. Publisher: النشر والجدولة.
9. Distribution: إشعارات، نشرات، شبكات اجتماعية.
10. Analytics: قياس الأداء والتصحيحات.

## 3. وحدات الخادم
auth, users, roles, articles, categories, tags, sources, ingestion, ai,
editorial, fact-check, search, seo, media, ads, marketing, notifications,
newsletters, analytics, audit, settings, localization.

## 4. ضوابط مهمة
- لا يوجد نشر آلي كامل للسياسة أو الأمن أو الطب أو القانون أو السمعة.
- الاحتفاظ بكل نسخة من المقال.
- تسجيل كل قرار آلي أو تحريري.
- تمييز مساهمة الذكاء الاصطناعي.
- استخدام روابط المصدر وعدم نسخ النص الكامل.
