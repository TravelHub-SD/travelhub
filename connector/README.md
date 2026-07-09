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

## النشر (Railway / Render / VPS)
1. انشر مجلد `connector/` كخدمة Node مستقلة.
2. اضبط متغيّرات البيئة أعلاه (بما فيها `TTI_CARRIERS` كسرّ).
3. تأكد أن `postinstall` نزّل Chromium (أو أضف صورة Docker مع متصفح).
4. خذ عنوان الخدمة العام، وضعه في Vercel للموقع:
   - `SUDAN_CONNECTOR_URL=https://<your-connector-host>`
   - `CONNECTOR_API_KEY=<نفس المفتاح>`

## ⚠️ ما يزال يحتاج ضبطاً: المحدّدات (Selectors)
المحدّدات في `src/config.js` **مبدئية** لأننا لم نفحص البوابة بعد. لضبطها، شارك
لقطات/HTML لثلاث صفحات: **الدخول**، **نموذج البحث**، **جدول النتائج**. كل محدّد
موسوم بـ `TODO`. بعد ضبطها، اختبر بـ `MOCK=0`.

## ملاحظات أمنية
- بيانات الدخول تُخزَّن كأسرار على الخدمة فقط، لا في الكود ولا في git.
- الخدمة تقوم بـ **البحث فقط** — لا حجز ولا إصدار تذاكر.
- راعِ شروط استخدام TTI بخصوص الوصول الآلي.
