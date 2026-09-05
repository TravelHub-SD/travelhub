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

// ─── مطارات النظام المخزّنة ──────────────────────────────────────────────────
// تُقرأ فوراً حتى والموصّل نائم، فلا ينتظر الزائر تحميل القوائم.
export async function storedAirports(): Promise<{ code: string; name: string }[] | null> {
  const rows = await rest<{ code: string; name: string }[]>("airports?select=code,name&order=name.asc&limit=500")
  return rows?.length ? rows : null
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
//
// نافذة الصلاحية ٢٤ ساعة: السعر المعروض لا يشيخ أكثر من يوم.
//
// كانت ٧٢ ساعة أيام الموصّل الواحد، لأن البحث الحيّ وقتها كان يستغرق ~٦٠ث
// (الخطوط الثلاثة تتناوب على متصفح واحد) فكان تقديم صف قديم أفضل من إسقاط
// الزائر في انتظار طويل. مع الموصّلات الثلاثة المتوازية عاد البحث الحيّ إلى
// ~٢٠ث، فصار الرجوع إليه رخيصاً — والأولوية للسعر الأحدث لا للأسرع.
//
// كل بحث حيّ يكتب نتيجته هنا، فالصف يتجدّد بزيارات الناس لا بالزحف الليلي وحده.
export async function storedFlights(
  origin: string,
  destination: string,
  departDate: string,
  paxKey: string,
  maxAgeHours = 24,
  abandonHours = 168,
): Promise<{ flights: any[]; updatedAt: string } | null> {
  const rows = await rest<{ payload: any[]; updated_at: string }[]>(
    `flight_cache?select=payload,updated_at&origin=eq.${origin}&destination=eq.${destination}` +
      `&depart_date=eq.${departDate}&pax_key=eq.${encodeURIComponent(paxKey)}&limit=10`,
  )
  if (!rows?.length) return null

  // مع الموصّلات المقسّمة يكتب كل موصّل صفّه (صف لكل خط). لو صفٌّ واحد بائت
  // فنتيجة الخزينة ناقصة خطاً كاملاً — والزائر لا يرى أنها ناقصة. فإمّا أن
  // تكون كل الصفوف طازجة أو نذهب للبحث الحيّ (وهو ~٢٠ث الآن، ثمن مقبول).
  //
  // وصفٌّ تجاوز أسبوعاً لا يُعدّ بائتاً بل مهجوراً: خطٌّ توقّف عن خدمة هذا
  // المسار. لو عاملناه كبائت لظلّ يدفع كل بحث إلى المتصفح إلى الأبد، فلا
  // شيء سيحدّثه — الزحف لا يكتب صفّاً لخطٍّ بلا رحلات. فنُسقطه من الحساب.
  const now = Date.now()
  const live = rows.filter((r) => now - new Date(r.updated_at).getTime() < abandonHours * 3_600_000)
  if (!live.length) return null

  const cutoff = now - maxAgeHours * 3_600_000
  if (live.some((r) => new Date(r.updated_at).getTime() < cutoff)) return null

  const flights = live.flatMap((r) => (Array.isArray(r.payload) ? r.payload : []))
  if (!flights.length) return null
  flights.sort((a, b) => Number.parseFloat(a?.price?.total ?? "0") - Number.parseFloat(b?.price?.total ?? "0"))
  // نُرجع عمر **أقدم** صف لا أحدثه: النتيجة مدموجة من صفوف الموصّلات، فصدقها
  // محكوم بأقلّها طزاجة. المبالغة هنا تعني إخبار الزائر أن السعر أحدث مما هو.
  const oldest = live.reduce((m, r) => (r.updated_at < m ? r.updated_at : m), live[0].updated_at)
  return { flights, updatedAt: oldest }
}
