import { type NextRequest, NextResponse } from "next/server"
import { isSignedIn } from "@/lib/dashboard-auth"
import { setUsdRate, usdRateFor } from "@/lib/dashboard-store"

export const dynamic = "force-dynamic"

const DENIED = NextResponse.json({ error: "غير مصرّح" }, { status: 401 })
const msg = (e: unknown) => (e instanceof Error ? e.message : String(e))
const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/

export async function GET(request: NextRequest) {
  if (!(await isSignedIn())) return DENIED
  const month = request.nextUrl.searchParams.get("month") || ""
  if (!MONTH.test(month)) return NextResponse.json({ error: "الشهر مطلوب بصيغة YYYY-MM" }, { status: 400 })
  try {
    return NextResponse.json(await usdRateFor(month))
  } catch (e) {
    return NextResponse.json({ error: msg(e) }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  if (!(await isSignedIn())) return DENIED
  const body = await request.json().catch(() => ({}))

  const month = String(body?.month || "")
  if (!MONTH.test(month)) return NextResponse.json({ error: "الشهر مطلوب بصيغة YYYY-MM" }, { status: 400 })

  // نقبل "3,650" كما تُكتب عادةً، ونرفض الكسور: كل المبالغ في اللوحة صحيحة.
  const raw = String(body?.rate ?? "").replace(/[,\s]/g, "")
  const rate = Number(raw)
  if (!Number.isInteger(rate) || rate <= 0) {
    return NextResponse.json({ error: "سعر الدولار يجب أن يكون رقماً صحيحاً أكبر من صفر" }, { status: 400 })
  }

  try {
    return NextResponse.json({ row: await setUsdRate(month, rate) })
  } catch (e) {
    return NextResponse.json({ error: msg(e) }, { status: 400 })
  }
}
