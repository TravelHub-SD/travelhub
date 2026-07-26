// ─────────────────────────────────────────────────────────────
// خدمة الموصّل (Express): تستقبل طلب بحث، تسأل كل خط سوداني عبر
// أتمتة بوابة TTI، وتدمج النتائج وترجّعها بشكل موقع TravelHub.
// ─────────────────────────────────────────────────────────────
import express from "express"
import { timingSafeEqual } from "node:crypto"
import { config } from "./config.js"
import { cacheGet, cacheSet } from "./cache.js"
import { searchCarrier, listCarrierAirports, inspectBooking, getCarrierAvailability } from "./tti.js"
import { mockCarrierFlights } from "./mock.js"
import { shutdownBrowser } from "./browser.js"

const app = express()
app.disable("x-powered-by") // إخفاء بصمة Express
app.set("trust proxy", 1) // عنوان العميل الصحيح خلف بروكسي Railway
app.use(express.json({ limit: "8kb" })) // حد حجم الجسم

// مقارنة مفاتيح آمنة توقيتياً (تمنع هجمات التوقيت)
function safeKeyEqual(a, b) {
  const A = Buffer.from(String(a || ""))
  const B = Buffer.from(String(b || ""))
  return A.length === B.length && timingSafeEqual(A, B)
}

// حد معدّل بسيط في الذاكرة لكل عنوان
const rlBuckets = new Map()
function rateLimited(ip, limit, windowMs) {
  const now = Date.now()
  if (rlBuckets.size > 10_000) {
    for (const [k, b] of rlBuckets) if (now - b.t > windowMs) rlBuckets.delete(k)
  }
  const b = rlBuckets.get(ip)
  if (!b || now - b.t > windowMs) {
    rlBuckets.set(ip, { n: 1, t: now })
    return false
  }
  if (b.n >= limit) return true
  b.n++
  return false
}

// حماية بمفتاح مشترك عبر هيدر x-connector-key فقط
// (لا ?key= في الرابط — الروابط تتسرّب إلى السجلات).
app.use((req, res, next) => {
  if (rateLimited(req.ip, 120, 60_000)) return res.status(429).json({ error: "too many requests" })
  if (req.path === "/health") return next() // لفحص الجاهزية من منصة الاستضافة
  const provided = req.get("x-connector-key")
  if (config.apiKey && !safeKeyEqual(provided, config.apiKey)) {
    return res.status(401).json({ error: "unauthorized" })
  }
  next()
})

// فحص جاهزية أدنى — بلا أي معلومات داخلية
app.get("/health", (_req, res) => {
  res.json({ ok: true })
})

// ─── مطارات النظام (للقوائم المنسدلة في الموقع) ───────────────────────────────
// قائمة احتياطية سودانية تظهر فوراً ريثما تُقرأ القائمة الفعلية من النظام.
const FALLBACK_AIRPORTS = [
  { code: "KRT", name: "Khartoum" },
  { code: "PZU", name: "Port Sudan" },
  { code: "DOG", name: "Dongola" },
  { code: "UYL", name: "Nyala" },
  { code: "ELF", name: "El Fasher" },
  { code: "EBD", name: "El Obeid" },
  { code: "CAI", name: "Cairo" },
  { code: "JED", name: "Jeddah" },
  { code: "DXB", name: "Dubai" },
  { code: "DOH", name: "Doha" },
  { code: "IST", name: "Istanbul" },
  { code: "ADD", name: "Addis Ababa" },
  { code: "JUB", name: "Juba" },
]

let airportsCache = null // { t, data }
let airportsRefreshing = false

async function refreshAirports() {
  if (airportsRefreshing || config.mock || config.carriers.length === 0) return
  airportsRefreshing = true
  try {
    const merged = {}
    for (const c of config.carriers) Object.assign(merged, await listCarrierAirports(c))
    const data = Object.entries(merged)
      .map(([code, name]) => ({ code, name }))
      .sort((a, b) => a.name.localeCompare(b.name))
    if (data.length) airportsCache = { t: Date.now(), data }
  } catch {
    /* نُبقي القائمة الاحتياطية */
  } finally {
    airportsRefreshing = false
  }
}

