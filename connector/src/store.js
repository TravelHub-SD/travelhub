// ─────────────────────────────────────────────────────────────
// خزينة Supabase (PostgREST عبر fetch — بلا مكتبات إضافية).
// الموصّل يكتب هنا نتائج الزحف الليلي، والموقع يقرأ منها فوراً.
// يعمل بمفتاح service_role (خادم فقط) — لا يصل المتصفح أبداً.
// ─────────────────────────────────────────────────────────────

const URL_BASE = (process.env.SUPABASE_URL || "").replace(/\/$/, "")
const KEY = process.env.SUPABASE_SERVICE_KEY || ""

export const storeEnabled = Boolean(URL_BASE && KEY)

function headers(extra = {}) {
  return {
    apikey: KEY,
    Authorization: `Bearer ${KEY}`,
    "Content-Type": "application/json",
    ...extra,
  }
}

async function rest(path, init = {}, timeoutMs = 20000) {
  const controller = new AbortController()
  const t = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const res = await fetch(`${URL_BASE}/rest/v1/${path}`, {
      ...init,
      headers: headers(init.headers),
      signal: controller.signal,
      cache: "no-store",
    })
    if (!res.ok) throw new Error(`supabase ${res.status}: ${(await res.text()).slice(0, 160)}`)
    const text = await res.text()
    return text ? JSON.parse(text) : null
  } finally {
    clearTimeout(t)
  }
}

// إدراج/تحديث دفعة (upsert على المفتاح الأساسي)
async function upsert(table, rows) {
  if (!storeEnabled || !rows.length) return
  // نقسّم الدفعات الكبيرة حتى لا نتجاوز حدود الطلب
  for (let i = 0; i < rows.length; i += 500) {
    await rest(table, {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
      body: JSON.stringify(rows.slice(i, i + 500)),
    })
  }
}

// ─── مطارات النظام ───────────────────────────────────────────
// تُخزَّن مرة ويقرأها الموقع فوراً، فلا ينتظر الزائر إيقاظ الموصّل.
export async function saveAirports(list) {
  if (!storeEnabled || !list?.length) return
  const now = new Date().toISOString()
  await upsert(
    "airports",
    list.map((a) => ({ code: a.code, name: a.name, updated_at: now })),
  )
}

// ─── أيام الإتاحة ────────────────────────────────────────────
export async function saveAvailability(origin, destination, carrier, days) {
  if (!storeEnabled) return
  const now = new Date().toISOString()
  await upsert(
    "availability",
    days.map((d) => ({
      origin,
      destination,
      flight_date: d.date,
      carrier,
      seats: d.seats ?? 0,
      updated_at: now,
    })),
  )
}

// كل أيام الإتاحة القادمة (لبناء قائمة الزحف: نبحث الأيام التي بها رحلات فقط)
export async function listUpcomingAvailability(fromDate, toDate, limit = 5000) {
  if (!storeEnabled) return []
  const q =
    `availability?select=origin,destination,flight_date` +
    `&flight_date=gte.${fromDate}&flight_date=lte.${toDate}` +
    `&order=flight_date.asc&limit=${limit}`
  return (await rest(q, { method: "GET" })) || []
}

// ─── نتائج البحث المخزّنة ────────────────────────────────────
export async function saveFlights({ origin, destination, departDate, paxKey, source, flights }) {
  if (!storeEnabled) return
  await upsert("flight_cache", [
    {
      origin,
      destination,
      depart_date: departDate,
      pax_key: paxKey,
      source,
      payload: flights,
      updated_at: new Date().toISOString(),
    },
  ])
}

// آخر تحديث لكل (مسار+تاريخ) لهذه النسخة — لتخطّي ما هو حديث أثناء الزحف
export async function listFreshKeys(source, sinceIso, limit = 5000) {
  if (!storeEnabled) return new Set()
  const q =
    `flight_cache?select=origin,destination,depart_date` +
    `&source=eq.${encodeURIComponent(source)}&updated_at=gte.${encodeURIComponent(sinceIso)}` +
    `&limit=${limit}`
  const rows = (await rest(q, { method: "GET" })) || []
  return new Set(rows.map((r) => `${r.origin}-${r.destination}-${String(r.depart_date).slice(0, 10)}`))
}

// ─── حالة الزحف (الاستئناف من حيث توقّفنا) ───────────────────
export async function getCrawlState(id) {
  if (!storeEnabled) return null
  const rows = (await rest(`crawl_state?select=cursor&id=eq.${encodeURIComponent(id)}`, { method: "GET" })) || []
  return rows[0]?.cursor ?? null
}

export async function setCrawlState(id, cursor) {
  if (!storeEnabled) return
  await upsert("crawl_state", [{ id, cursor, updated_at: new Date().toISOString() }])
}
