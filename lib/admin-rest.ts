/**
 * lib/admin-rest.ts
 * ─────────────────────────────────────────────────────────────
 * طلبات PostgREST **بجلسة المستخدم** لأقسام /admin — لا بمفتاح الخادم.
 *
 * كل طلب يحمل JWT صاحبه، فلا يعيد Supabase إلا ما تسمح به سياسات RLS
 * له، ولا يقبل إلا ما يُكتب باسمه. نسيان فلترٍ في الكود هنا لا يكشف شيئاً.
 * ─────────────────────────────────────────────────────────────
 */

import { publicKey, supabaseUrl } from "@/lib/admin-session"

/** الرمز مرفوض (منتهٍ أو مزوّر) — المطلوب دخولٌ جديد. */
export class AdminAuthError extends Error {}
/** الرمز سليم لكن صاحبه ليس من أهل القسم — أو RLS رفض الصف. */
export class AdminForbiddenError extends Error {}
/** الصف غير موجود — أو موجود خارج ما يُسمح لك برؤيته، وRLS لا يفرّق عمداً. */
export class AdminNotFoundError extends Error {}

export interface PgFailure {
  status: number
  code: string
  message: string
}

/**
 * mapError يحوّل رفض القاعدة إلى جملة يفهمها المستخدم — لكل قسم قيوده
 * ورسائله. ما لا يعرفه يعيد null فتظهر الرسالة الخام: إخفاؤها يُصعّب
 * التشخيص.
 */
export async function userRest<T>(
  token: string,
  path: string,
  init: RequestInit = {},
  mapError: (f: PgFailure) => string | null = () => null,
  forbidden = "هذا الحساب غير مخوّل لهذا القسم",
): Promise<T> {
  const res = await fetch(`${supabaseUrl()}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: publicKey(),
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...init.headers,
    },
    cache: "no-store",
  })
  const text = await res.text()
  if (res.status === 401) throw new AdminAuthError("انتهت الجلسة — سجّل الدخول من جديد")
  if (!res.ok) {
    let message = text
    let code = ""
    try {
      const j = JSON.parse(text)
      message = j.message || text
      code = j.code || ""
    } catch {}
    if (code === "42501" || res.status === 403) throw new AdminForbiddenError(forbidden)
    // حاجز الحذف الجماعي — رسالته عربية أصلاً وتشرح نفسها
    if (message.includes("عملية جماعية مرفوضة")) throw new Error(message)
    const mapped = mapError({ status: res.status, code, message })
    throw new Error(mapped ?? `خطأ من قاعدة البيانات (${res.status}): ${message.slice(0, 200)}`)
  }
  return (text ? JSON.parse(text) : null) as T
}

// PostgREST في Supabase يقصّ أي ردّ عند ١٠٠٠ صف بصمت. مجموعٌ ناقص بلا
// أي إشارة أسوأ من أن نحتاط.
const PAGE = 1000

/** كل الصفوف عبر صفحات. path بلا limit/offset. */
export async function userRestAll<T>(
  token: string,
  path: string,
  mapError?: (f: PgFailure) => string | null,
  forbidden?: string,
): Promise<T[]> {
  const out: T[] = []
  const sep = path.includes("?") ? "&" : "?"
  for (let offset = 0; ; offset += PAGE) {
    const page = await userRest<T[]>(token, `${path}${sep}limit=${PAGE}&offset=${offset}`, {}, mapError, forbidden)
    out.push(...page)
    if (page.length < PAGE) return out
  }
}