// ─── أيام الإتاحة (الأيام الخضراء في التقويم) ────────────────────────────────
// GET /availability?origin=KRT&destination=PZU&start=2026-08-01&end=2026-08-31
// يدمج أيام كل الخطوط: { days: { "2026-08-03": 8, ... } }
const AVAIL_TTL_MS = 6 * 60 * 60 * 1000

app.get("/availability", async (req, res) => {
  const origin = String(req.query.origin || "").trim().toUpperCase()
  const destination = String(req.query.destination || "").trim().toUpperCase()
  const start = String(req.query.start || "").trim()
  const end = String(req.query.end || "").trim()
  if (!/^[A-Z]{3}$/.test(origin) || !/^[A-Z]{3}$/.test(destination) || !/^\d{4}-\d{2}-\d{2}$/.test(start) || !/^\d{4}-\d{2}-\d{2}$/.test(end)) {
    return res.status(400).json({ error: "origin, destination, start, end (YYYY-MM-DD) مطلوبة" })
  }

  const cacheKey = `avail:${origin}-${destination}-${start}-${end}`
  const cached = await cacheGet(cacheKey)
  if (cached) return res.json({ ...cached, cached: true })

  // وضع تجريبي: نمط أيام ثابت (إثنين/خميس) للعرض
  if (config.mock || config.carriers.length === 0) {
    const days = {}
    const d = new Date(`${start}T00:00:00Z`)
    const endD = new Date(`${end}T00:00:00Z`)
    while (d <= endD) {
      if ([1, 4].includes(d.getUTCDay())) days[d.toISOString().slice(0, 10)] = 9
      d.setUTCDate(d.getUTCDate() + 1)
    }
    const payload = { days, carriers: [], warnings: ["mock"] }
    await cacheSet(cacheKey, payload, AVAIL_TTL_MS)
    return res.json(payload)
  }

  const results = await Promise.all(
    config.carriers.map((c) => getCarrierAvailability(c, { origin, destination, start, end })),
  )
  const days = {}
  for (const r of results) {
    for (const d of r.days) days[d.date] = Math.max(days[d.date] || 0, d.seats)
  }
  const warnings = results.filter((r) => r.error).map((r) => `${r.carrier}: ${r.error}`)
  const payload = { days, carriers: results.map((r) => r.carrier), warnings }
  if (Object.keys(days).length > 0) await cacheSet(cacheKey, payload, AVAIL_TTL_MS)
  res.json(payload)
})

// ─── التسخين المسبق للمسارات الشائعة ─────────────────────────────────────────
// يُشغَّل دورياً (Vercel Cron) ليملأ كاش الإتاحة للمسارات الأكثر بحثاً، فيقرأها
// آلاف المستخدمين فوراً من Redis بلا تصفّح حي.
const POPULAR_ROUTES = (
  process.env.POPULAR_ROUTES || "KRT-PZU,KRT-JED,KRT-CAI,KRT-DXB,KRT-DOH,KRT-IST,KRT-DOG,PZU-JED"
)
  .split(",")
  .map((s) => s.trim().toUpperCase())
  .filter((s) => /^[A-Z]{3}-[A-Z]{3}$/.test(s))

let warming = false
async function warmPopular() {
  if (warming || config.mock || config.carriers.length === 0) return
  warming = true
  let warmed = 0
  try {
    const now = new Date()
    const months = [now, new Date(now.getFullYear(), now.getMonth() + 1, 1)]
    for (const route of POPULAR_ROUTES) {
      const [o, d] = route.split("-")
      for (const [origin, destination] of [
        [o, d],
        [d, o],
      ]) {
        for (const m of months) {
          const y = m.getFullYear()
          const mo = m.getMonth()
          const start = `${y}-${String(mo + 1).padStart(2, "0")}-01`
          const last = new Date(y, mo + 1, 0)
          const end = `${y}-${String(mo + 1).padStart(2, "0")}-${String(last.getDate()).padStart(2, "0")}`
          const key = `avail:${origin}-${destination}-${start}-${end}`
          if (await cacheGet(key)) continue // مُسخّن بالفعل
          const results = await Promise.all(
            config.carriers.map((c) => getCarrierAvailability(c, { origin, destination, start, end })),
          )
          const days = {}
          for (const r of results) for (const dd of r.days) days[dd.date] = Math.max(days[dd.date] || 0, dd.seats)
          if (Object.keys(days).length) {
            await cacheSet(key, { days, carriers: results.map((r) => r.carrier), warnings: [] }, AVAIL_TTL_MS)
            warmed++
          }
        }
      }
    }
  } finally {
    warming = false
  }
  return warmed
}

