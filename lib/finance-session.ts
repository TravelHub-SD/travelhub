/**
 * lib/finance-session.ts
 * ─────────────────────────────────────────────────────────────
 * جلسة قسم المنصرفات الشخصية — Supabase Auth عبر REST مباشرة، بلا SDK،
 * كبقيّة المشروع.
 *
 * لماذا Supabase Auth هنا لا كلمة مرور اللوحة: قاعدة البيانات لا تعرف
 * من صاحب الطلب إلا من JWT صادرٍ عنها. بالجلسة الحقيقية يصير
 * auth.uid() هو المستخدم فعلاً، فيرفض RLS أي صفٍّ ليس له — بينما مفتاح
 * service_role الذي تستعمله اللوحة يتجاوز RLS كلّه.
 *
 * هذا الملف بلا next/headers عمداً: يستورده proxy.ts أيضاً.
 * ─────────────────────────────────────────────────────────────
 */

export const ACCESS_COOKIE = "th_fin_at"
export const REFRESH_COOKIE = "th_fin_rt"

const URL_BASE = (process.env.SUPABASE_URL || "").replace(/\/$/, "")
// المفتاح العام (publishable / anon). ليس سرّاً بطبيعته، لكنه يبقى على
// الخادم هنا: المتصفح لا يكلّم Supabase أبداً في هذا القسم.
const PUBLIC_KEY = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY || ""

export const financeConfigured = Boolean(URL_BASE && PUBLIC_KEY)

export function supabaseUrl(): string {
  return URL_BASE
}
export function publicKey(): string {
  return PUBLIC_KEY
}

export interface Session {
  access_token: string
  refresh_token: string
  expires_in: number
}

// شهر، كلوحة العمليات: الاستعمال يومي من الموبايل. انتهاء الجلسة الفعلي
// يحكمه exp داخل الـ JWT لا عمر الكعكة.
const COOKIE_MAX_AGE = 60 * 60 * 24 * 30

export function cookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: COOKIE_MAX_AGE,
  }
}

export const clearedCookies = [
  { name: ACCESS_COOKIE, value: "", path: "/", maxAge: 0 },
  { name: REFRESH_COOKIE, value: "", path: "/", maxAge: 0 },
]

/**
 * موعد انتهاء الـ JWT. يُقرأ بلا تحقّق من التوقيع، وهذا مقصود: يُستعمل
 * لتقرير **متى نجدّد** فقط. التحقّق الفعلي يجريه Supabase عند كل طلب —
 * توقيعٌ مزوّر يمرّ من هنا ثم يُرفض هناك بلا بيانات.
 */
export function tokenExpiry(jwt: string): number {
  try {
    const part = jwt.split(".")[1]
    const json = JSON.parse(atob(part.replace(/-/g, "+").replace(/_/g, "/")))
    return typeof json.exp === "number" ? json.exp : 0
  } catch {
    return 0
  }
}

/** صالح لدقيقة أخرى على الأقل؟ الهامش يمنع انتهاءه في منتصف الطلب. */
export function isFresh(jwt: string | undefined): boolean {
  if (!jwt) return false
  return tokenExpiry(jwt) - 60 > Date.now() / 1000
}

async function authRequest(path: string, init: RequestInit): Promise<Response> {
  return fetch(`${URL_BASE}/auth/v1/${path}`, {
    ...init,
    headers: { apikey: PUBLIC_KEY, "Content-Type": "application/json", ...init.headers },
    cache: "no-store",
  })
}

export type SignInResult =
  | { ok: true; session: Session }
  | { ok: false; reason: "credentials" | "unavailable" }

export async function signInWithPassword(email: string, password: string): Promise<SignInResult> {
  let res: Response
  try {
    res = await authRequest("token?grant_type=password", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    })
  } catch {
    return { ok: false, reason: "unavailable" }
  }
  // ٤٠٠ = بيانات خاطئة (أو بريد غير مؤكَّد). لا نفرّق بينهما للمستخدم:
  // التفريق يخبر المخمّن أيّ البريدين موجود.
  if (res.status === 400) return { ok: false, reason: "credentials" }
  if (!res.ok) return { ok: false, reason: "unavailable" }
  const json = await res.json()
  return { ok: true, session: json as Session }
}

/**
 * تجديد الجلسة. Supabase يُبطل رمز التجديد بعد استعماله ويصدر غيره،
 * فالكعكتان تُكتبان معاً دائماً. null = الجلسة انتهت فعلاً (أُبطلت أو
 * سُجّل خروج) والمطلوب دخولٌ جديد.
 */
export async function refreshSession(refreshToken: string): Promise<Session | null> {
  try {
    const res = await authRequest("token?grant_type=refresh_token", {
      method: "POST",
      body: JSON.stringify({ refresh_token: refreshToken }),
    })
    if (!res.ok) return null
    return (await res.json()) as Session
  } catch {
    return null
  }
}

/** إبطال الجلسة عند Supabase. أفضل جهد: الكعكات تُمسح في كل الأحوال. */
export async function signOut(accessToken: string): Promise<void> {
  try {
    await authRequest("logout", { method: "POST", headers: { Authorization: `Bearer ${accessToken}` } })
  } catch {}
}

/**
 * هل صاحب الجلسة مالكٌ مسجَّل في finance_owners؟ يسأل القاعدة بجلسته
 * هو، فالجواب عنه وحده. null = الرمز نفسه مرفوض (مزوّر أو منتهٍ).
 */
export async function isFinanceOwner(accessToken: string): Promise<boolean | null> {
  try {
    const res = await fetch(`${URL_BASE}/rest/v1/rpc/is_finance_owner`, {
      method: "POST",
      headers: { apikey: PUBLIC_KEY, Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: "{}",
      cache: "no-store",
    })
    if (res.status === 401) return null
    if (!res.ok) return false
    return (await res.json()) === true
  } catch {
    return false
  }
}

/** وجهة ما بعد الدخول — داخل القسم فقط، فلا يصير الرابط تحويلاً مفتوحاً. */
export function safeNext(next: string | null | undefined): string {
  const fallback = "/admin/finances/personal"
  if (!next || !next.startsWith("/admin/finances/") || next.startsWith("//")) return fallback
  if (next.startsWith("/admin/finances/login")) return fallback
  return next
}
