import { type NextRequest, NextResponse } from "next/server"
import {
  ACCESS_COOKIE,
  REFRESH_COOKIE,
  clearedCookies,
  cookieOptions,
  financeConfigured,
  isFinanceOwner,
  signInWithPassword,
  signOut,
} from "@/lib/finance-session"
import { rateLimit, clientIp, tooMany } from "@/lib/rate-limit"

export const dynamic = "force-dynamic"

export async function POST(request: NextRequest) {
  // خمس محاولات في الدقيقة لكل عنوان، كدخول لوحة العمليات.
  if (!rateLimit(`fin:${clientIp(request.headers)}`, 5, 60_000)) {
    return NextResponse.json(tooMany, { status: 429 })
  }
  if (!financeConfigured) {
    return NextResponse.json(
      { error: "أضف SUPABASE_PUBLISHABLE_KEY في متغيّرات البيئة على Vercel أولاً" },
      { status: 503 },
    )
  }

  const body = await request.json().catch(() => ({}))
  const email = String(body?.email || "").trim()
  const password = String(body?.password || "")
  if (!email || !password) {
    return NextResponse.json({ error: "اكتب البريد وكلمة المرور" }, { status: 400 })
  }

  const result = await signInWithPassword(email, password)
  if (!result.ok) {
    return result.reason === "credentials"
      ? NextResponse.json({ error: "البريد أو كلمة المرور غير صحيحة" }, { status: 401 })
      : NextResponse.json({ error: "تعذّر الاتصال بخدمة الدخول — حاول بعد قليل" }, { status: 502 })
  }

  // حسابٌ صحيح لا يكفي: يجب أن يكون في finance_owners. نرفضه هنا قبل أن
  // نعطيه كعكة، ونُبطل الجلسة التي أصدرها Supabase له للتوّ.
  const { session } = result
  if ((await isFinanceOwner(session.access_token)) !== true) {
    await signOut(session.access_token)
    return NextResponse.json({ error: "هذا الحساب غير مخوّل لقسم المنصرفات" }, { status: 403 })
  }

  const res = NextResponse.json({ ok: true })
  res.cookies.set(ACCESS_COOKIE, session.access_token, cookieOptions())
  res.cookies.set(REFRESH_COOKIE, session.refresh_token, cookieOptions())
  return res
}

export async function DELETE(request: NextRequest) {
  const access = request.cookies.get(ACCESS_COOKIE)?.value
  if (access) await signOut(access)
  const res = NextResponse.json({ ok: true })
  for (const c of clearedCookies) res.cookies.set(c)
  return res
}
