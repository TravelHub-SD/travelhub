# ─────────────────────────────────────────────────────────────
# موصّل TravelHub على Hugging Face Spaces (Docker)
#
# يسحب الكود من GitHub وقت البناء، فيبقى المستودع هو المصدر الوحيد:
# أي تعديل تدفعه → اضغط "Factory rebuild" في الـ Space ليصل.
#
# ملاحظات المنصّة:
#  • Spaces تشغّل الحاوية بمستخدم غير جذر (uid 1000) وتتوقّع المنفذ 7860.
#  • الأسرار تُضبط من إعدادات الـ Space (Secrets) لا داخل هذا الملف.
# ─────────────────────────────────────────────────────────────
FROM mcr.microsoft.com/playwright:v1.61.1-jammy

ENV NODE_ENV=production \
    PORT=7860 \
    HOME=/app

# الفرع الذي نسحب منه — غيّره عند الحاجة ثم أعد البناء
ARG REPO=https://github.com/TravelHub-SD/travelhub.git
ARG BRANCH=main

WORKDIR /app

# اسحب مجلد connector فقط من المستودع العام
RUN git clone --depth 1 --branch "$BRANCH" "$REPO" /tmp/src \
 && cp -r /tmp/src/connector/. /app/ \
 && rm -rf /tmp/src

RUN npm ci --omit=dev --ignore-scripts

# Spaces تشغّل بمستخدم uid 1000 — امنحه ملكية مجلد العمل
RUN chown -R 1000:1000 /app
USER 1000

EXPOSE 7860
CMD ["node", "src/server.js"]
