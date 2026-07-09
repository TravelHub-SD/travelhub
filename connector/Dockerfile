# ─────────────────────────────────────────────────────────────
# موصّل TTI — صورة Docker مُحسّنة لِـ Railway
# نعتمد صورة Playwright الرسمية (Chromium + كل اعتماديات النظام مثبّتة
# مسبقاً) بنفس إصدار الحزمة (1.61.1) لتفادي عدم تطابق المتصفح.
# ─────────────────────────────────────────────────────────────
FROM mcr.microsoft.com/playwright:v1.61.1-jammy

WORKDIR /app
ENV NODE_ENV=production

# تثبيت الاعتماديات فقط أولاً للاستفادة من طبقات الكاش.
# نتخطّى سكربتات التثبيت لأن المتصفحات موجودة أصلاً في الصورة الأساسية.
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts

# كود التطبيق
COPY src ./src

# Railway يحقن متغيّر PORT وقت التشغيل؛ هذا مجرّد افتراضي.
ENV PORT=8080
EXPOSE 8080

# مستخدم غير جذر موفّر في صورة Playwright الأساسية
USER pwuser

CMD ["node", "src/server.js"]
