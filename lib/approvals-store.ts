/**
 * lib/approvals-store.ts
 * ─────────────────────────────────────────────────────────────
 * قراءة وكتابة الموافقات الأمنية — بجلسة المستخدم، وRLS يقرّر.
 * الجدول للفريق: كل من في approvals_staff يرى كل الطلبات ويديرها.
 * ─────────────────────────────────────────────────────────────
 */

import { AdminNotFoundError, userRest, userRestAll, type PgFailure } from "@/lib/admin-rest"

export { STATUSES, type Approval, type ApprovalInput, type ApprovalStatus } from "@/lib/approvals-format"
import type { Approval, ApprovalInput } from "@/lib/approvals-format"

const DENIED = "هذا الحساب غير مخوّل لإدارة الموافقات"

function approvalError(f: PgFailure): string | null {
  if (f.message.includes("paid_within_price")) return "المدفوع أكبر من سعر البيع"
  if (f.message.includes("status_valid")) return "حالة غير معروفة"
  if (f.message.includes("full_name_check")) return "الاسم مطلوب (حرفان على الأقل)"
  if (f.message.includes("passport_no_check")) return "رقم الجواز مطلوب"
  if (f.message.includes("_price_check") || f.message.includes("paid_amount_check")) return "المبالغ لا تكون سالبة"
  if (f.code === "22P02") return "قيمة غير صالحة"
  return null
}

function rest<T>(token: string, path: string, init: RequestInit = {}): Promise<T> {
  return userRest<T>(token, path, init, approvalError, DENIED)
}

const COLUMNS =
  "id,full_name,passport_no,phone,agent,apply_date,status,approval_ref,sale_price,cost_price,paid_amount,notes,legacy_id,created_at,updated_at"

/** كل الطلبات، الأحدث أولاً. الفلترة والبحث في المتصفح: آلاف الصفوف لا تُثقل. */
export async function listApprovals(token: string): Promise<Approval[]> {
  const rows = await userRestAll<Approval>(
    token,
    `security_approvals?select=${COLUMNS}&order=apply_date.desc,created_at.desc`,
    approvalError,
    DENIED,
  )
  // numeric يصل من PostgREST رقماً؛ نضمن ذلك قبل أي جمع.
  return rows.map((r) => ({
    ...r,
    sale_price: Number(r.sale_price),
    cost_price: Number(r.cost_price),
    paid_amount: Number(r.paid_amount),
  }))
}

export async function createApproval(token: string, input: ApprovalInput): Promise<Approval> {
  const rows = await rest<Approval[]>(token, `security_approvals?select=${COLUMNS}`, {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify(input),
  })
  return rows[0]
}

export async function updateApproval(token: string, id: string, input: ApprovalInput): Promise<Approval> {
  const rows = await rest<Approval[]>(token, `security_approvals?id=eq.${id}&select=${COLUMNS}`, {
    method: "PATCH",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify(input),
  })
  if (!rows.length) throw new AdminNotFoundError("الطلب غير موجود")
  return rows[0]
}

export async function deleteApproval(token: string, id: string): Promise<void> {
  const rows = await rest<{ id: string }[]>(token, `security_approvals?id=eq.${id}&select=id`, {
    method: "DELETE",
    headers: { Prefer: "return=representation" },
  })
  if (!rows.length) throw new AdminNotFoundError("الطلب غير موجود")
}

/**
 * استيراد دفعة. legacy_id فريد في الجدول، و«تجاهل المكرّر» يجعل نفس الملف
 * مرتين بلا أثر ثانٍ. يعيد ما أُدخل فعلاً — لا ما أُرسل.
 */
export async function importApprovals(
  token: string,
  rows: (ApprovalInput & { legacy_id: string })[],
): Promise<number> {
  if (!rows.length) return 0
  const inserted = await rest<{ id: string }[]>(token, "security_approvals?on_conflict=legacy_id&select=id", {
    method: "POST",
    headers: { Prefer: "return=representation,resolution=ignore-duplicates" },
    body: JSON.stringify(rows),
  })
  return inserted.length
}
