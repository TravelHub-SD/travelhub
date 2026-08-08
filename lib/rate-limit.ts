// محدّد معدّل طلبات بسيط في الذاكرة (لكل نسخة serverless).
// يحدّ من إساءة استخدام الـ API والفحص الآلي — دفاع طبقة أولى.

const buckets = new Map<string, { n: number; t: number }>()
const MAX_BUCKETS = 10_000

export function rateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now()
  if (buckets.size > MAX_BUCKETS) {
    // تنظيف: احذف النوافذ المنتهية
    for (const [k, b] of buckets) if (now - b.t > windowMs) buckets.delete(k)
  }
  const b = buckets.get(key)
  if (!b || now - b.t > windowMs) {
    buckets.set(key, { n: 1, t: now })
    return true
  }
  if (b.n >= limit) return false
  b.n++
  return true
}

/** عنوان العميل خلف بروكسي Vercel. */
export function clientIp(headers: Headers): string {
  return (headers.get("x-forwarded-for") || "").split(",")[0].trim() || "anon"
}

/** رد 429 موحّد. */
export const tooMany = { error: "طلبات كثيرة — حاول بعد قليل" }
