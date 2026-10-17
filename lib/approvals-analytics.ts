/**
 * lib/approvals-analytics.ts
 * ─────────────────────────────────────────────────────────────
 * حسابات التحليلات: الفترات ومقارنتها بما قبلها، السلسلة الزمنية، أداء
 * كل جهة، ومدة الإنجاز. دوالّ صافية بلا واجهة — تُختبر وحدها.
 * ─────────────────────────────────────────────────────────────
 */

import { STATUSES, cents, daysBetween, type Approval, type ApprovalStatus } from "@/lib/approvals-format"

// ─── التواريخ ────────────────────────────────────────────────────────────────

const pad = (n: number) => String(n).padStart(2, "0")

function fromUtc(ms: number): string {
  const d = new Date(ms)
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`
}

const utc = (iso: string) => Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10))

export const addDays = (iso: string, n: number) => fromUtc(utc(iso) + n * 86_400_000)

/** أول يوم في شهر iso بعد إزاحة months شهراً. */
function monthStart(iso: string, months = 0): string {
  const d = new Date(utc(iso))
  return fromUtc(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + months, 1))
}

const monthEnd = (iso: string) => addDays(monthStart(iso, 1), -1)

// الوكالة في الخرطوم: يومُ الطابع الزمني هناك، لا في منطقة الخادم (UTC على
// Vercel) ولا الجهاز — فيتطابق ما يُرسم على الخادم وفي المتصفح.
const KHARTOUM = new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Khartoum", year: "numeric", month: "2-digit", day: "2-digit" })

/** "2026-10-16T22:30:00Z" → "2026-10-17" (بتوقيت الخرطوم) */
export const khartoumDay = (ts: string) => KHARTOUM.format(new Date(ts))

// ─── الفترات ─────────────────────────────────────────────────────────────────

export type PeriodKey = "7d" | "30d" | "month" | "prev-month" | "all"

export const PERIODS: { key: PeriodKey; label: string }[] = [
  { key: "all", label: "الكل" },
  // قصيرة لتتّسع الخمسة في سطرٍ واحد على الهاتف
  { key: "7d", label: "7 أيام" },
  { key: "30d", label: "30 يوماً" },
  { key: "month", label: "هذا الشهر" },
  { key: "prev-month", label: "الشهر الماضي" },
]

export interface Range {
  from: string | null
  to: string | null
  /** الفترة السابقة بنفس الطول — للمقارنة. لا مقارنة لـ«الكل». */
  prev: { from: string; to: string; label: string } | null
}

export function periodRange(key: PeriodKey, today: string): Range {
  switch (key) {
    case "7d":
      return { from: addDays(today, -6), to: today, prev: { from: addDays(today, -13), to: addDays(today, -7), label: "الأيام السبعة السابقة" } }
    case "30d":
      return { from: addDays(today, -29), to: today, prev: { from: addDays(today, -59), to: addDays(today, -30), label: "الثلاثين يوماً السابقة" } }
    case "month": {
      // حتى اليوم نفسه من الشهر الماضي: مقارنة ١٧ يوماً بشهرٍ كامل تظلم الحالي.
      const prevFrom = monthStart(today, -1)
      const sameDay = addDays(prevFrom, +today.slice(8, 10) - 1)
      const prevTo = sameDay > monthEnd(prevFrom) ? monthEnd(prevFrom) : sameDay
      return { from: monthStart(today), to: today, prev: { from: prevFrom, to: prevTo, label: "نفس الأيام من الشهر الماضي" } }
    }
    case "prev-month": {
      const from = monthStart(today, -1)
      const before = monthStart(today, -2)
      return { from, to: monthEnd(from), prev: { from: before, to: monthEnd(before), label: "الشهر الذي قبله" } }
    }
    default:
      return { from: null, to: null, prev: null }
  }
}

export const inRange = (r: Pick<Approval, "apply_date">, from: string | null, to: string | null) =>
  (!from || r.apply_date >= from) && (!to || r.apply_date <= to)

// ─── الأرقام الرئيسية ────────────────────────────────────────────────────────

export interface Totals {
  count: number
  rejected: number
  /** بلا المرفوضة في كل ما يلي: لا بيع ولا ربح ولا دَين في خدمة لم تتم */
  revenueCents: number
  profitCents: number
  paidCents: number
  outstandingCents: number
}

export function totals(rows: Approval[]): Totals {
  const t: Totals = { count: rows.length, rejected: 0, revenueCents: 0, profitCents: 0, paidCents: 0, outstandingCents: 0 }
  for (const r of rows) {
    if (r.status === "مرفوضة") {
      t.rejected++
      continue
    }
    t.revenueCents += cents(r.sale_price)
    t.profitCents += cents(r.sale_price) - cents(r.cost_price)
    t.paidCents += cents(r.paid_amount)
    t.outstandingCents += Math.max(0, cents(r.sale_price) - cents(r.paid_amount))
  }
  return t
}

/** التغيّر النسبي، أو null حين لا أساس للمقارنة (السابق صفر). */
export function change(now: number, before: number): number | null {
  if (!before) return null
  return (now - before) / Math.abs(before)
}

// ─── السلسلة الزمنية ─────────────────────────────────────────────────────────

export type Unit = "day" | "week" | "month"

export interface Bucket {
  from: string
  to: string
  count: number
  profitCents: number
  revenueCents: number
  byStatus: Record<ApprovalStatus, number>
}

const emptyByStatus = () => Object.fromEntries(STATUSES.map((s) => [s, 0])) as Record<ApprovalStatus, number>

/**
 * الطلبات مجمّعة بتاريخ التقديم. يومياً حتى ٤٥ يوماً، أسبوعياً حتى ستة
 * أشهر، وشهرياً بعدها — أعمدةٌ أرفع من ذلك لا تُقرأ على الهاتف.
 */
export function timeSeries(rows: Approval[], range: Range, today: string): { unit: Unit; buckets: Bucket[] } {
  const dates = rows.map((r) => r.apply_date).sort()
  const from = range.from ?? dates[0] ?? today
  const lastData = dates[dates.length - 1]
  const to = range.to ?? (lastData && lastData > today ? lastData : today)
  const span = daysBetween(from, to) + 1
  const unit: Unit = span <= 45 ? "day" : span <= 183 ? "week" : "month"

  const buckets: Bucket[] = []
  for (let start = unit === "month" ? monthStart(from) : from; start <= to; ) {
    const next = unit === "day" ? addDays(start, 1) : unit === "week" ? addDays(start, 7) : monthStart(start, 1)
    const end = addDays(next, -1)
    buckets.push({ from: start, to: end < to ? end : to, count: 0, profitCents: 0, revenueCents: 0, byStatus: emptyByStatus() })
    start = next
  }
  for (const r of rows) {
    const b = buckets.find((x) => r.apply_date >= x.from && r.apply_date <= x.to)
    if (!b) continue
    b.count++
    b.byStatus[r.status]++
    if (r.status === "مرفوضة") continue
    b.profitCents += cents(r.sale_price) - cents(r.cost_price)
    b.revenueCents += cents(r.sale_price)
  }
  return { unit, buckets }
}

// ─── مدة الإنجاز ─────────────────────────────────────────────────────────────

export interface Stats {
  n: number
  avg: number | null
  median: number | null
  min: number | null
  max: number | null
}

export function stats(xs: number[]): Stats {
  if (!xs.length) return { n: 0, avg: null, median: null, min: null, max: null }
  const s = [...xs].sort((a, b) => a - b)
  const mid = Math.floor(s.length / 2)
  return {
    n: s.length,
    avg: s.reduce((a, b) => a + b, 0) / s.length,
    median: s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2,
    min: s[0],
    max: s[s.length - 1],
  }
}

/** أيامٌ من التقديم إلى الإصدار — null لطلبٍ بلا توقيت إصدار. */
export const daysToApproval = (r: Approval) => (r.approved_at ? Math.max(0, daysBetween(r.apply_date, khartoumDay(r.approved_at))) : null)
export const daysToDelivery = (r: Approval) => (r.delivered_at ? Math.max(0, daysBetween(r.apply_date, khartoumDay(r.delivered_at))) : null)

// شرطة عادية لا «–»: بين رقمين تبقى الأرقام معاً في سطرٍ عربي، والطويلة قد تقلبها «3–2».
export const DURATION_BUCKETS: { label: string; test: (d: number) => boolean }[] = [
  { label: "نفس اليوم", test: (d) => d === 0 },
  { label: "يوم", test: (d) => d === 1 },
  { label: "2-3 أيام", test: (d) => d >= 2 && d <= 3 },
  { label: "4-7 أيام", test: (d) => d >= 4 && d <= 7 },
  { label: "أسبوع فأكثر", test: (d) => d > 7 },
]

export interface Processing {
  toApproval: Stats
  toDelivery: Stats
  /** من الإصدار إلى التسليم للعميل */
  handover: Stats
  distribution: { label: string; count: number }[]
  /** صدرت أو سُلّمت لكن بلا توقيت — مستوردة من الأداة القديمة */
  untimed: number
}

export function processing(rows: Approval[]): Processing {
  const approval: number[] = []
  const delivery: number[] = []
  const handover: number[] = []
  let untimed = 0
  for (const r of rows) {
    const a = daysToApproval(r)
    const d = daysToDelivery(r)
    if (a !== null) approval.push(a)
    if (d !== null) delivery.push(d)
    if (r.approved_at && r.delivered_at) {
      handover.push(Math.max(0, daysBetween(khartoumDay(r.approved_at), khartoumDay(r.delivered_at))))
    }
    if ((r.status === "صدرت الموافقة" || r.status === "تم التسليم") && a === null) untimed++
  }
  return {
    toApproval: stats(approval),
    toDelivery: stats(delivery),
    handover: stats(handover),
    distribution: DURATION_BUCKETS.map((b) => ({ label: b.label, count: approval.filter(b.test).length })),
    untimed,
  }
}

/** الطلبات المعلّقة، الأقدم أولاً — أين يجب أن يتابع أحدٌ اليوم. */
export function waiting(rows: Approval[], today: string): { r: Approval; days: number }[] {
  return rows
    .filter((r) => r.status === "قيد الإجراء")
    .map((r) => ({ r, days: Math.max(0, daysBetween(r.apply_date, today)) }))
    .sort((a, b) => b.days - a.days)
}

// ─── الجهات ──────────────────────────────────────────────────────────────────

export interface AgentPerf extends Totals {
  agent: string
  approval: Stats
}

/** أداء كل جهة: من يجلب، ومن يربح، ومن عليه، وكم يأخذ طلبُه حتى يصدر. */
export function agentPerformance(rows: Approval[]): AgentPerf[] {
  const groups = new Map<string, Approval[]>()
  for (const r of rows) {
    const k = r.agent || "مباشر"
    groups.set(k, [...(groups.get(k) || []), r])
  }
  return [...groups.entries()]
    .map(([agent, list]) => ({
      agent,
      ...totals(list),
      approval: stats(list.map(daysToApproval).filter((d): d is number => d !== null)),
    }))
    .sort((a, b) => b.count - a.count || b.profitCents - a.profitCents)
}
