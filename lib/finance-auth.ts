/**
 * lib/finance-auth.ts
 * ─────────────────────────────────────────────────────────────
 * قراءة جلسة المنصرفات في صفحات ومسارات الخادم.
 *
 * لا تحقّق هنا من صلاحية الرمز: proxy.ts جدّده إن قارب الانتهاء، وما
 * تبقّى من حكمٍ — هل الرمز سليم؟ هل صاحبه مالك؟ هل الصف له؟ — تقرّره
 * قاعدة البيانات عند كل طلب. هذا الملف يحمل الرمز إليها فقط.
 * ─────────────────────────────────────────────────────────────
 */

import { cookies } from "next/headers"
import { NextResponse } from "next/server"
import { ACCESS_COOKIE } from "@/lib/finance-session"
import { FinanceAuthError, FinanceForbiddenError, FinanceNotFoundError } from "@/lib/finance-store"

export async function financeToken(): Promise<string | null> {
  return (await cookies()).get(ACCESS_COOKIE)?.value || null
}

export const NO_SESSION = { error: "انتهت الجلسة — سجّل الدخول من جديد" }

/** خطأ المخزن → ردّ HTTP بحالته الصحيحة، فتعرف الواجهة متى تعيد الدخول. */
export function errorResponse(e: unknown) {
  const message = e instanceof Error ? e.message : String(e)
  const status =
    e instanceof FinanceAuthError ? 401 : e instanceof FinanceForbiddenError ? 403 : e instanceof FinanceNotFoundError ? 404 : 400
  return NextResponse.json({ error: message }, { status })
}
