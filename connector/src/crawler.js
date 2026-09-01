// ─────────────────────────────────────────────────────────────
// الزحف المسبق: يملأ Supabase ليلاً فيصبح البحث في الموقع فورياً.
//
// مرحلتان:
//  ① الإتاحة (أسبوعياً): نداء واحد لكل (مسار + شهر) يرجّع أيام الشهر كلها
//     — رخيص جداً، فنغطّي كل الوجهات بلا استثناء.
//  ② الأسعار (ليلياً): نبحث فقط الأيام التي أثبتت المرحلة ① أن بها رحلات
//     — فبدل آلاف عمليات البحث العمياء نُنفّذ المئات المفيدة فقط.
//
// كل مرحلة محكومة بـ"ميزانية وقت" ثابتة وتستأنف من حيث توقّفت،
// فاستهلاك ساعات الاستضافة مضمون ولا يتجاوز الحد أبداً.
// ─────────────────────────────────────────────────────────────
import { config } from "./config.js"
import { getCarrierAvailability, searchCarrier, listCarrierAirports } from "./tti.js"
import {
  storeEnabled,
  saveAvailability,
  saveAirports,
  listUpcomingAvailability,
  saveFlights,
  listFreshKeys,
  getCrawlState,
  setCrawlState,
} from "./store.js"

const DAY_MS = 86_400_000
const iso = (d) => d.toISOString().slice(0, 10)

// المسارات الأهم تُزحف أولاً (فلو نفدت الميزانية تكون الأهم جاهزة)
const PRIORITY = (process.env.POPULAR_ROUTES || "KRT-JED,KRT-PZU,KRT-CAI,KRT-DXB,KRT-DOH,KRT-IST,KRT-DOG,PZU-JED")
  .split(",")
  .map((s) => s.trim().toUpperCase())
  .filter(Boolean)

const priorityRank = (o, d) => {
  const i = PRIORITY.indexOf(`${o}-${d}`)
  const j = PRIORITY.indexOf(`${d}-${o}`)
  const r = i >= 0 ? i : j >= 0 ? j + 0.5 : Number.MAX_SAFE_INTEGER
  return r
}

let running = false

// ── ① الإتاحة: كل الأزواج الممكنة من مطارات النظام ──────────────
export async function crawlAvailability({ budgetMs = 60 * 60_000, months = 3 } = {}) {
  if (!storeEnabled) return { ok: false, reason: "supabase غير مضبوط" }
  if (running) return { ok: false, reason: "زحف آخر يعمل" }
  if (config.mock || !config.carriers.length) return { ok: false, reason: "لا خطوط حقيقية" }
  running = true
  const deadline = Date.now() + budgetMs
  let done = 0
  let saved = 0

  try {
    // مطارات النظام لهذه النسخة (خطوطها فقط)
    const merged = {}
    for (const c of config.carriers) Object.assign(merged, await listCarrierAirports(c))
    const codes = Object.keys(merged).filter((c) => /^[A-Z]{3}$/.test(c))
    if (!codes.length) return { ok: false, reason: "تعذّر قراءة المطارات" }
    // خزّن قائمة المطارات ليقرأها الموقع فوراً (بلا انتظار إيقاظ الموصّل)
    await saveAirports(
      codes.map((code) => ({ code, name: merged[code] || code })),
    ).catch(() => {})

    // كل الأزواج، مرتّبة بالأهمية
    const pairs = []
    for (const o of codes) for (const d of codes) if (o !== d) pairs.push([o, d])
    pairs.sort((a, b) => priorityRank(a[0], a[1]) - priorityRank(b[0], b[1]))

    // استئناف من حيث توقّفنا
    const stateId = `avail:${config.cacheNamespace}`
    const start = (await getCrawlState(stateId))?.i ?? 0

    // نطاقات زمنية تبدأ من **اليوم** وتمتد قُدُماً (لا من أول الشهر الحالي،
    // وإلا ضاع جزء من الميزانية على أيام فائتة ولم نصل للأشهر البعيدة).
    // نقسّمها إلى شرائح ~٣٠ يوماً لأن نداء الإتاحة يُرجّع نطاقاً محدوداً.
    const ranges = []
    const startAt = new Date()
    for (let m = 0; m < months; m++) {
      const from = new Date(startAt.getTime() + m * 30 * DAY_MS)
      const to = new Date(startAt.getTime() + ((m + 1) * 30 - 1) * DAY_MS)
      ranges.push([iso(from), iso(to)])
    }

    let i = start
    for (; i < pairs.length; i++) {
      if (Date.now() > deadline) break
      const [origin, destination] = pairs[i]
      for (const [s, e] of ranges) {
        if (Date.now() > deadline) break
        for (const c of config.carriers) {
          const r = await getCarrierAvailability(c, { origin, destination, start: s, end: e })
          if (r.days?.length) {
            await saveAvailability(origin, destination, c.name, r.days).catch(() => {})
            saved += r.days.length
          }
        }
      }
      done++
    }
    // لفّة كاملة → نبدأ من الأول في المرة القادمة
    await setCrawlState(stateId, { i: i >= pairs.length ? 0 : i }).catch(() => {})
    return { ok: true, pairs: pairs.length, processed: done, daysSaved: saved, finished: i >= pairs.length }
  } catch (e) {
    return { ok: false, reason: e?.message || String(e) }
  } finally {
    running = false
  }
}

