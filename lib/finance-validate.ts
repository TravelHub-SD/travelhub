/**
 * lib/finance-validate.ts
 * ─────────────────────────────────────────────────────────────
 * تحقّق البند قبل القاعدة. القيود هناك أيضاً، لكن رسالتها تقنية —
 * هنا جملةٌ يفهمها المستخدم ويصلح بها.
 * ─────────────────────────────────────────────────────────────
 */

import type { ExpenseInput } from "@/lib/finance-store"

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function isUuid(v: unknown): v is string {
  return typeof v === "string" && UUID.test(v)
}

/** "2026-02-30" يطابق الصيغة لكنه ليس يوماً — نرفضه هنا لا في القاعدة. */
function isRealDate(iso: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return false
  const d = new Date(`${iso}T00:00:00Z`)
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === iso
}

const MAX_AMOUNT = 999_999_999_999.99 // حدّ numeric(14,2)

export function validateExpense(body: any): { ok: true; value: ExpenseInput } | { ok: false; error: string } {
  const date = String(body?.date || "").trim()
  if (!isRealDate(date)) return { ok: false, error: "التاريخ غير صحيح" }

  const category_id = String(body?.category_id || "").trim()
  if (!isUuid(category_id)) return { ok: false, error: "اختر التصنيف" }

  // يقبل "15,000" كما يُكتب عادةً
  const raw = String(body?.amount ?? "").replace(/[,\s]/g, "")
  const amount = Number(raw)
  if (raw === "" || !Number.isFinite(amount)) return { ok: false, error: "اكتب المبلغ" }
  if (amount <= 0) return { ok: false, error: "المبلغ يجب أن يكون أكبر من صفر" }
  if (amount > MAX_AMOUNT) return { ok: false, error: "المبلغ أكبر من المسموح" }
  if (Math.abs(Math.round(amount * 100) - amount * 100) > 1e-6) {
    return { ok: false, error: "المبلغ بحدّ أقصى قرشين بعد الفاصلة" }
  }

  const rawNote = body?.note
  const note = typeof rawNote === "string" && rawNote.trim() ? rawNote.trim() : null
  if (note && note.length > 500) return { ok: false, error: "الملاحظة أطول من ٥٠٠ حرف" }

  return { ok: true, value: { date, category_id, amount, note } }
}
