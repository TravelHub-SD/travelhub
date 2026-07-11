// ─────────────────────────────────────────────────────────────
// خدمة الموصّل (Express): تستقبل طلب بحث، تسأل كل خط سوداني عبر
// أتمتة بوابة TTI، وتدمج النتائج وترجّعها بشكل موقع TravelHub.
// ─────────────────────────────────────────────────────────────
import express from "express"
import { config } from "./config.js"
import { cacheGet, cacheSet } from "./cache.js"
import { searchCarrier, listCarrierAirports } from "./tti.js"
import { mockCarrierFlights } from "./mock.js"
import { shutdownBrowser } from "./browser.js"

const app = express()
app.use(express.json())

// حماية بسيطة بمفتاح مشترك: عبر هيدر x-connector-key (للموقع)
// أو عبر ?key= في الرابط (لتسهيل الاختبار من المتصفح).
app.use((req, res, next) => {
  if (req.path === "/health") return next()
  const provided = req.get("x-connector-key") || req.query.key
  if (config.apiKey && provided !== config.apiKey) {
    return res.status(401).json({ error: "unauthorized" })
  }
  next()
})

app.get("/health", (_req, res) => {
  res.json({ ok: true, carriers: config.carriers.map((c) => c.name), mock: config.mock })
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

app.get("/airports", (_req, res) => {
  const fresh = airportsCache && Date.now() - airportsCache.t < 24 * 60 * 60 * 1000
  if (!fresh) refreshAirports() // تحديث بالخلفية (لا يعطّل الرد)
  res.json(airportsCache?.data?.length ? airportsCache.data : FALLBACK_AIRPORTS)
})

// المنطق المشترك للبحث.
async function doSearch({ origin, destination, departureDate, adults }) {
  origin = String(origin || "").trim().toUpperCase()
  destination = String(destination || "").trim().toUpperCase()
  departureDate = String(departureDate || "").trim()
  adults = Math.max(1, Math.min(9, Number(adults) || 1))

  if (!origin || !destination || !departureDate) {
    return { status: 400, body: { error: "origin, destination, departureDate مطلوبة" } }
  }

  const params = { origin, destination, departureDate, adults }
  const cacheKey = `${origin}-${destination}-${departureDate}-${adults}`

  const cached = cacheGet(cacheKey)
  if (cached) return { status: 200, body: { ...cached, meta: { ...cached.meta, cached: true } } }

  // وضع تجريبي
  if (config.mock || config.carriers.length === 0) {
    const data = mockCarrierFlights(params)
    const payload = { data, meta: { source: "mock", carriers: ["تاركو", "بدر", "سودانير"], warnings: [] } }
    cacheSet(cacheKey, payload, config.cacheTtlMs)
    return { status: 200, body: payload }
  }

  // بحث فعلي عبر كل الخطوط بالتوازي
  const results = await Promise.all(config.carriers.map((c) => searchCarrier(c, params)))
  const data = results.flatMap((r) => r.flights)
  const warnings = results.filter((r) => r.error).map((r) => `${r.carrier}: ${r.error}`)
  data.sort((a, b) => Number(a.price.total) - Number(b.price.total))

  const payload = { data, meta: { source: "tti", carriers: config.carriers.map((c) => c.name), warnings } }
  if (data.length) cacheSet(cacheKey, payload, config.cacheTtlMs) // لا نخبّئ فشلاً
  return { status: 200, body: payload }
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
const server = app.listen(config.port, "0.0.0.0", () => {
  console.log(`[tti-connector] يعمل على المنفذ ${config.port} — الخطوط: ${config.carriers.map((c) => c.name).join(", ") || "(mock)"}`)
  // تسخين قائمة المطارات في الخلفية لتكون جاهزة عند أول طلب من الموقع.
  refreshAirports()
})

for (const sig of ["SIGINT", "SIGTERM"]) {
  process.on(sig, async () => {
    await shutdownBrowser()
    server.close(() => process.exit(0))
  })
}
