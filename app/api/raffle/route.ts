import { type NextRequest, NextResponse } from "next/server"
import { addEntry, entryCount } from "@/lib/raffle-store"
import { rateLimit, clientIp, tooMany } from "@/lib/rate-limit"

export const dynamic = "force-dynamic"

// تطبيع رقم موبايل سوداني → 2499XXXXXXXX (يقبل 09.. / +2499.. / 2491.. إلخ)
function normalizePhone(raw: string): string | null {
  let p = String(raw).replace(/[\s\-()]/g, "")
  if (p.startsWith("+")) p = p.slice(1)
  if (p.startsWith("00")) p = p.slice(2)
  if (p.startsWith("249")) p = p.slice(3)
  if (p.startsWith("0")) p = p.slice(1)
  // الشبكات السودانية: يبدأ بـ 9 أو 1 + ثمانية أرقام
  if (!/^[91]\d{8}$/.test(p)) return null
  return `249${p}`
}

export async function GET() {
  // عدد المشاركين فقط (إثبات اجتماعي) — بلا أي بيانات شخصية
  try {
    return NextResponse.json({ total: await entryCount() })
  } catch {
    return NextResponse.json({ total: 0 })
  }
}

export async function POST(request: NextRequest) {
  if (!rateLimit(`raf:${clientIp(request.headers)}`, 5, 60_000)) {
    return NextResponse.json(tooMany, { status: 429 })
  }
  try {
    const body = await request.json().catch(() => null)
    const name = String(body?.name || "")
      .replace(/[<>]/g, "")
      .trim()
      .slice(0, 60)
    const phone = normalizePhone(String(body?.phone || ""))

    if (name.length < 2) {
      return NextResponse.json({ error: "اكتب اسمك الكامل" }, { status: 400 })
    }
    if (!phone) {
      return NextResponse.json({ error: "اكتب رقم واتساب سوداني صحيح (مثل 09xxxxxxxx)" }, { status: 400 })
    }

    const { added, total } = await addEntry({ name, phone, at: new Date().toISOString() })
    return NextResponse.json({ ok: true, duplicate: !added, total })
  } catch (e) {
    console.error("[raffle] enter error:", e)
    return NextResponse.json({ error: "تعذّر التسجيل الآن — حاول بعد قليل" }, { status: 500 })
  }
}
