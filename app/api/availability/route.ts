import { type NextRequest, NextResponse } from "next/server"

// أيام الإتاحة (الأيام الخضراء) — وسيط لنقطة /availability في الموصّل.
export const dynamic = "force-dynamic"

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

  if (!/^[A-Z]{3}$/.test(origin) || !/^[A-Z]{3}$/.test(destination) || !start || !end) {
    return NextResponse.json({ error: "origin, destination, start, end مطلوبة" }, { status: 400 })
  }

  const url = process.env.SUDAN_CONNECTOR_URL
  if (!url) return NextResponse.json({ days: mockDays(start, end), mock: true })

  try {
    const res = await fetch(
      `${url.replace(/\/$/, "")}/availability?origin=${origin}&destination=${destination}&start=${start}&end=${end}`,
      { headers: { "x-connector-key": process.env.CONNECTOR_API_KEY ?? "" }, cache: "no-store" },
    )
    if (!res.ok) return NextResponse.json({ days: {}, warnings: [`connector HTTP ${res.status}`] })
    const data = await res.json()
    return NextResponse.json({ days: data.days || {}, warnings: data.warnings })
  } catch (e) {
    return NextResponse.json({ days: {}, warnings: [e instanceof Error ? e.message : String(e)] })
  }
}