// ── ② الأسعار: نبحث فقط الأيام التي بها رحلات فعلاً ─────────────
export async function crawlPrices({ budgetMs = 3 * 60 * 60_000, horizonDays = 30, freshHours = 20 } = {}) {
  if (!storeEnabled) return { ok: false, reason: "supabase غير مضبوط" }
  if (running) return { ok: false, reason: "زحف آخر يعمل" }
  if (config.mock || !config.carriers.length) return { ok: false, reason: "لا خطوط حقيقية" }
  running = true
  const deadline = Date.now() + budgetMs
  const source = config.cacheNamespace
  let searched = 0
  let stored = 0

  try {
    const today = new Date()
    const from = iso(today)
    const to = iso(new Date(today.getTime() + horizonDays * DAY_MS))

    // قائمة (مسار + يوم) من جدول الإتاحة — دي خريطة الرحلات الحقيقية
    const rows = await listUpcomingAvailability(from, to)
    if (!rows.length) return { ok: false, reason: "جدول الإتاحة فارغ — شغّل زحف الإتاحة أولاً" }

    // أزل التكرار (عدة خطوط لنفس اليوم) ورتّب: الأهم ثم الأقرب تاريخاً
    const seen = new Set()
    const tasks = []
    for (const r of rows) {
      const date = String(r.flight_date).slice(0, 10)
      const key = `${r.origin}-${r.destination}-${date}`
      if (seen.has(key)) continue
      seen.add(key)
      tasks.push({ origin: r.origin, destination: r.destination, date, key })
    }
    tasks.sort((a, b) => {
      const p = priorityRank(a.origin, a.destination) - priorityRank(b.origin, b.destination)
      return p !== 0 ? p : a.date.localeCompare(b.date)
    })

    // تخطَّ ما هو محدَّث حديثاً (لا نكرّر عمل الليلة السابقة)
    const sinceIso = new Date(Date.now() - freshHours * 3_600_000).toISOString()
    const fresh = await listFreshKeys(source, sinceIso).catch(() => new Set())

    for (const t of tasks) {
      if (Date.now() > deadline) break
      if (fresh.has(t.key)) continue
      const params = { origin: t.origin, destination: t.destination, departureDate: t.date, adults: 1, children: 0, infants: 0 }
      const results = await Promise.all(config.carriers.map((c) => searchCarrier(c, params)))
      const flights = results.flatMap((r) => r.flights)
      searched++
      if (flights.length) {
        flights.sort((a, b) => Number(a.price.total) - Number(b.price.total))
        await saveFlights({
          origin: t.origin,
          destination: t.destination,
          departDate: t.date,
          paxKey: "1-0-0",
          source,
          flights,
        }).catch(() => {})
        stored++
      }
    }
    return { ok: true, candidates: tasks.length, searched, stored, timeLeftMs: Math.max(0, deadline - Date.now()) }
  } catch (e) {
    return { ok: false, reason: e?.message || String(e) }
  } finally {
    running = false
  }
}

export const crawlerBusy = () => running
