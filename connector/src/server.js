// ─────────────────────────────────────────────────────────────
// خدمة الموصّل (Express): تستقبل طلب بحث، تسأل كل خط سوداني عبر
// أتمتة بوابة TTI، وتدمج النتائج وترجّعها بشكل موقع TravelHub.
// ─────────────────────────────────────────────────────────────
import express from "express"
import { config } from "./config.js"
import { cacheGet, cacheSet } from "./cache.js"
import { searchCarrier, debugCarrier } from "./tti.js"
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

// نقطة تشخيص مؤقتة:
//   /debug?carrier=sudanair&key=XXX          → حقائق JSON عن الصفحة بعد الدخول
//   /debug?carrier=sudanair&shot=1&key=XXX   → صورة لِما يراه المتصفح
app.get("/debug", async (req, res) => {
  const code = String(req.query.carrier || "").toLowerCase()
  const carrier =
    config.carriers.find((c) => (c.code || "").toLowerCase() === code) || config.carriers[0]
  if (!carrier) return res.status(400).json({ error: "no carriers configured" })
  try {
    const wantShot = req.query.shot === "1"
    const { facts, screenshot } = await debugCarrier(carrier, { screenshot: wantShot })
    if (wantShot && screenshot) return res.set("Content-Type", "image/png").send(screenshot)
    res.json({ carrier: carrier.name, ...facts })
  } catch (e) {
    res.status(500).json({ carrier: carrier.name, error: e?.message || String(e) })
  }
})

// 0.0.0.0 مطلوب على منصّات الحاويات (Railway) لتصل الطلبات الخارجية.
const server = app.listen(config.port, "0.0.0.0", () => {
  console.log(`[tti-connector] يعمل على المنفذ ${config.port} — الخطوط: ${config.carriers.map((c) => c.name).join(", ") || "(mock)"}`)
})

for (const sig of ["SIGINT", "SIGTERM"]) {
  process.on(sig, async () => {
    await shutdownBrowser()
    server.close(() => process.exit(0))
  })
}