app.post("/warm", (_req, res) => {
  res.json({ started: true, routes: POPULAR_ROUTES.length }) // رد فوري
  warmPopular().catch(() => {}) // يعمل بالخلفية عبر محدِّد التزامن
})

// أداة فحص تشخيصية — معطّلة افتراضياً؛ فعّلها مؤقتاً بمتغيّر البيئة INSPECT_ENABLED=1
app.get("/inspect", async (_req, res) => {
  if (process.env.INSPECT_ENABLED !== "1") return res.status(404).json({ error: "not found" })
  if (config.mock || config.carriers.length === 0) return res.json({ mock: true })
  try {
    res.json(await inspectBooking(config.carriers[0]))
  } catch (e) {
    res.status(500).json({ error: "inspect failed" })
  }
})

app.get("/airports", (_req, res) => {
  const fresh = airportsCache && Date.now() - airportsCache.t < 24 * 60 * 60 * 1000
  if (!fresh) refreshAirports() // تحديث بالخلفية (لا يعطّل الرد)
  res.json(airportsCache?.data?.length ? airportsCache.data : FALLBACK_AIRPORTS)
})

// طلبات متزامنة لنفس البحث تتشارك عملية واحدة (امتصاص الحمل العالي)
const pendingSearches = new Map()

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const validDay = (s) => DATE_RE.test(s) && !Number.isNaN(new Date(`${s}T00:00:00Z`).getTime())

