import { type NextRequest, NextResponse } from "next/server"

// هدف Vercel Cron — يشغّل تسخين الكاش للمسارات الشائعة على الموصّل.
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

  const url = process.env.SUDAN_CONNECTOR_URL
  if (!url) return NextResponse.json({ ok: false, reason: "no connector" })

  try {
    const res = await fetch(`${url.replace(/\/$/, "")}/warm`, {
      method: "POST",
      headers: { "x-connector-key": process.env.CONNECTOR_API_KEY ?? "" },
      cache: "no-store",
    })
    return NextResponse.json({ ok: res.ok, connector: await res.json().catch(() => null) })
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : String(e) })
  }
}
