import { NextResponse } from "next/server"

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

// قائمة مطارات النظام للقوائم المنسدلة — تُخزَّن مؤقتاً على الحافة.
export const revalidate = 3600

export async function GET() {
  const url = process.env.SUDAN_CONNECTOR_URL
  if (!url) return NextResponse.json({ airports: FALLBACK })

  try {
    const res = await fetch(`${url.replace(/\/$/, "")}/airports`, {
      headers: { "x-connector-key": process.env.CONNECTOR_API_KEY ?? "" },
      next: { revalidate: 3600 },
    })
    if (!res.ok) return NextResponse.json({ airports: FALLBACK })
    const data = await res.json()
    const airports = Array.isArray(data) && data.length ? data : FALLBACK
    return NextResponse.json({ airports })
  } catch {
    return NextResponse.json({ airports: FALLBACK })
  }
}