// المنطق المشترك للبحث. returnDate اختياري — عند وجوده نبحث رحلة العودة أيضاً
// (اتجاه معاكس بتاريخ العودة) ونوسم كل رحلة بـ leg: "ذهاب" | "عودة" —
// نفس منطق النظام: اختيار مستقل لرحلة كل اتجاه بسعره.
async function doSearch({ origin, destination, departureDate, returnDate, adults, children, infants }) {
  origin = String(origin || "").trim().toUpperCase()
  destination = String(destination || "").trim().toUpperCase()
  departureDate = String(departureDate || "").trim()
  returnDate = String(returnDate || "").trim()
  adults = Math.max(1, Math.min(9, Number(adults) || 1))
  children = Math.max(0, Math.min(8, Number(children) || 0))
  infants = Math.max(0, Math.min(adults, Number(infants) || 0))

  // تحقق صارم من الشكل — يمنع تمرير أي مدخلات غريبة إلى الأتمتة
  if (
    !/^[A-Z]{3}$/.test(origin) ||
    !/^[A-Z]{3}$/.test(destination) ||
    origin === destination ||
    !validDay(departureDate) ||
    (returnDate && (!validDay(returnDate) || returnDate < departureDate))
  ) {
    return { status: 400, body: { error: "معاملات غير صالحة" } }
  }

  const base = { adults, children, infants }
  const outParams = { origin, destination, departureDate, ...base }
  const retParams = returnDate ? { origin: destination, destination: origin, departureDate: returnDate, ...base } : null
  const cacheKey = `${origin}-${destination}-${departureDate}-${returnDate || "OW"}-${adults}-${children}-${infants}`

  const cached = await cacheGet(cacheKey)
  if (cached) return { status: 200, body: { ...cached, meta: { ...cached.meta, cached: true } } }

  // وضع تجريبي
  if (config.mock || config.carriers.length === 0) {
    let data = mockCarrierFlights(outParams)
    if (retParams) {
      data = [
        ...data.map((f) => ({ ...f, leg: "ذهاب" })),
        ...mockCarrierFlights(retParams).map((f) => ({ ...f, leg: "عودة" })),
      ]
    }
    const payload = { data, meta: { source: "mock", carriers: ["تاركو", "بدر", "سودانير"], warnings: [] } }
    await cacheSet(cacheKey, payload, config.cacheTtlMs)
    return { status: 200, body: payload }
  }

  // دمج الطلبات المتزامنة المتطابقة في عملية واحدة
  if (pendingSearches.has(cacheKey)) {
    const body = await pendingSearches.get(cacheKey)
    return { status: 200, body }
  }

  const run = (async () => {
    // بحث فعلي: وضع "Round trip" الأصلي في النظام — بحث واحد لكل خط
    // يرجّع الاتجاهين معاً (التطبيع يوسم كل رحلة ذهاب/عودة تلقائياً).
    const nativeParams = retParams ? { ...outParams, returnDate: retParams.departureDate } : outParams
    const results = await Promise.all(config.carriers.map((c) => searchCarrier(c, nativeParams)))
    const data = results.flatMap((r) => r.flights)
    const warnings = results.filter((r) => r.error).map((r) => `${r.carrier}: ${r.error}`)

    // شبكة أمان: لو البحث الموحّد ما رجّع رحلات عودة، نكمّلها ببحث الاتجاه المعاكس
    if (retParams && data.length && !data.some((f) => f.leg === "عودة")) {
      warnings.push("العودة لم تُقرأ من البحث الموحّد — نُفّذ بحث الاتجاه المعاكس احتياطاً")
      const backResults = await Promise.all(config.carriers.map((c) => searchCarrier(c, retParams)))
      for (const r of backResults) {
        data.push(...r.flights.map((f) => ({ ...f, leg: "عودة" })))
        if (r.error) warnings.push(`${r.carrier} (عودة): ${r.error}`)
      }
      data.forEach((f) => {
        if (!f.leg) f.leg = "ذهاب"
      })
    }
    data.sort((a, b) => Number(a.price.total) - Number(b.price.total))

    const payload = { data, meta: { source: "tti", carriers: config.carriers.map((c) => c.name), warnings } }
    if (data.length) await cacheSet(cacheKey, payload, config.cacheTtlMs) // لا نخبّئ فشلاً
    return payload
  })()

  pendingSearches.set(cacheKey, run)
  try {
    const body = await run
    return { status: 200, body }
  } finally {
    pendingSearches.delete(cacheKey)
  }
}

// نقطة الموقع (POST).
app.post("/search", async (req, res) => {
  const { status, body } = await doSearch(req.body || {})
  res.status(status).json(body)
})

// نقطة اختبار من المتصفح (GET):
// /search?origin=PZU&destination=KRT&departureDate=2026-07-14&key=XXX
app.get("/search", async (req, res) => {
  const { status, body } = await doSearch(req.query || {})
  res.status(status).json(body)
})

// 0.0.0.0 مطلوب على منصّات الحاويات (Railway) لتصل الطلبات الخارجية.
// مسارات غير معروفة: 404 موحّد بلا أي تفاصيل (يصعّب رسم خريطة الخدمة)
app.use((_req, res) => res.status(404).json({ error: "not found" }))

// معالج أخطاء عام: لا نسرّب stack أو رسائل داخلية
// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  console.error("[server]", err?.message || err)
  res.status(500).json({ error: "server error" })
})

const server = app.listen(config.port, "0.0.0.0", () => {
  console.log(`[tti-connector] يعمل على المنفذ ${config.port} — الخطوط: ${config.carriers.map((c) => c.name).join(", ") || "(mock)"}`)
  // تسخين قائمة المطارات في الخلفية لتكون جاهزة عند أول طلب من الموقع.
  refreshAirports()
  // ثم تسخين إتاحة المسارات الشائعة (بعد مهلة ليكتمل تسخين المطارات أولاً).
  setTimeout(() => warmPopular().catch(() => {}), 60_000)
})

for (const sig of ["SIGINT", "SIGTERM"]) {
  process.on(sig, async () => {
    await shutdownBrowser()
    server.close(() => process.exit(0))
  })
}
