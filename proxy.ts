/**
 * proxy.ts
 * ─────────────────────────────────────────────────────────────
 * حارس /dashboard — يعمل **قبل** رسم أي صفحة.
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

// كل ما تحت /dashboard عدا صفحة الدخول نفسها. مسارات الـ API تتحقّق
// بنفسها في كل دالة، فلا نضاعف المنطق هنا.
//
// ملف proxy يعمل على Node دائماً (يرفض Next أي إعداد runtime هنا)، وهذا
// ما نريده: متغيّر البيئة يُقرأ وقت الطلب كما يقرأه مسار الدخول. لو اختلفت
// الآليتان لحمل الحارس كلمةً قديمة بعد أي تغيير بلا إعادة نشر — فتنجح في
// تسجيل الدخول ويرفضك الحارس، وتُقفل خارج لوحتك بلا سبب ظاهر.
export const config = {
  matcher: ["/dashboard", "/dashboard/((?!login).*)"],
}
