# دليل إعداد التخزين السحابي الدائم (Turso LibSQL) ونشر المنصة على Netlify

يوفر هذا الدليل خطوات ربط منصة **المختصر (Almokhtasar)** بقاعدة بيانات سحابية دائمة وسريعة عبر **Turso (LibSQL)** لضمان استقرار وحفظ البيانات عند النشر على بيئات Serverless مثل **Netlify**.

---

## 1. لماذا Turso لقاعدة بيانات المنصة على Netlify؟
- **طبيعة Netlify Serverless:** دوال Netlify عديمة الحالة (Stateless / Ephemeral) ونظام الملفات فيها للقراءة فقط (Read-Only)، مما يجعل ملفات SQLite المحلية غير قادرة على استقبال تحديثات أو مقالات جديدة مستمرة أثناء التشغيل.
- **توافق 100% مع SQLite:** تعتمد Turso على محرك LibSQL المتوافق كلياً مع استعلامات وجداول SQLite المستخدمة في المختصر.
- **أداء فائق وتكرار جغرافي (Edge Replication):** استجابة فائقة السرعة للمستخدمين مع حفظ دائم لكافة المقالات والوسوم والإعدادات.
- **باقة مجانية ممتازة:** تدعم حتى 9 جيجابايت ومليار قراءة شهرياً.

---

## 2. خطوات إنشاء قاعدة بيانات Turso السحابية

### الخطوة الأولى: تثبيت أداة Turso CLI أو استخدام لوحة التحكم
يمكنك التسجيل عبر المتصفح في [Turso Console](https://turso.tech) أو تثبيت الأداة محلياً:
```bash
# تثبيت Turso CLI (إذا رغبت)
npm install -g turso
turso auth signup # أو turso auth login
```

### الخطوة الثانية: إنشاء قاعدة البيانات
```bash
turso db create almukhtasar-db
```

### الخطوة الثالثة: استيراد البيانات الحالية (Seeding)
تم تجهيز ملف SQL شامل يحتوي على كافة المقالات المعتمدة والوسوم والمصادر الحالية (`database/turso-seed.sql`):
```bash
# استيراد البيانات مباشرة عبر CLI:
turso db shell almukhtasar-db < light-version/database/turso-seed.sql
```
*أو يمكنك تشغيل السكربت التلقائي المتوفر في المشروع بمجرد توفر المفاتيح:*
```bash
node light-version/scripts/sync-to-turso.mjs
```

### الخطوة الرابعة: استخراج رابط الاتصال ومفتاح التوثيق
```bash
# للحصول على رابط قاعدة البيانات:
turso db show almukhtasar-db --url
# الناتج: libsql://almukhtasar-db-username.turso.io

# لإنشاء مفتاح التوثيق (Auth Token):
turso db tokens create almukhtasar-db
```

---

## 3. إعداد متغيرات البيئة على Netlify

في لوحة تحكم موقعك على **Netlify**:
1. توجه إلى: **Site configuration** > **Environment variables**.
2. أضف المتغيرات التالية:
   - `TURSO_DATABASE_URL`: رابط قاعدة البيانات (مثال: `libsql://almukhtasar-db-yourusername.turso.io`).
   - `TURSO_AUTH_TOKEN`: رمز التوثيق الناتج من أمر `turso db tokens create`.
   - `SITE_URL`: عنوان الموقع (مثال: `https://almukhtasar.netlify.app`).
   - `RETRIEVAL_USER_AGENT`: `AlmokhtasarLight/1.0`.

---

## 4. خطوات النشر على Netlify عبر GitHub

تم تهيئة ملف `netlify.toml` مسبقاً في المستودع:
1. في Netlify، اختر **Add new site** > **Import an existing project**.
2. اختر **GitHub**، ثم حدد المستودع الخاص: `hkudaish/almukhtasar-platform`.
3. سيتعرف Netlify تلقائياً على الإعدادات:
   - **Base directory:** `light-version`
   - **Build command:** `npm run build`
   - **Publish directory:** `light-version/.next`
4. اضغط **Deploy Site**.
