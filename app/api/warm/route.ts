import { type NextRequest, NextResponse } from "next/server"
import { connectorUrls, connectorKey } from "@/lib/connector"

// هدف Vercel Cron — يشغّل تسخين الكاش للمسارات الشائعة على كل الموصّلات.
// محميّ: Vercel يرسل Authorization: Bearer $CRON_SECRET تلقائياً للمهام المجدولة.
export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (secret) {
    const auth = request.headers.get("authorization")
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 })
    }
  }

  const urls = connectorUrls()
  if (!urls.length) return NextResponse.json({ ok: false, reason: "no connector" })

  const warmOne = async (u: string) => {
    try {
      const res = await fetch(`${u}/warm`, {
        method: "POST",
        headers: { "x-connector-key": connectorKey() },
        cache: "no-store",
      })
      return res.ok
    } catch {
      return false
    }
  }

  const settled = await Promise.all(urls.map((u) => warmOne(u)))
  const ok = settled.filter(Boolean).length
  return NextResponse.json({ ok: ok === urls.length, warmed: `${ok}/${urls.length}` })
}
