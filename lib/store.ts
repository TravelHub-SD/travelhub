/**
 * lib/store.ts
 * ─────────────────────────────────────────────────────────────────
 * قراءة الخزينة (Supabase) من الخادم فقط — مفتاح service_role لا يصل المتصفح.
 * الموقع يقرأ من هنا أولاً فيرد فوراً، ولا يشغّل المتصفح إلا عند غياب البيانات.
 */

const URL_BASE = (process.env.SUPABASE_URL || "").replace(/\/$/, "")
const KEY = process.env.SUPABASE_SERVICE_KEY || ""

export const storeEnabled = Boolean(URL_BASE && KEY)

async function rest<T>(path: string, timeoutMs = 6000): Promise<T | null> {
  if (!storeEnabled) return null
  const controller = new AbortController()
  const t = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const res = await fetch(`${URL_BASE}/rest/v1/${path}`, {
      headers: { apikey: KEY, Authorization: `Bearer ${KEY}` },
      cache: "no-store",
      signal: controller.signal,
    })
    if (!res.ok) return null
    return (await res.json()) as T
  } catch {
    return null
  } finally {
    clearTimeout(t)
  }
}

// ─── الأيام الخضراء المخزّنة ─────────────────────────────────────────────────
export async function storedAvailability(
  origin: string,
  destination: string,
  start: string,
  end: string,
): Promise<Record<string, number> | null> {
  const rows = await rest<{ flight_date: string; seats: number }[]>(
    `availability?select=flight_date,seats&origin=eq.${origin}&destination=eq.${destination}` +
      `&flight_date=gte.${start}&flight_date=lte.${end}&limit=400`,
  )
  if (!rows?.length) return null
  const days: Record<string, number> = {}
  for (const r of rows) {
    const d = String(r.flight_date).slice(0, 10)
    days[d] = Math.max(days[d] || 0, Number(r.seats) || 0)
  }
  return days
}

// ─── نتائج البحث المخزّنة ────────────────────────────────────────────────────
// تُدمج أسطر كل الموصّلات (سطر لكل مجموعة خطوط) وتُرتّب بالسعر.
export async function storedFlights(
  origin: string,
  destination: string,
  departDate: string,
  paxKey: string,
  maxAgeHours = 24,
): Promise<{ flights: any[]; updatedAt: string } | null> {
  const rows = await rest<{ payload: any[]; updated_at: string }[]>(
    `flight_cache?select=payload,updated_at&origin=eq.${origin}&destination=eq.${destination}` +
      `&depart_date=eq.${departDate}&pax_key=eq.${encodeURIComponent(paxKey)}&limit=10`,
  )
  if (!rows?.length) return null
  const cutoff = Date.now() - maxAgeHours * 3_600_000
  const usable = rows.filter((r) => new Date(r.updated_at).getTime() >= cutoff)
  if (!usable.length) return null
  const flights = usable.flatMap((r) => (Array.isArray(r.payload) ? r.payload : []))
  if (!flights.length) return null
  flights.sort((a, b) => Number.parseFloat(a?.price?.total ?? "0") - Number.parseFloat(b?.price?.total ?? "0"))
  const newest = usable.reduce((m, r) => (r.updated_at > m ? r.updated_at : m), usable[0].updated_at)
  return { flights, updatedAt: newest }
}
