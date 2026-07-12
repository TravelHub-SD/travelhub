import { NextResponse } from "next/server"

// نقطة مراقبة موحّدة: 200 عندما الموقع والموصّل بخير، و503 عند تعطّل الموصّل.
// تُراقب بواسطة UptimeRobot ونحوها لإرسال تنبيه (واتساب/إيميل) عند العطل.
export const dynamic = "force-dynamic"

export async function GET() {
  const url = process.env.SUDAN_CONNECTOR_URL
  if (!url) return NextResponse.json({ ok: true, connector: "not-configured" })

  try {
    const controller = new AbortController()
    const t = setTimeout(() => controller.abort(), 6000)
    const res = await fetch(`${url.replace(/\/$/, "")}/health`, {
      signal: controller.signal,
      cache: "no-store",
    })
    clearTimeout(t)
    if (!res.ok) throw new Error(String(res.status))
    return NextResponse.json({ ok: true, connector: "up" })
  } catch {
    return NextResponse.json({ ok: false, connector: "down" }, { status: 503 })
  }
}
