import { type NextRequest, NextResponse } from "next/server"
import { checkPassword, sessionCookie, clearedCookie, dashboardConfigured } from "@/lib/dashboard-auth"
import { rateLimit, clientIp, tooMany } from "@/lib/rate-limit"

export const dynamic = "force-dynamic"

export async function POST(request: NextRequest) {
  // خمس محاولات في الدقيقة لكل عنوان: يكفي لمن نسي كلمته، ولا يكفي للتخمين.
  if (!rateLimit(`dash:${clientIp(request.headers)}`, 5, 60_000)) {
    return NextResponse.json(tooMany, { status: 429 })
  }
  if (!dashboardConfigured) {
    return NextResponse.json({ error: "أضف DASHBOARD_PASSWORD في متغيّرات البيئة أولاً" }, { status: 503 })
  }

  const body = await request.json().catch(() => ({}))
  if (!checkPassword(String(body?.password || ""))) {
    return NextResponse.json({ error: "كلمة المرور غير صحيحة" }, { status: 401 })
  }

  const res = NextResponse.json({ ok: true })
  res.cookies.set(sessionCookie())
  return res
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true })
  res.cookies.set(clearedCookie)
  return res
}
