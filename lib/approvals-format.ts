/**
 * lib/approvals-format.ts
 * ─────────────────────────────────────────────────────────────
 * أنواع الموافقات وحساباتها وتنسيقها — مشتركة بين الخادم والمتصفح، بلا
 * أي استيراد من الخادم.
 * ─────────────────────────────────────────────────────────────
 */

// نفس قيم قيد security_approvals_status_valid، بترتيب مراحل الطلب.
export const STATUSES = ["قيد الإجراء", "صدرت الموافقة", "تم التسليم", "مرفوضة"] as const
export type ApprovalStatus = (typeof STATUSES)[number]

export interface Approval {
  id: string
  full_name: string
  passport_no: string
  phone: string | null
  agent: string
  apply_date: string
  status: ApprovalStatus
  approval_ref: string | null
  sale_price: number
  cost_price: number
  paid_amount: number
  notes: string | null
  legacy_id: string | null
  created_at: string
  updated_at: string
}

export interface ApprovalInput {
  full_name: string
  passport_no: string
  phone: string | null
  agent: string
  apply_date: string
  status: ApprovalStatus
  approval_ref: string | null
  sale_price: number
  cost_price: number
  paid_amount: number
  notes: string | null
}

/** عرض كل حالة: لونٌ وأيقونة **وكلمة** — الحالة لا تُحمَّل على اللون وحده. */
export const STATUS_STYLE: Record<ApprovalStatus, { icon: string; short: string; badge: string; dot: string }> = {
  "قيد الإجراء": { icon: "⏳", short: "قيد الإجراء", badge: "bg-amber-50 text-amber-800 ring-amber-200", dot: "bg-amber-500" },
  "صدرت الموافقة": { icon: "✅", short: "صدرت", badge: "bg-emerald-50 text-emerald-800 ring-emerald-200", dot: "bg-emerald-500" },
  "تم التسليم": { icon: "📬", short: "سُلّمت", badge: "bg-sky-50 text-sky-800 ring-sky-200", dot: "bg-sky-500" },
  مرفوضة: { icon: "❌", short: "مرفوضة", badge: "bg-red-50 text-red-800 ring-red-200", dot: "bg-red-500" },
}

/** الخطوة التالية الطبيعية — الرفض ليس «تالياً» لأحد. الأداة القديمة كانت
 *  تدور على الحالات الأربع، فنقرةٌ زائدة واحدة تحوّل طلباً سليماً إلى «مرفوضة». */
export const NEXT_STATUS: Partial<Record<ApprovalStatus, ApprovalStatus>> = {
  "قيد الإجراء": "صدرت الموافقة",
  "صدرت الموافقة": "تم التسليم",
}

// ─── المال ───────────────────────────────────────────────────────────────────
// المبالغ بالدولار ومنزلتين. الجمع بالسنتات (أعداد صحيحة) لا بالكسور
// العائمة، وإلا ظهر 0.30000000000000004.

export const cents = (n: number) => Math.round(Number(n || 0) * 100)
export const fromCents = (c: number) => c / 100

