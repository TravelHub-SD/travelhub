# TravelHub — موصّل الخطوط السودانية (بوابة TTI)

خدمة مستقلة تجلب رحلات **بدر / تاركو / سودانير** من بوابة
[TTI](https://emea.ttinteractive.com) عبر **أتمتة متصفح (Playwright)**،
وترجّعها بشكل متوافق مع موقع TravelHub. تُنشر بشكل منفصل عن الموقع لأن
Playwright لا يعمل جيداً على Vercel serverless.

## لماذا خدمة منفصلة؟
الموقع (Next.js على Vercel) يستدعي هذه الخدمة عبر HTTP. الخدمة تشغّل متصفحاً
مخفياً، تسجّل الدخول (وتعيد استخدام الجلسة)، تبحث، تكشط النتائج، وتخبّئها مؤقتاً.

```
الموقع  ──POST /search──▶  هذه الخدمة  ──Playwright──▶  بوابة TTI
        ◀── رحلات مطبّعة ──            ◀── HTML النتائج ──
```

## التشغيل محلياً
```bash
cd connector
cp .env.example .env      # املأ القيم (خصوصاً TTI_CARRIERS)
npm install               # ينزّل Playwright + Chromium
npm start                 # أو: MOCK=1 npm start للتجربة ببيانات وهمية
# تجربة:
curl -X POST localhost:8080/search -H 'content-type: application/json' \
  -H 'x-connector-key: <CONNECTOR_API_KEY>' \
  -d '{"origin":"KRT","destination":"DXB","departureDate":"2026-08-01","adults":1}'
```

## متغيّرات البيئة (راجع `.env.example`)
| المتغيّر | الوصف |
|---|---|
| `CONNECTOR_API_KEY` | مفتاح مشترك؛ الموقع يرسله في هيدر `x-connector-key`. |
| `TTI_PORTAL_URL` | رابط البوابة. |
| `TTI_CARRIERS` | JSON: قائمة الخطوط ببيانات الدخول والأكواد. **أسرار — لا تُرفع لِـ git.** |
| `BROWSER_WS_ENDPOINT` | (اختياري) نقطة CDP لمتصفح مُستضاف؛ فارغ = متصفح محلي. |
| `SDG_PER_USD` | لو الأسعار بالجنيه، سعر الصرف للتحويل إلى دولار؛ 0 = بلا تحويل. |
| `MOCK` | `1` لإرجاع بيانات تجريبية بدل الاتصال بالبوابة. |

## النشر على Railway (موصى به)
الخدمة تُبنى عبر `Dockerfile` (صورة Playwright الرسمية — Chromium جاهز).

1. **أنشئ مشروعاً** على [railway.com](https://railway.com) ← New Project ← Deploy from GitHub repo ← اختر `travelhub-sd/travelhub`.
2. في إعدادات الخدمة ← **Settings** ← **Root Directory** = `connector`
   (ليجد Railway ملفّي `Dockerfile` و`railway.json` هنا؛ سيبني بـ Docker تلقائياً).
3. **Variables**: أضف متغيّرات البيئة (انظر الجدول أدناه). `PORT` يحقنه Railway تلقائياً — لا تضبطه.
4. **Deploy**، ثم من **Settings ← Networking ← Generate Domain** احصل على رابط عام
   مثل `https://travelhub-connector-production.up.railway.app`.
5. تحقّق: افتح `https://<domain>/health` — يجب أن يرجّع `{"ok":true,...}`.

### متغيّرات البيئة على Railway
| المتغيّر | مثال / قيمة |
|---|---|
| `CONNECTOR_API_KEY` | سلسلة عشوائية طويلة (سرّ) |
| `TTI_PORTAL_URL` | `https://emea.ttinteractive.com/newUI/index.asp` |
| `TTI_CARRIERS` | JSON بالخطوط (سرّ) — انظر `.env.example` |
| `SDG_PER_USD` | `3650` |
| `SESSION_TTL_MINUTES` | `15` |
| `CACHE_TTL_SECONDS` | `120` |
| `HEADLESS` | `true` |
| `MOCK` | `0` (اجعلها `1` مؤقتاً للتجربة بلا بوابة) |

## الخطوة الأخيرة: ربط الموقع بالموصّل (على Vercel)
بعد أن يعمل الموصّل، اربطه بموقع TravelHub:

1. في **Vercel** ← مشروع الموقع ← **Settings ← Environment Variables** أضف:
   - `SUDAN_CONNECTOR_URL` = رابط Railway (بدون `/` في النهاية).
   - `CONNECTOR_API_KEY` = نفس المفتاح المضبوط على Railway.
2. **أعِد نشر** الموقع (Redeploy) ليأخذ المتغيّرات.
3. ابحث عن رحلة داخلية (مثل `PZU → KRT`) — يجب أن تظهر رحلات بدر/تاركو/سودانير
   مدموجة مع نتائج Duffel.

## الحالة: المحدّدات مؤكّدة ✅
تم تأكيد كل الخطوات من HTML الحقيقي لبوابة Zenith:
- **الدخول** (`otds/index.asp`): `#login` / `#pwd` / `#LoginCompanyIdentificationCode` / `#signInButton`.
- **البحث** (`newUI/index.asp`, نموذج `frmbook`): قوائم `#id_depart`/`#id_arrivee`
  (اختيار بالـ IATA)، تاريخ `#DepartureDate`، إرسال `#btSubmit`.
- **النتائج**: لا كشط DOM — نقرأ كائن `TTIModel.FlightListDisplay.ServerModel`
  (Knockout) مباشرة من `iframe#mainFrame`، وفيه الأسعار والضرائب والأمتعة
  ودرجات الأسعار والأوقات وعدد المقاعد.

يتبقّى فقط: ضبط `TTI_CARRIERS` ببياناتك، النشر، ثم **اختبار حيّ واحد** بـ `MOCK=0`
للتأكد من أن التدفّق يعمل من طرف لطرف على البوابة الفعلية (البيئة السحابية هنا
تحجب الوصول للبوابة، لذا لا يمكن الاختبار الحيّ إلا على خدمتك).

## ملاحظات أمنية
- بيانات الدخول تُخزَّن كأسرار على الخدمة فقط، لا في الكود ولا في git.
- الخدمة تقوم بـ **البحث فقط** — لا حجز ولا إصدار تذاكر.
- راعِ شروط استخدام TTI بخصوص الوصول الآلي.
