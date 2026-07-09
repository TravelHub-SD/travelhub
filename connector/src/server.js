// ─────────────────────────────────────────────────────────────
// خدمة الموصّل (Express): تستقبل طلب بحث، تسأل كل خط سوداني عبر
// أتمتة بوابة TTI، وتدمج النتائج وترجّعها بشكل موقع TravelHub.
// ─────────────────────────────────────────────────────────────
import express from "express"
import { config } from "./config.js"
import { cacheGet, cacheSet } from "./cache.js"
import { searchCarrier } from "./tti.js"
import { mockCarrierFlights } from "./mock.js"
import { shutdownBrowser } from "./browser.js"

const app = express()
app.use(express.json())

// حماية بسيطة بمفتاح مشترك (موقعك يرسله في x-connector-key)
app.use((req, res, next) => {
  if (req.path === "/health") return next()
  if (config.apiKey && req.get("x-connector-key") !== config.apiKey) {
    return res.status(401).json({ error: "unauthorized" })
  }
  next()
})

app.get("/health", (_req, res) => {
  res.json({ ok: true, carriers: config.carriers.map((c) => c.name), mock: config.mock })
})

app.post("/search", async (req, res) => {
  const origin = String(req.body.origin || "").trim().toUpperCase()
  const destination = String(req.body.destination || "").trim().toUpperCase()
  const departureDate = String(req.body.departureDate || "").trim()
  const adults = Math.max(1, Math.min(9, Number(req.body.adults) || 1))

  if (!origin || !destination || !departureDate) {
    return res.status(400).json({ error: "origin, destination, departureDate مطلوبة" })
  }

  const params = { origin, destination, departureDate, adults }
  const cacheKey = `${origin}-${destination}-${departureDate}-${adults}`

  const cached = cacheGet(cacheKey)
  if (cached) return res.json({ ...cached, meta: { ...cached.meta, cached: true } })

  // وضع تجريبي
  if (config.mock || config.carriers.length === 0) {
    const data = mockCarrierFlights(params)
    const payload = { data, meta: { source: "mock", carriers: ["تاركو", "بدر", "سودانير"], warnings: [] } }
    cacheSet(cacheKey, payload, config.cacheTtlMs)
    return res.json(payload)
  }

  // بحث فعلي عبر كل الخطوط بالتوازي
  const results = await Promise.all(config.carriers.map((c) => searchCarrier(c, params)))
  const data = results.flatMap((r) => r.flights)
  const warnings = results.filter((r) => r.error).map((r) => `${r.carrier}: ${r.error}`)

  data.sort((a, b) => Number(a.price.total) - Number(b.price.total))

  const payload = {
    data,
    meta: {
      source: "tti",
      carriers: config.carriers.map((c) => c.name),
      warnings,
    },
  }
  // نخزّن فقط لو فيه نتائج فعلية (لا نخبّئ فشلاً)
  if (data.length) cacheSet(cacheKey, payload, config.cacheTtlMs)
  res.json(payload)
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
