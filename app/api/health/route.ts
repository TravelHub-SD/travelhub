import { NextResponse } from "next/server"
import { connectorUrls } from "@/lib/connector"

// نقطة مراقبة موحّدة: 200 عندما الموقع وكل الموصّلات بخير، و503 عند تعطّل أحدها.
// تُراقب بواسطة UptimeRobot ونحوها لإرسال تنبيه (واتساب/إيميل) عند العطل.
export const dynamic = "force-dynamic"

async function ping(url: string): Promise<boolean> {
  try {
    const controller = new AbortController()
    const t = setTimeout(() => controller.abort(), 6000)
    const res = await fetch(`${url}/health`, { signal: controller.signal, cache: "no-store" }).finally(() =>
      clearTimeout(t),
    )
    return res.ok
  } catch {
    return false
  }
}

export async function GET() {
  const urls = connectorUrls()
  if (!urls.length) return NextResponse.json({ ok: true, connector: "not-configured" })

  const settled = await Promise.all(urls.map((u) => ping(u)))
  const up = settled.filter(Boolean).length
  const allUp = up === urls.length
  return NextResponse.json(
    { ok: allUp, connectors: `${up}/${urls.length}` },
    { status: allUp ? 200 : 503 },
  )
}
