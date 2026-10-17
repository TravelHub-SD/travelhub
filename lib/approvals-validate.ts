/**
 * lib/approvals-validate.ts
 * ─────────────────────────────────────────────────────────────
 * تحقّق الطلب قبل القاعدة — للنموذج، وللاستيراد من الأداة القديمة.
 * القيود في القاعدة أيضاً؛ هنا جملةٌ يفهمها المستخدم ويصلح بها.
 * ─────────────────────────────────────────────────────────────
 */

import { STATUSES, type ApprovalInput, type ApprovalStatus } from "@/lib/approvals-format"

type Result<T> = { ok: true; value: T } | { ok: false; error: string }

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
export const isUuid = (v: unknown): v is string => typeof v === "string" && UUID.test(v)

function isRealDate(iso: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return false
  const d = new Date(`${iso}T00:00:00Z`)
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === iso
}

/** مسافات متعدّدة → مسافة، وأطراف بلا فراغ. "" → null للاختياري. */
const clean = (v: unknown) => String(v ?? "").replace(/\s+/g, " ").trim()
const optional = (v: unknown) => clean(v) || null

const MAX_AMOUNT = 9_999_999_999.99 // حدّ numeric(12,2)

function amount(v: unknown, label: string): Result<number> {
  const raw = String(v ?? "").replace(/[,\s$]/g, "")
  if (raw === "") return { ok: true, value: 0 }
  const n = Number(raw)
  if (!Number.isFinite(n)) return { ok: false, error: `${label}: رقم غير صالح` }
  if (n < 0) return { ok: false, error: `${label} لا يكون سالباً` }
  if (n > MAX_AMOUNT) return { ok: false, error: `${label} أكبر من المسموح` }
  if (Math.abs(Math.round(n * 100) - n * 100) > 1e-6) return { ok: false, error: `${label}: سنتان بعد الفاصلة بحدّ أقصى` }
  return { ok: true, value: n }
}

/** الحقول بأسماء الجدول — ما يرسله النموذج. */
export function validateApproval(body: any): Result<ApprovalInput> {
  const full_name = clean(body?.full_name)
  if (full_name.length < 2) return { ok: false, error: "اكتب اسم المسافر" }
  if (full_name.length > 200) return { ok: false, error: "الاسم أطول من ٢٠٠ حرف" }

  const passport_no = clean(body?.passport_no).toUpperCase()
  if (!passport_no) return { ok: false, error: "اكتب رقم الجواز" }
  if (passport_no.length > 30) return { ok: false, error: "رقم الجواز أطول من ٣٠ حرفاً" }

  const phone = optional(body?.phone)
  if (phone && phone.length > 30) return { ok: false, error: "رقم الهاتف أطول من ٣٠ حرفاً" }

  const agent = clean(body?.agent) || "مباشر"
  if (agent.length > 100) return { ok: false, error: "اسم الجهة أطول من ١٠٠ حرف" }

  const apply_date = clean(body?.apply_date)
  if (!isRealDate(apply_date)) return { ok: false, error: "تاريخ التقديم غير صحيح" }

  const status = clean(body?.status) as ApprovalStatus
  if (!STATUSES.includes(status)) return { ok: false, error: "اختر حالة الطلب" }

  const approval_ref = optional(body?.approval_ref)
  if (approval_ref && approval_ref.length > 60) return { ok: false, error: "رقم المرجع أطول من ٦٠ حرفاً" }

  const sale = amount(body?.sale_price, "سعر البيع")
  if (!sale.ok) return sale
  const cost = amount(body?.cost_price, "التكلفة")
  if (!cost.ok) return cost
  const paid = amount(body?.paid_amount, "المدفوع")
  if (!paid.ok) return paid
  // الأداة القديمة قبلت مدفوعاً أكبر من السعر، فظهر متبقٍّ سالب ينقص من
  // مجموع ديون العملاء بصمت.
  if (paid.value > sale.value) return { ok: false, error: "المدفوع أكبر من سعر البيع" }

  const notes = optional(body?.notes)
  if (notes && notes.length > 1000) return { ok: false, error: "الملاحظات أطول من ١٠٠٠ حرف" }

  return {
    ok: true,
    value: {
      full_name,
      passport_no,
      phone,
      agent,
      apply_date,
      status,
      approval_ref,
      sale_price: sale.value,
      cost_price: cost.value,
      paid_amount: paid.value,
      notes,
    },
  }
}

/**
 * سجلٌّ بصيغة الأداة القديمة (fullName، totalPrice…) → صيغة الجدول. يقبل
 * صيغة الجدول نفسها أيضاً، فيُستورد ملفٌّ صُدِّر من هنا.
 */
export function fromLegacy(r: any): Result<ApprovalInput & { legacy_id: string }> {
  if (!r || typeof r !== "object") return { ok: false, error: "سجلٌّ غير صالح" }
  const legacy_id = clean(r.id ?? r.legacy_id)
  if (!legacy_id) return { ok: false, error: "سجلٌّ بلا معرّف" }
  if (legacy_id.length > 100) return { ok: false, error: "معرّف أطول من المعتاد" }

  const parsed = validateApproval({
    full_name: r.fullName ?? r.full_name,
    passport_no: r.passportNo ?? r.passport_no,
    phone: r.phone,
    agent: r.agent,
    apply_date: r.applyDate ?? r.apply_date,
    status: r.status,
    approval_ref: r.approvalRef ?? r.approval_ref,
    sale_price: r.totalPrice ?? r.sale_price,
    cost_price: r.costPrice ?? r.cost_price,
    paid_amount: r.paidAmount ?? r.paid_amount,
    notes: r.notes,
  })
  if (!parsed.ok) return parsed
  return { ok: true, value: { ...parsed.value, legacy_id } }
}

export const MAX_IMPORT = 2000
