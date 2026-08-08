import { NextResponse } from "next/server"
import { rateLimit, tooMany } from "@/lib/rate-limit"
import { headers } from "next/headers"
import { connectorUrls, connectorKey } from "@/lib/connector"

// قائمة احتياطية سودانية لو الموصّل غير مضبوط (بيئة التطوير مثلاً).
const FALLBACK = [
  { code: "KRT", name: "Khartoum" },
  { code: "PZU", name: "Port Sudan" },
  { code: "DOG", name: "Dongola" },
  { code: "UYL", name: "Nyala" },
  { code: "ELF", name: "El Fasher" },
  { code: "EBD", name: "El Obeid" },
  { code: "CAI", name: "Cairo" },
  { code: "JED", name: "Jeddah" },
  { code: "DXB", name: "Dubai" },
  { code: "DOH", name: "Doha" },
  { code: "IST", name: "Istanbul" },
  { code: "ADD", name: "Addis Ababa" },
  { code: "JUB", name: "Juba" },
]

// قائمة مطارات النظام للقوائم المنسدلة — نداء الموصّل نفسه مُخزَّن مؤقتاً ساعة.
export const dynamic = "force-dynamic"

export async function GET() {
  const h = await headers()
  const ip = (h.get("x-forwarded-for") || "").split(",")[0].trim() || "anon"
  if (!rateLimit(`ap:${ip}`, 30, 60_000)) {
    return NextResponse.json(tooMany, { status: 429 })
  }
  const urls = connectorUrls()
  if (!urls.length) return NextResponse.json({ airports: FALLBACK })

  // كل موصّل يعرف مطارات خطه فقط — نستعلمهم جميعاً ونوحّد القائمة (بلا تكرار).
  const fetchOne = async (u: string): Promise<{ code: string; name: string }[]> => {
    try {
      const res = await fetch(`${u}/airports`, {
        headers: { "x-connector-key": connectorKey() },
        next: { revalidate: 3600 },
      })
      if (!res.ok) return []
      const data = await res.json()
      return Array.isArray(data) ? data : []
    } catch {
      return []
    }
  }

  try {
    const settled = await Promise.allSettled(urls.map((u) => fetchOne(u)))
    const byCode = new Map<string, { code: string; name: string }>()
    for (const r of settled) {
      if (r.status !== "fulfilled") continue
      for (const a of r.value) {
        if (a && typeof a.code === "string" && !byCode.has(a.code)) byCode.set(a.code, a)
      }
    }
    const airports = byCode.size
      ? Array.from(byCode.values()).sort((a, b) => a.name.localeCompare(b.name))
      : FALLBACK
    return NextResponse.json({ airports })
  } catch {
    return NextResponse.json({ airports: FALLBACK })
  }
}
