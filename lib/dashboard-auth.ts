/**
 * lib/dashboard-auth.ts
 * ─────────────────────────────────────────────────────────────
 * حماية الداشبورد بكلمة مرور واحدة (DASHBOARD_PASSWORD).
 *
 * كلمة المرور لا تُخزَّن في المتصفح ولا تمرّ في أي طلب بعد الدخول:
 * نضع بدلها كعكة httpOnly قيمتها بصمة HMAC للكلمة. لا يقرأها
 * جافاسكربت (فلا تُسرق بـ XSS) ولا تُزوَّر بلا معرفة الكلمة نفسها.
 * تغيير كلمة المرور يُبطل كل الجلسات تلقائياً.
 */

import { createHmac, timingSafeEqual } from "node:crypto"
import { cookies } from "next/headers"

const COOKIE = "th_dash"
const MESSAGE = "travelhub-dashboard-v1"
const MAX_AGE = 60 * 60 * 24 * 30 // شهر — الاستعمال يومي من الموبايل

export const dashboardConfigured = Boolean(process.env.DASHBOARD_PASSWORD)

function token(password: string): string {
  return createHmac("sha256", password).update(MESSAGE).digest("hex")
}

/** مقارنة ثابتة الزمن — لا تُسرّب طول التطابق. */
function sameToken(a: string, b: string): boolean {
  const A = Buffer.from(a)
  const B = Buffer.from(b)
  return A.length === B.length && timingSafeEqual(A, B)
}

export function checkPassword(provided: string): boolean {
  const expected = process.env.DASHBOARD_PASSWORD || ""
  if (!expected) return false
  // نقارن البصمتين لا الكلمتين: يوحّد الطول فلا يتسرّب طول الكلمة.
  return sameToken(token(provided), token(expected))
}

export function sessionCookie() {
  return {
    name: COOKIE,
    value: token(process.env.DASHBOARD_PASSWORD || ""),
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: MAX_AGE,
  }
}

export const clearedCookie = { name: COOKIE, value: "", path: "/", maxAge: 0 }

/** هل الطلب الحالي مسجَّل دخوله؟ للاستعمال في صفحات ومسارات الخادم. */
export async function isSignedIn(): Promise<boolean> {
  const expected = process.env.DASHBOARD_PASSWORD
  if (!expected) return false
  const value = (await cookies()).get(COOKIE)?.value
  return Boolean(value) && sameToken(value!, token(expected))
}
