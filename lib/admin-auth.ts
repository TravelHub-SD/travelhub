/**
 * lib/admin-auth.ts
 * ─────────────────────────────────────────────────────────────
 * قراءة جلسة أقسام /admin في صفحات ومسارات الخادم، ومسارا الدخول والخروج.
 *
 * لا تحقّق هنا من صلاحية الرمز: proxy.ts جدّده إن قارب الانتهاء، وما
 * تبقّى من حكمٍ — هل الرمز سليم؟ هل صاحبه من أهل القسم؟ هل الصف مسموح؟ —
 * تقرّره قاعدة البيانات عند كل طلب. هذا الملف يحمل الرمز إليها فقط.
 * ─────────────────────────────────────────────────────────────
 */

import { cookies } from "next/headers"
import { type NextRequest, NextResponse } from "next/server"
import {
  ACCESS_COOKIE,
  REFRESH_COOKIE,
  adminConfigured,
  clearedCookies,
  cookieOptions,
  hasSectionAccess,
  signInWithPassword,
  signOut,
} from "@/lib/admin-session"
import { SECTIONS, type SectionKey } from "@/lib/admin-sections"
import { AdminAuthError, AdminForbiddenError, AdminNotFoundError } from "@/lib/admin-rest"
import { rateLimit, clientIp, tooMany } from "@/lib/rate-limit"

export async function adminToken(): Promise<string | null> {
  return (await cookies()).get(ACCESS_COOKIE)?.value || null
}

export const NO_SESSION = { error: "انتهت الجلسة — سجّل الدخول من جديد" }

/** خطأ المخزن → ردّ HTTP بحالته الصحيحة، فتعرف الواجهة متى تعيد الدخول. */
export function errorResponse(e: unknown) {
  const message = e instanceof Error ? e.message : String(e)
  const status =
    e instanceof AdminAuthError ? 401 : e instanceof AdminForbiddenError ? 403 : e instanceof AdminNotFoundError ? 404 : 400
  return NextResponse.json({ error: message }, { status })
}

/**
 * مسار الدخول لقسمٍ بعينه. حسابٌ صحيح لا يكفي: يجب أن يكون من أهل
 * القسم، وإلا رُفض قبل أن يأخذ كعكة، وأُبطلت الجلسة التي أصدرها Supabase
 * له للتوّ.
 */
export function loginRoute(key: SectionKey) {
  const section = SECTIONS[key]
  return async function POST(request: NextRequest) {
    // خمس محاولات في الدقيقة لكل عنوان — مفتاحٌ واحد للأقسام كلها، فلا
    // يُضاعف التخمينَ تعددُ صفحات الدخول.
    if (!rateLimit(`admin:${clientIp(request.headers)}`, 5, 60_000)) {
      return NextResponse.json(tooMany, { status: 429 })
    }
    if (!adminConfigured) {
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

    const { session } = result
    if ((await hasSectionAccess(session.access_token, section)) !== true) {
      await signOut(session.access_token)
      return NextResponse.json({ error: section.denied }, { status: 403 })
    }

    const res = NextResponse.json({ ok: true })
    res.cookies.set(ACCESS_COOKIE, session.access_token, cookieOptions())
    res.cookies.set(REFRESH_COOKIE, session.refresh_token, cookieOptions())
    return res
  }
}

/** الخروج يُنهي الجلسة المشتركة — من كل الأقسام معاً. */
export async function logoutRoute(request: NextRequest) {
  const access = request.cookies.get(ACCESS_COOKIE)?.value
  if (access) await signOut(access)
  const res = NextResponse.json({ ok: true })
  for (const c of clearedCookies) res.cookies.set(c)
  return res
}

/** روابط الأقسام الأخرى التي يحقّ لصاحب الجلسة دخولها — لرأس الصفحة. */
export async function otherSections(token: string, current: SectionKey) {
  const others = Object.values(SECTIONS).filter((s) => s.key !== current)
  const allowed = await Promise.all(others.map((s) => hasSectionAccess(token, s)))
  return others.filter((_, i) => allowed[i] === true).map((s) => ({ href: s.home, label: s.title }))
}
