"use client"

/**
 * لبنات قسم الموافقات — الطابع الداكن.
 *
 * الألوان قِيست لا اختيرت بالعين: كل نصٍّ هنا ٤٫٥:١ فأكثر على الأسطح
 * الثلاثة (الصفحة، البطاقة، الحقل)، والأبيض على البرتقالي ٢٫٨:١ فقط —
 * فالزر البرتقالي نصّه كحلي (٦٫٧:١).
 */

import type React from "react"
import { BadgeCheck, CircleX, Clock3, PackageCheck, TrendingDown, TrendingUp, type LucideIcon } from "lucide-react"
import { STATUS_STYLE, type ApprovalStatus } from "@/lib/approvals-format"

export const T = {
  page: "bg-[#07111C]",
  card: "rounded-2xl bg-[#0E1A28] ring-1 ring-white/[0.07]",
  inset: "rounded-xl bg-[#07111C]/60 ring-1 ring-white/[0.06]",
  ink: "text-[#EEF2F7]",
  sub: "text-[#A7B4C3]",
  muted: "text-[#7D8EA3]",
  accent: "text-[#F7A04B]",
  good: "text-[#34D399]",
  bad: "text-[#F87171]",
  field:
    "h-12 w-full rounded-xl bg-[#07111C] px-3.5 text-base text-[#EEF2F7] ring-1 ring-white/10 outline-none transition placeholder:text-[#7D8EA3]/70 focus:ring-2 focus:ring-[#EF790F]/70",
  label: "mb-1.5 block text-xs font-bold text-[#A7B4C3]",
  primary:
    "inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-l from-[#F59331] to-[#EF790F] font-extrabold text-[#07111C] shadow-[0_8px_24px_-10px_rgba(239,121,15,0.7)] transition hover:brightness-110 active:scale-[0.99] disabled:opacity-50",
  ghost:
    "inline-flex items-center justify-center gap-1.5 rounded-xl bg-white/[0.04] font-bold text-[#D5DDE6] ring-1 ring-white/10 transition hover:bg-white/[0.08] disabled:opacity-40",
} as const

export const STATUS_ICON: Record<ApprovalStatus, LucideIcon> = {
  "قيد الإجراء": Clock3,
  "صدرت الموافقة": BadgeCheck,
  "تم التسليم": PackageCheck,
  مرفوضة: CircleX,
}

export function StatusBadge({ status, compact = false }: { status: ApprovalStatus; compact?: boolean }) {
  const s = STATUS_STYLE[status]
  const Icon = STATUS_ICON[status]
  return (
    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-bold ring-1 ${s.tint} ${s.text}`}>
      <Icon className="h-3.5 w-3.5" aria-hidden strokeWidth={2.4} />
      {compact ? s.short : status}
    </span>
  )
}

export function Panel({
  title,
  icon: Icon,
  hint,
  action,
  children,
  className = "",
  ...rest
}: {
  title: string
  icon?: LucideIcon
  hint?: React.ReactNode
  action?: React.ReactNode
  children: React.ReactNode
  className?: string
} & React.HTMLAttributes<HTMLElement>) {
  return (
    <section className={`${T.card} p-4 sm:p-5 ${className}`} {...rest}>
      <header className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className={`flex items-center gap-2 text-sm font-extrabold ${T.ink}`}>
            {Icon && <Icon className="h-4 w-4 text-[#F7A04B]" aria-hidden />}
            {title}
          </h2>
          {hint && <p className={`mt-1 text-xs ${T.muted}`}>{hint}</p>}
        </div>
        {action}
      </header>
      {children}
    </section>
  )
}

/** ‎+12%‎ مقارنةً بالفترة السابقة. up=good: هل الصعود خبرٌ سار هنا؟ */
export function Delta({ value, vs, upIsGood = true }: { value: number | null; vs?: string; upIsGood?: boolean }) {
  if (value === null) return vs ? <span className={`text-[11px] ${T.muted}`}>لا بيانات في {vs}</span> : null
  const flat = Math.abs(value) < 0.005
  const good = flat ? null : value > 0 === upIsGood
  const Icon = value >= 0 ? TrendingUp : TrendingDown
  return (
    <span className="inline-flex flex-wrap items-center gap-1 text-[11px]">
      <span className={`inline-flex items-center gap-0.5 font-bold ${good === null ? T.sub : good ? T.good : T.bad}`}>
        {!flat && <Icon className="h-3.5 w-3.5" aria-hidden />}
        <bdi dir="ltr">
          {value > 0 ? "+" : ""}
          {Math.round(value * 100)}%
        </bdi>
      </span>
      {vs && <span className={T.muted}>عن {vs}</span>}
    </span>
  )
}

/** «منذ يوم»، «منذ يومين»، «منذ 3 أيام»، «منذ 11 يوماً» — لا «منذ 1 يوم». */
export function sinceLabel(days: number): string {
  if (days <= 0) return "اليوم"
  if (days === 1) return "منذ يوم"
  if (days === 2) return "منذ يومين"
  if (days <= 10) return `منذ ${days} أيام`
  return `منذ ${days} يوماً`
}

/** مدةٌ بالأيام كلاماً: 0 → «نفس اليوم»، 1 → «يوم»، 2 → «يومان»، 4 → «4 أيام». */
export function daysLabel(d: number | null, digits = 0): string {
  if (d === null) return "—"
  const r = Number(d.toFixed(digits))
  if (r === 0) return "نفس اليوم"
  if (r === 1) return "يوم"
  if (r === 2) return "يومان"
  if (Number.isInteger(r) && r <= 10) return `${r} أيام`
  return `${r} يوم`
}