/** 70 → "$70" ، 70.5 → "$70.50" — الكسور تظهر فقط إن وُجدت. */
export function usd(n: number): string {
  const c = cents(n)
  const s = new Intl.NumberFormat("en-US", {
    minimumFractionDigits: c % 100 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(Math.abs(c) / 100)
  return `${c < 0 ? "−" : ""}$${s}`
}

export const profitOf = (r: Pick<Approval, "sale_price" | "cost_price">) => fromCents(cents(r.sale_price) - cents(r.cost_price))
export const remainingOf = (r: Pick<Approval, "sale_price" | "paid_amount">) =>
  fromCents(cents(r.sale_price) - cents(r.paid_amount))

export interface Summary {
  total: number
  byStatus: Record<ApprovalStatus, number>
  /** ما دخل الصندوق فعلاً — كل المدفوع، حتى لطلبٍ رُفض ما لم يُرَدّ المبلغ */
  collectedCents: number
  /** ديون العملاء — بلا المرفوضة: لا يُطالَب أحد بثمن خدمةٍ لم تتم */
  outstandingCents: number
  /** صافي الربح — بلا المرفوضة، كالأداة القديمة */
  profitCents: number
  revenueCents: number
  /** طلبات قيد الإجراء منذ ٣ أيام فأكثر */
  overdue: number
}

export const OVERDUE_DAYS = 3

export function summarize(rows: Approval[], today: string): Summary {
  const byStatus = Object.fromEntries(STATUSES.map((s) => [s, 0])) as Record<ApprovalStatus, number>
  let collectedCents = 0
  let outstandingCents = 0
  let profitCents = 0
  let revenueCents = 0
  let overdue = 0
  for (const r of rows) {
    byStatus[r.status] = (byStatus[r.status] ?? 0) + 1
    collectedCents += cents(r.paid_amount)
    if (r.status === "مرفوضة") continue
    outstandingCents += Math.max(0, cents(r.sale_price) - cents(r.paid_amount))
    profitCents += cents(r.sale_price) - cents(r.cost_price)
    revenueCents += cents(r.sale_price)
    if (r.status === "قيد الإجراء" && daysBetween(r.apply_date, today) >= OVERDUE_DAYS) overdue++
  }
  return { total: rows.length, byStatus, collectedCents, outstandingCents, profitCents, revenueCents, overdue }
}

export interface AgentTotal {
  agent: string
  count: number
  profitCents: number
  outstandingCents: number
}

/** حسب الجهة — من يجلب أكثر، ومن عليه أكثر. بلا المرفوضة. */
export function byAgent(rows: Approval[]): AgentTotal[] {
  const map = new Map<string, AgentTotal>()
  for (const r of rows) {
    if (r.status === "مرفوضة") continue
    const key = r.agent || "مباشر"
    const t = map.get(key) || { agent: key, count: 0, profitCents: 0, outstandingCents: 0 }
    t.count++
    t.profitCents += cents(r.sale_price) - cents(r.cost_price)
    t.outstandingCents += Math.max(0, cents(r.sale_price) - cents(r.paid_amount))
    map.set(key, t)
  }
  return [...map.values()].sort((a, b) => b.count - a.count || b.profitCents - a.profitCents)
}

/**
 * أكثر أزواج (سعر، تكلفة) تكراراً — أزرار تملأ الحقلين بنقرة. بياناتك فيها
 * ثلاثة أسعار تقريباً (٧٠/٦٥، ١٤٥/١٤٠، ١٥٠/١٤٠)؛ كتابتها كل مرة مضيعة
 * وباب خطأ.
 */
export function pricePresets(rows: Approval[], max = 3): { sale: number; cost: number; uses: number }[] {
  const map = new Map<string, { sale: number; cost: number; uses: number }>()
  for (const r of rows) {
    if (!r.sale_price) continue
    const k = `${cents(r.sale_price)}|${cents(r.cost_price)}`
    const p = map.get(k) || { sale: r.sale_price, cost: r.cost_price, uses: 0 }
    p.uses++
    map.set(k, p)
  }
  return [...map.values()].sort((a, b) => b.uses - a.uses).slice(0, max)
}

// ─── التواريخ ────────────────────────────────────────────────────────────────

/** أيامٌ كاملة بين تاريخين بصيغة YYYY-MM-DD — بلا أثر للمنطقة الزمنية. */
export function daysBetween(from: string, to: string): number {
  const a = Date.UTC(+from.slice(0, 4), +from.slice(5, 7) - 1, +from.slice(8, 10))
  const b = Date.UTC(+to.slice(0, 4), +to.slice(5, 7) - 1, +to.slice(8, 10))
  return Math.round((b - a) / 86_400_000)
}

/** "2026-10-16" → "16 أكتوبر" (والسنة إن لم تكن الحالية) */
export function shortDate(iso: string, today: string): string {
  const d = new Date(`${iso}T00:00:00`)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString("ar-EG-u-nu-latn", {
    day: "numeric",
    month: "long",
    ...(iso.slice(0, 4) !== today.slice(0, 4) ? { year: "numeric" } : {}),
  })
}

// ─── البحث ───────────────────────────────────────────────────────────────────

/**
 * توحيد الكتابة العربية للبحث. بياناتك نفسها فيها «فاطمه» و«ساميه»
 * و«عيسي» — من يبحث بـ«فاطمة» أو «عيسى» كان لا يجد شيئاً في الأداة القديمة.
 */
export function normalizeArabic(s: string): string {
  return (s || "")
    .toLowerCase()
    .replace(/[ً-ْـ]/g, "") // التشكيل والتطويل
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/ى/g, "ي")
    .replace(/ؤ/g, "و")
    .replace(/ئ/g, "ي")
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/\s+/g, " ")
    .trim()
}

export function matches(r: Approval, query: string): boolean {
  if (!query) return true
  const hay = normalizeArabic(
    [r.full_name, r.passport_no, r.phone, r.agent, r.approval_ref, r.notes].filter(Boolean).join(" "),
  )
  // كل كلمة في البحث يجب أن توجد — «فاطمة تايغر» يجد فاطمة من تايغر.
  return normalizeArabic(query)
    .split(" ")
    .every((w) => hay.includes(w))
}

// ─── التصدير ─────────────────────────────────────────────────────────────────

/**
 * خلية CSV آمنة: علامات تنصيص مضاعفة، والقيم التي تبدأ بـ = + - @ تُسبق
 * بفاصلة عليا — وإلا نفّذها Excel كمعادلة (حقن المعادلات). الأداة القديمة
 * لم تهرّب علامات التنصيص إلا في الملاحظات، فاسمٌ فيه " كان يكسر الملف.
 */
export function csvCell(v: unknown): string {
  let s = v === null || v === undefined ? "" : String(v)
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export function toCsv(rows: Approval[]): string {
  const head = ["الاسم", "رقم الجواز", "الهاتف", "الجهة / الوكيل", "تاريخ التقديم", "الحالة", "رقم الموافقة", "سعر البيع $", "التكلفة $", "صافي الربح $", "المدفوع $", "المتبقي $", "ملاحظات"]
  const lines = rows.map((r) =>
    [
      r.full_name,
      r.passport_no,
      r.phone,
      r.agent,
      r.apply_date,
      r.status,
      r.approval_ref,
      r.sale_price,
      r.cost_price,
      profitOf(r),
      r.paid_amount,
      remainingOf(r),
      r.notes,
    ]
      .map(csvCell)
      .join(","),
  )
  // BOM في أوله وإلا عرض Excel العربية رموزاً
  return "﻿" + [head.join(","), ...lines].join("\n") + "\n"
}

/** نسخة JSON بصيغة الأداة القديمة نفسها — تُستورد هنا أو هناك. */
export function toLegacyJson(rows: Approval[]): string {
  return JSON.stringify(
    rows.map((r) => ({
      id: r.legacy_id ?? r.id,
      fullName: r.full_name,
      passportNo: r.passport_no,
      phone: r.phone ?? "",
      agent: r.agent,
      applyDate: r.apply_date,
      status: r.status,
      approvalRef: r.approval_ref ?? "",
      totalPrice: r.sale_price,
      costPrice: r.cost_price,
      netProfit: profitOf(r),
      paidAmount: r.paid_amount,
      remaining: remainingOf(r),
      notes: r.notes ?? "",
    })),
    null,
    2,
  )
}
