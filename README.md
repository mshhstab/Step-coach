# مدرّب الستيب (step-coach)

تطبيق ويب يدرّسك للستيب يوم بيوم: درس تفاعلي، تمرين، واختبار على الدرس ثاني يوم، ومراجعة متباعدة لغلطاتك، ونقاط وأوسمة، ودرجة متوقعة تتحدث مع تقدمك.

## الملفات
- `src/worker.js` الـ API: يكلم Claude ويحفظ في D1
- `src/curriculum.js` منهج ٢٢ أسبوع (١٥٤ يوم)
- `public/index.html` واجهة التطبيق
- `schema.sql` جداول قاعدة البيانات (منفّذة مسبقاً على step-db)
- `wrangler.toml` الإعدادات

## خطوات النشر
1. أنشئ مستودع جديد في GitHub باسم `step-coach` وارفع كل الملفات بنفس الترتيب.
2. Cloudflare ← Workers & Pages ← Create ← Import a repository ← اختر `step-coach` ← Deploy.
3. بعد النشر: Settings ← Variables and Secrets، وأضف:
   - `ANTHROPIC_API_KEY` نوع Secret: مفتاحك من console.anthropic.com
   - `APP_KEY` نوع Secret: كلمة مرور تختارها لدخول التطبيق
4. افتح رابط الـ Worker، واكتب كلمة المرور، وابدأ.

## تغيير النموذج
من `wrangler.toml` غيّر `MODEL`. مثلاً `claude-haiku-4-5-20251001` أرخص بحوالي ٣ مرات.

## مهم
حط حد للصرف في console.anthropic.com ← Billing ← Spend limits.
