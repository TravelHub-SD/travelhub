# نشر موصّل TravelHub على Render.com (مجاناً + منع النوم)

أبسط استضافة مجانية: بلا خادم Linux، بلا SSH، بلا بطاقة إلزامية.
العيب الوحيد: الخدمة **تنام بعد ١٥ دقيقة خمول** — نحلّه بـ UptimeRobot (خطوة ٣).

---

## الخطوة 1 — أنشئ الخدمة على Render

1. سجّل في **render.com** (بحساب GitHub — بلا بطاقة).
2. **New + → Web Service** → اربط مستودع `TravelHub-SD/travelhub`.
3. الإعدادات:
   - **Root Directory**: `connector`
   - **Runtime**: Docker (يكتشفه تلقائياً)
   - **Branch**: `claude/website-display-03zyxc`
   - **Instance Type**: **Free**
   - **Region**: Frankfurt
4. **Create Web Service** (سيبدأ البناء — ~٥-١٠ دقائق).

> بديل أسرع: Render يقرأ ملف `connector/render.yaml` تلقائياً لو استخدمت **New + → Blueprint**.

## الخطوة 2 — أضف المتغيّرات السرّية

في الخدمة → **Environment** → أضف (نفس قيم Railway):
```
CONNECTOR_API_KEY   = (نفس مفتاح Vercel)
TTI_CARRIERS        = [{"name":"تاركو",...}]   (JSON كامل)
KV_REST_API_URL     = (رابط Upstash — اختياري لكن يُنصح به)
KV_REST_API_TOKEN   = (توكن Upstash)
```
احفظ → Render يعيد النشر تلقائياً.

**تحقّق:** افتح رابط الخدمة `https://travelhub-connector.onrender.com/health` → يُفترض `{"ok":true}`.
(أول فتح بعد نوم يأخذ ~٣٠-٥٠ ثانية — طبيعي.)

## الخطوة 3 — منع النوم (UptimeRobot مجاني) ⭐

1. سجّل في **uptimerobot.com** (مجاني).
2. **Add New Monitor**:
   - Type: **HTTP(s)**
   - URL: `https://travelhub-connector.onrender.com/health`
   - Monitoring Interval: **٥ دقائق**
3. احفظ.

الآن UptimeRobot يطرق الخدمة كل ٥ دقائق فلا تنام أبداً — وتحصل على تنبيه لو تعطّلت أيضاً. 🎯

## الخطوة 4 — اربط الموقع بالموصّل الجديد

في **Vercel → Settings → Environment Variables** عدّل:
```
SUDAN_CONNECTOR_URL = https://travelhub-connector.onrender.com
```
ثم **Redeploy** الموقع. جرّب بحثاً على travelhub-sd.com ✅

---

## ملاحظات صادقة
- **الذاكرة ضيّقة (512MB)**: ضبطنا متصفحاً واحداً فقط (`BROWSER_CONCURRENCY=1`). كافٍ لعشرات المستخدمين مع الكاش، لكن ليس لمئات متزامنين.
- **فعّل Redis (Upstash)**: يقلّل الحمل كثيراً — المسارات الشائعة بلا متصفح.
- **أول بحث بعد خمول طويل**: قد يكون بطيئاً لحظة الاستيقاظ — UptimeRobot يقلّل حدوثه.
- **التحديث**: أي `git push` للفرع → Render يعيد النشر تلقائياً.
