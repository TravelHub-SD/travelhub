import { type NextRequest, NextResponse } from "next/server"
import { rateLimit, clientIp, tooMany } from "@/lib/rate-limit"
import { connectorUrls, connectorKey } from "@/lib/connector"
import { storedAvailability } from "@/lib/store"

// أيام الإتاحة (الأيام الخضراء) — وسيط لنقطة /availability في الموصّل.
export const dynamic = "force-dynamic"
// استغلال أقصى نافذة تنفيذ في خطة Vercel المجانية (٦٠ث) لأول نداء لمسار جديد.
export const maxDuration = 60

// نمط تجريبي (إثنين/خميس) عند غياب الموصّل — لبيئة التطوير.
function mockDays(start: string, end: string) {
  const days: Record<string, number> = {}
  const d = new Date(`${start}T00:00:00Z`)
  const endD = new Date(`${end}T00:00:00Z`)
  while (d <= endD) {
    if ([1, 4].includes(d.getUTCDay())) days[d.toISOString().slice(0, 10)] = 9
    d.setUTCDate(d.getUTCDate() + 1)
  }
  return days
}

export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams
  const origin = (sp.get("origin") || "").toUpperCase()
  const destination = (sp.get("destination") || "").toUpperCase()
  const start = sp.get("start") || ""
  const end = sp.get("end") || ""

  if (!rateLimit(`av:${clientIp(request.headers)}`, 30, 60_000)) {
    return NextResponse.json(tooMany, { status: 429 })
  }

  const DATE = /^\d{4}-\d{2}-\d{2}$/
  if (!/^[A-Z]{3}$/.test(origin) || !/^[A-Z]{3}$/.test(destination) || !DATE.test(start) || !DATE.test(end)) {
    return NextResponse.json({ error: "معاملات غير صالحة" }, { status: 400 })
  }
  // سقف النطاق: شهران كحد أقصى — يمنع استنزاف الموصّل بطلبات واسعة
  const span = (new Date(end).getTime() - new Date(start).getTime()) / 86_400_000
  if (!(span >= 0 && span <= 62)) {
    return NextResponse.json({ error: "معاملات غير صالحة" }, { status: 400 })
  }

  // ① الخزينة أولاً — رد فوري بلا تشغيل متصفح (الزحف الأسبوعي يملؤها لكل الوجهات)
  const stored = await storedAvailability(origin, destination, start, end)
  if (stored && Object.keys(stored).length) {
    return NextResponse.json({ days: stored, source: "store" })
  }

  // ② لا بيانات مخزّنة → اجلبها حيّاً (وتُخزَّن تلقائياً للمرات القادمة)
  const urls = connectorUrls()
  if (!urls.length) return NextResponse.json({ days: mockDays(start, end), mock: true })

  // استعلام كل الموصّلات بالتوازي ودمج أيامها (موصّل لكل خط ⇒ كل الوجهات).
  const qs = `origin=${origin}&destination=${destination}&start=${start}&end=${end}`
  const fetchOne = async (u: string): Promise<Record<string, number>> => {
    // Vercel المجاني يقطع عند ~٦٠ث. الموصّل يرجّع أيام المتوفّر ضمن مهلة لينة
    // ويكمل الباقي بالخلفية ويخزّنه ٦ ساعات فيصبح المكرّر فورياً.
    const controller = new AbortController()
    const t = setTimeout(() => controller.abort(), 62_000)
    try {
      const res = await fetch(`${u}/availability?${qs}`, {
        headers: { "x-connector-key": connectorKey() },
        cache: "no-store",
        signal: controller.signal,
      })
      if (!res.ok) return {}
      const data = await res.json()
      return (data?.days as Record<string, number>) || {}
    } catch {
      return {}
    } finally {
      clearTimeout(t)
    }
  }

  const settled = await Promise.allSettled(urls.map((u) => fetchOne(u)))
  const days: Record<string, number> = {}
  for (const r of settled) {
    if (r.status !== "fulfilled") continue
    for (const [date, seats] of Object.entries(r.value)) {
      days[date] = Math.max(days[date] || 0, Number(seats) || 0)
    }
  }
  return NextResponse.json({ days })
}
