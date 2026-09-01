# نشر الموصّل على Hugging Face Spaces

جهاز مجاني بـ **١٦ جيجا رام و٢ vCPU** — يشغّل الخطوط الثلاثة بالتوازي،
ولا ينام إلا بعد ٤٨ ساعة خمول، وبلا بطاقة.

> ⚠️ Spaces مخصّصة أساساً لعروض الذكاء الاصطناعي. تشغيل خدمة تجارية عليها
> خارج الغرض المعلن، والمنصّة قد توقف الـ Space دون إنذار. ابقِ Render
> (أو بديلاً آخر) جاهزاً للرجوع إليه.

---

## الخطوة ١ — أنشئ الـ Space

1. سجّل في **huggingface.co** (بلا بطاقة).
2. اضغط صورتك أعلى اليمين → **New Space**.
3. الإعدادات:
   - **Space name**: `travelhub-connector`
   - **License**: اتركه
   - **Select the Space SDK**: **Docker** → **Blank**
   - **Space hardware**: `CPU basic · 2 vCPU · 16 GB` (المجاني)
   - **Visibility**: **Private** (مهم — لا داعي لأن يراه أحد)
4. **Create Space**.

## الخطوة ٢ — ارفع الملفين

الـ Space يفتح لك مستودعاً فارغاً. من تبويب **Files** → **Add file** →
**Create a new file**، أنشئ ملفين بنفس محتوى هذا المجلد:

| الملف | المصدر |
|---|---|
| `Dockerfile` | `connector/deploy/huggingface/Dockerfile` |
| `README.md` | `connector/deploy/huggingface/README.md` |

> `README.md` ليس تزييناً: الكتلة العلوية فيه (`sdk: docker` و `app_port: 7860`)
> هي ما يخبر Spaces كيف تبني وتنشر. بدونها لن يعمل.

## الخطوة ٣ — الأسرار

في الـ Space → **Settings** → **Variables and secrets** → **New secret**
لكل واحد من التالي (نفس قيم Render):

```
CONNECTOR_API_KEY
TTI_CARRIERS
SUPABASE_URL
SUPABASE_SERVICE_KEY
KV_REST_API_URL
KV_REST_API_TOKEN
```

وكـ **Variables** (غير سرّية):

```
TTI_PORTAL_URL      = https://emea.ttinteractive.com/newUI/index.asp
SDG_PER_USD         = 3650
HEADLESS            = true
MOCK                = 0
BROWSER_CONCURRENCY = 3
QUEUE_MAX_WAIT_SECONDS = 95
```

> `BROWSER_CONCURRENCY=3` هو الفارق الحقيقي: ١٦ جيجا تتّسع للخطوط الثلاثة
> معاً، فيصبح البحث بزمن خط واحد بدل ثلاثة — ويعمل الزحف دون أن يعطّل المستخدمين.

## الخطوة ٤ — تحقّق

بعد اكتمال البناء (~٥-١٠ دقائق أول مرة، صورة Playwright كبيرة)، افتح:

```
https://<اسم-حسابك>-travelhub-connector.hf.space/health
```

يُفترض `{"ok":true}`.

## الخطوة ٥ — اربط الموقع والجدولة

- **Vercel** → `SUDAN_CONNECTOR_URLS` = رابط الـ Space (بلا `/` في الآخر) → **Redeploy**
- **GitHub** → Settings → Secrets → Actions → عدّل `CONNECTOR_URLS` لنفس الرابط

---

## التحديث بعد أي تعديل في الكود

الـ Dockerfile يسحب من GitHub وقت البناء، فالتحديث =
**Settings → Factory rebuild** في الـ Space. لا نسخ ولا لصق.

## ملاحظات

- **الفرع**: يسحب من `main` افتراضياً. لتغييره عدّل `ARG BRANCH` في الـ Dockerfile.
- **النوم**: بعد ٤٨ ساعة خمول فقط — ووظيفة الزحف الليلية توقظه تلقائياً كل ليلة.
- **الخصوصية**: اجعل الـ Space **Private**؛ الأسرار في Secrets لا في الكود.
