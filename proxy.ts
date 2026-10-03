/**
 * proxy.ts
 * ─────────────────────────────────────────────────────────────
 * حارس /dashboard و/admin/finances — يعمل **قبل** رسم أي صفحة.
 * (كان اسمه middleware؛ Next 16 يسمّي هذا الملف proxy.)
 *
 * لماذا هنا لا في الـ layout: redirect() داخل layout لا يمنع رسم
 * الصفحة في App Router. المتصفح يطيع التحويل فلا يرى المستخدم شيئاً،
 * لكن الردّ الخام (curl مثلاً) يصل بحالة 200 ومعه بيانات العمليات
 * الحقيقية. اختُبر ذلك فعلياً: صفٌّ بقيمة 987,654,321 ظهر في ردّ
 * /dashboard بلا أي كعكة، وبكعكة مزوّرة أيضاً.
 *
 * هذا الملف يردّ بتحويل بلا رسم، فلا شيء يُسرَّب أصلاً.
 * حارس الـ layout باقٍ كطبقة ثانية.
 *
 * نستعمل Web Crypto لا node:crypto لأن هذا الملف قد يعمل على حافة
 * الشبكة حيث لا وجود لوحدات node.
 */

import { type NextRequest, NextResponse } from "next/server"
import {
  ACCESS_COOKIE,
  REFRESH_COOKIE,
  clearedCookies,
  cookieOptions,
  isFresh,
  refreshSession,
} from "@/lib/finance-session"

const COOKIE = "th_dash"
const MESSAGE = "travelhub-dashboard-v1"

async function expectedToken(password: string): Promise<string> {
  const enc = new TextEncoder()
  const key = await crypto.subtle.importKey("raw", enc.encode(password), { name: "HMAC", hash: "SHA-256" }, false, [
    "sign",
  ])
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(MESSAGE))
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("")
}

/** مقارنة ثابتة الزمن — لا تتوقّف عند أول حرف مختلف. */
function sameToken(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

export async function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname
  if (path.startsWith("/admin/finances") || path.startsWith("/api/admin/finances")) {
    return financeGuard(request)
  }
  return dashboardGuard(request)
}

async function dashboardGuard(request: NextRequest) {
  const password = process.env.DASHBOARD_PASSWORD
  const cookie = request.cookies.get(COOKIE)?.value

  if (password && cookie && sameToken(cookie, await expectedToken(password))) {
    return NextResponse.next()
  }

  const url = request.nextUrl.clone()
  url.pathname = "/dashboard/login"
  url.search = ""
  return NextResponse.redirect(url)
}

/**
 * حارس قسم المنصرفات الشخصية.
 *
 * عمله الأساسي **تجديد** الجلسة لا الحكم عليها: رمز الدخول في Supabase
 * يعيش ساعة، وصفحات الخادم لا تستطيع كتابة الكعكات. فإن قارب الرمز
 * الانتهاء نجدّده هنا، ونمرّر الجديد إلى الصفحة في نفس الطلب وإلى
 * المتصفح في الردّ — وإلا لطُرد المستخدم كل ساعة.
 *
 * أمّا من يُسمح له فتقرّره قاعدة البيانات نفسها عند كل قراءة: RLS
 * على auth.uid() وقائمة finance_owners. رمزٌ مزوّر يعبر هذا الحارس
 * (لا نتحقّق من توقيعه هنا) ثم يُرفض هناك بلا صفٍّ واحد.
 */
async function financeGuard(request: NextRequest) {
  const path = request.nextUrl.pathname
  const isApi = path.startsWith("/api/")
  // صفحة الدخول ومسارها لا يحتاجان جلسة — هما طريق الحصول عليها.
  if (path === "/admin/finances/login" || path === "/api/admin/finances/auth") {
    return NextResponse.next()
  }

  const access = request.cookies.get(ACCESS_COOKIE)?.value
  if (isFresh(access)) return NextResponse.next()

  const refresh = request.cookies.get(REFRESH_COOKIE)?.value
  const session = refresh ? await refreshSession(refresh) : null

  if (session) {
    // الكعكة على الطلب تصل الصفحة الآن؛ وعلى الردّ تصل المتصفح للطلبات التالية.
    request.cookies.set(ACCESS_COOKIE, session.access_token)
    request.cookies.set(REFRESH_COOKIE, session.refresh_token)
    const res = NextResponse.next({ request })
    res.cookies.set(ACCESS_COOKIE, session.access_token, cookieOptions())
    res.cookies.set(REFRESH_COOKIE, session.refresh_token, cookieOptions())
    return res
  }

  const res = isApi
    ? NextResponse.json({ error: "انتهت الجلسة — سجّل الدخول من جديد" }, { status: 401 })
    : (() => {
        const url = request.nextUrl.clone()
        url.pathname = "/admin/finances/login"
        url.search = ""
        url.searchParams.set("next", path)
        return NextResponse.redirect(url)
      })()
  // كعكاتٌ ميتة تُمسح، فلا تُعاد محاولة تجديدها في كل طلب.
  if (access || refresh) for (const c of clearedCookies) res.cookies.set(c)
  return res
}

// لوحة العمليات: كل ما تحت /dashboard عدا صفحة الدخول نفسها. مسارات
// الـ API هناك تتحقّق بنفسها في كل دالة، فلا نضاعف المنطق.
//
// المنصرفات: الصفحات **ومساراتها** معاً، لأن التجديد هنا لا الحكم —
// طلب حفظٍ برمزٍ انتهى قبل دقيقة يجب أن يُجدَّد لا أن يفشل.
//
// ملف proxy يعمل على Node دائماً (يرفض Next أي إعداد runtime هنا)، وهذا
// ما نريده: متغيّر البيئة يُقرأ وقت الطلب كما يقرأه مسار الدخول. لو اختلفت
// الآليتان لحمل الحارس كلمةً قديمة بعد أي تغيير بلا إعادة نشر — فتنجح في
// تسجيل الدخول ويرفضك الحارس، وتُقفل خارج لوحتك بلا سبب ظاهر.
export const config = {
  matcher: [
    "/dashboard",
    "/dashboard/((?!login).*)",
    "/admin/finances",
    "/admin/finances/:path*",
    "/api/admin/finances/:path*",
  ],
}
