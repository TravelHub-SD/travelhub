import { NextResponse } from "next/server"

// أداة فحص مؤقتة — تُمرّر لنقطة /inspect في الموصّل لقراءة عناصر الركاب والتقويم.
export const dynamic = "force-dynamic"

export async function GET() {
  const url = process.env.SUDAN_CONNECTOR_URL
  if (!url) return NextResponse.json({ error: "الموصّل غير مضبوط (SUDAN_CONNECTOR_URL)" })
  try {
    const res = await fetch(`${url.replace(/\/$/, "")}/inspect`, {
      headers: { "x-connector-key": process.env.CONNECTOR_API_KEY ?? "" },
      cache: "no-store",
    })
    return NextResponse.json(await res.json())
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) })
  }
}
