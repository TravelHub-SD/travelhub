# نشر موصّل TravelHub على Oracle Cloud (مجاناً للأبد)

خادم حقيقي مجاني (Ampere ARM — حتى 4 أنوية و24GB RAM) يشغّل الموصّل ٢٤/٧ بلا نوم.
الإعداد يأخذ ~30–45 دقيقة أول مرة، لكنه يعمل بعدها بلا تكلفة.

---

## المرحلة 1 — إنشاء الخادم في Oracle Cloud

1. سجّل في **cloud.oracle.com** (يتطلب بطاقة للتحقّق فقط — **لا خصم** في خطة Always Free).
2. من القائمة: **Compute → Instances → Create Instance**.
3. الإعدادات:
   - **Image**: Ubuntu 22.04
   - **Shape**: اضغط *Change Shape* → **Ampere (ARM)** → `VM.Standard.A1.Flex` → اختر **2 OCPU و12GB RAM** (ضمن المجاني)
   - **Networking**: اترك الافتراضي (Public IP يُنشأ تلقائياً)
   - **SSH keys**: احفظ المفتاح الخاص (Private Key) — ستحتاجه للدخول
4. **Create** — انتظر حتى تصبح الحالة *Running*، وانسخ **Public IP**.

## المرحلة 2 — فتح المنفذ في شبكة Oracle

1. من صفحة الـ Instance → اضغط اسم **Subnet** → **Security Lists** → اسم القائمة الافتراضية.
2. **Add Ingress Rules**:
   - Source CIDR: `0.0.0.0/0`
   - IP Protocol: **TCP**
   - Destination Port Range: **8080**
   - **Add**.

## المرحلة 3 — الدخول للخادم وتثبيت كل شيء

من جهازك (أو Cloud Shell في Oracle):
```bash
ssh -i مفتاحك_الخاص.key ubuntu@PUBLIC_IP
```

على الخادم — استنسخ المشروع (يتطلب توكن GitHub لأن المستودع خاص):
```bash
git clone https://<GITHUB_TOKEN>@github.com/TravelHub-SD/travelhub.git
cd travelhub/connector
git checkout claude/website-display-03zyxc
```
> لإنشاء التوكن: GitHub → Settings → Developer settings → Personal access tokens → Fine-grained → صلاحية قراءة على المستودع.

شغّل سكربت الإعداد (يثبّت Docker ويفتح المنفذ داخلياً):
```bash
bash deploy/oracle-setup.sh
```
سجّل خروج ودخول مرة (لتفعيل صلاحية docker): `exit` ثم أعد `ssh`.

## المرحلة 4 — الإعدادات والتشغيل

```bash
cd travelhub/connector
cp .env.example .env
nano .env     # املأ القيم (نفس ما على Railway): CONNECTOR_API_KEY, TTI_CARRIERS, و KV_* لو تستخدم Redis
```
ثم شغّل:
```bash
docker compose up -d --build
```
انتظر البناء (~٥-١٠ دقائق أول مرة)، ثم تحقّق:
```bash
curl http://localhost:8080/health        # يُفترض {"ok":true}
```
ومن متصفحك: `http://PUBLIC_IP:8080/health`

## المرحلة 5 — ربط الموقع بالخادم الجديد

في **Vercel → Settings → Environment Variables** عدّل:
```
SUDAN_CONNECTOR_URL = http://PUBLIC_IP:8080
```
(نفس `CONNECTOR_API_KEY` الموجود). ثم **Redeploy** الموقع.

✅ جرّب بحثاً على travelhub-sd.com — الآن يعمل عبر خادمك المجاني الدائم.

---

## أوامر مفيدة (صيانة)
```bash
docker compose logs -f            # متابعة السجلّات
docker compose restart            # إعادة تشغيل
docker compose pull && docker compose up -d --build   # بعد git pull لتحديث
docker stats                      # مراقبة الذاكرة/المعالج
```

## تحديث بعد أي تعديل جديد
```bash
cd travelhub/connector && git pull && docker compose up -d --build
```

---

## ملاحظات مهمة
- **HTTP لا HTTPS**: الموقع ينادي الموصّل من الخادم (server-side) فالـ HTTP يعمل، والمفتاح يحميه. لترقية لـ HTTPS لاحقاً (نطاق فرعي + Caddy) اطلب مني.
- **الأمان**: المنفذ 8080 مفتوح للعالم لكنه محميّ بمفتاح `CONNECTOR_API_KEY` (بلا مفتاح صحيح → 401).
- **الاستمرارية**: `restart: always` يعيد التشغيل تلقائياً عند إعادة إقلاع الخادم.
- **لا تُنهِ الخادم**: أبقِه Running دائماً (مجاني).
