// كاش من طبقتين: L1 في الذاكرة (فوري لكل نسخة) + L2 على Redis مشترك عبر REST.
// المشترك يجعل آلاف المستخدمين — عبر كل نسخ الموصّل ومع كل إعادة تشغيل —
// يقرأون نفس النتيجة المخزّنة بدل تشغيل تصفّح حي لكل طلب.
// بدون ضبط Redis يعمل بالذاكرة فقط (تطوير/نسخة واحدة).

import { config } from "./config.js"

const REDIS_URL = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL
const REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN
export const cacheShared = Boolean(REDIS_URL && REDIS_TOKEN)

const mem = new Map() // L1: key → { value, expires }
// فضاء أسماء لكل مجموعة خطوط — يمنع تداخل نسخ الموصّل المقسّمة على Redis المشترك.
const PREFIX = `th:cache:${config.cacheNamespace}:`

function memGet(key) {
  const hit = mem.get(key)
  if (!hit) return null
  if (Date.now() > hit.expires) {
    mem.delete(key)
    return null
  }
  return hit.value
}

function memSet(key, value, ttlMs) {
  // حدّ أقصى بسيط لحجم L1 يمنع تضخّم الذاكرة
  if (mem.size > 5000) {
    const now = Date.now()
    for (const [k, v] of mem) if (now > v.expires) mem.delete(k)
    if (mem.size > 5000) mem.clear()
  }
  mem.set(key, { value, expires: Date.now() + ttlMs })
}

async function redis(cmd) {
  const res = await fetch(REDIS_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${REDIS_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify(cmd),
    cache: "no-store",
  })
  if (!res.ok) throw new Error(`redis HTTP ${res.status}`)
  return (await res.json()).result
}

export async function cacheGet(key) {
  const l1 = memGet(key)
  if (l1 !== null) return l1
  if (!cacheShared) return null
  try {
    const raw = await redis(["GET", PREFIX + key])
    if (raw == null) return null
    const value = JSON.parse(raw)
    // أعِد تعبئة L1 بمهلة قصيرة (لا نعرف TTL المتبقي بدقّة — نُبقيها دقيقة)
    memSet(key, value, 60_000)
    return value
  } catch {
    return null
  }
}

export async function cacheSet(key, value, ttlMs) {
  memSet(key, value, ttlMs)
  if (!cacheShared) return
  try {
    await redis(["SET", PREFIX + key, JSON.stringify(value), "PX", String(ttlMs)])
  } catch {
    /* الكاش المشترك اختياري — نتجاهل فشله */
  }
}
