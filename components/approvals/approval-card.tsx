"use client"

import { ArrowLeft, CalendarDays, Hash, IdCard, Pencil, Phone, StickyNote, Trash2, TriangleAlert, Users, Wallet } from "lucide-react"
import {
  NEXT_STATUS,
  OVERDUE_DAYS,
  STATUS_STYLE,
  daysBetween,
  profitOf,
  remainingOf,
  shortDate,
  usd,
  type Approval,
  type ApprovalStatus,
} from "@/lib/approvals-format"
import { khartoumDay } from "@/lib/approvals-analytics"
import { STATUS_ICON, StatusBadge, T, daysLabel, sinceLabel } from "@/components/approvals/ui"

/** الحرفان الأولان من الاسمين الأولين: «فاطمه عمر» → «فع». */
function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
}

type Step = { label: string; note: string; state: "done" | "now" | "late" | "todo" | "stop"; color?: string }

/**
 * التقديم ← الإصدار ← التسليم، ومدة كل مرحلة. الطلبات المستوردة بلا توقيت
 * تُظهر المرحلة منجزةً بلا مدة — لا رقمٌ مخترع.
 */
function steps(r: Approval, today: string): Step[] {
  const applied: Step = { label: "التقديم", note: shortDate(r.apply_date, today), state: "done", color: STATUS_STYLE["قيد الإجراء"].color }
  const approvedDay = r.approved_at ? khartoumDay(r.approved_at) : null
  const deliveredDay = r.delivered_at ? khartoumDay(r.delivered_at) : null

  if (r.status === "مرفوضة") {
    const rejectedDay = r.rejected_at ? khartoumDay(r.rejected_at) : null
    return [
      applied,
      { label: "رُفض", note: rejectedDay ? `بعد ${daysLabel(Math.max(0, daysBetween(r.apply_date, rejectedDay)))}` : "", state: "stop", color: STATUS_STYLE["مرفوضة"].color },
    ]
  }
  if (r.status === "قيد الإجراء") {
    const age = Math.max(0, daysBetween(r.apply_date, today))
    return [
      applied,
      { label: "الإصدار", note: sinceLabel(age), state: age >= OVERDUE_DAYS ? "late" : "now" },
      { label: "التسليم", note: "", state: "todo" },
    ]
  }
  const approval: Step = {
    label: "صدرت",
    note: approvedDay ? (daysBetween(r.apply_date, approvedDay) <= 0 ? "نفس اليوم" : `بعد ${daysLabel(daysBetween(r.apply_date, approvedDay))}`) : "",
    state: "done",
    color: STATUS_STYLE["صدرت الموافقة"].color,
  }
  if (r.status === "صدرت الموافقة") return [applied, approval, { label: "التسليم", note: "بانتظار العميل", state: "now" }]
  const from = approvedDay ?? r.apply_date
  return [
    applied,
    approval,
    {
      label: "سُلّمت",
      note: deliveredDay ? (daysBetween(from, deliveredDay) <= 0 ? "نفس اليوم" : `بعد ${daysLabel(daysBetween(from, deliveredDay))}`) : "",
      state: "done",
      color: STATUS_STYLE["تم التسليم"].color,
    },
  ]
}

function Timeline({ r, today }: { r: Approval; today: string }) {
  const list = steps(r, today)
  return (
    <ol className="mt-3 flex items-start" aria-label="مراحل الطلب">
      {list.map((s, i) => (
        <li key={s.label} className="relative flex flex-1 flex-col items-center text-center">
          {/* من منتصف هذه المرحلة يميناً إلى منتصف السابقة (RTL: السابقة يمينها) */}
          {i > 0 && (
            <span
              aria-hidden
              className="absolute left-1/2 top-[7px] h-0.5 w-full -translate-y-1/2"
              style={{ background: s.state === "done" || s.state === "stop" ? s.color : "rgba(255,255,255,0.08)" }}
            />
          )}
          <span
            aria-hidden
            className={`relative z-10 h-3.5 w-3.5 rounded-full ring-[3px] ring-[#0E1A28] ${
              s.state === "now" ? "animate-pulse bg-[#c98500]" : s.state === "late" ? "animate-pulse bg-[#e66767]" : s.state === "todo" ? "bg-[#2A3B50]" : ""
            }`}
            style={s.state === "done" || s.state === "stop" ? { background: s.color } : undefined}
          />
          <span className={`mt-1.5 text-[11px] font-bold ${s.state === "todo" ? T.muted : T.sub}`}>{s.label}</span>
          {s.note && (
            <span
              className={`text-[11px] ${s.state === "late" ? `font-bold ${T.bad}` : s.state === "now" ? "text-[#FCD34D]" : T.muted}`}
              {...(s.state === "now" || s.state === "late" ? { "data-age": Math.max(0, daysBetween(r.apply_date, today)) } : {})}
            >
              {s.state === "late" && <TriangleAlert className="me-0.5 inline h-3 w-3" aria-hidden />}
              {s.note}
            </span>
          )}
        </li>
      ))}
    </ol>
  )
}

export function ApprovalCard({
  r,
  today,
  busy,
  onAdvance,
  onCollect,
  onEdit,
  onDelete,
}: {
  r: Approval
  today: string
  busy: boolean
  onAdvance: (s: ApprovalStatus) => void
  onCollect: () => void
  onEdit: () => void
  onDelete: () => void
}) {
  const remaining = remainingOf(r)
  const profit = profitOf(r)
  const next = NEXT_STATUS[r.status]
  const NextIcon = next ? STATUS_ICON[next] : null
  const rejected = r.status === "مرفوضة"

  return (
    <li
      data-approval={r.id}
      data-status={r.status}
      className={`${T.card} p-4 transition hover:ring-white/[0.14] ${busy ? "opacity-60" : ""}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <span
            aria-hidden
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-sm font-extrabold ring-1"
            style={{ background: `${STATUS_STYLE[r.status].color}22`, color: "#EEF2F7", borderColor: STATUS_STYLE[r.status].color, boxShadow: `inset 0 0 0 1px ${STATUS_STYLE[r.status].color}55` }}
          >
            {initials(r.full_name)}
          </span>
          <div className="min-w-0">
            {/* نصٌّ يُعرض كنص: React يهرّبه. الأداة القديمة كانت تحقنه في innerHTML. */}
            <p data-name className={`break-words text-[15px] font-extrabold leading-6 ${T.ink}`}>{r.full_name}</p>
            <div className={`mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs ${T.muted}`}>
              <span className="inline-flex items-center gap-1">
                <IdCard className="h-3.5 w-3.5" aria-hidden />
                <bdi dir="ltr" className="font-mono font-bold text-[#D5DDE6]">
                  {r.passport_no}
                </bdi>
              </span>
              <span className="inline-flex items-center gap-1">
                <Users className="h-3.5 w-3.5" aria-hidden />
                <span className={`font-semibold ${T.sub}`}>{r.agent}</span>
              </span>
              <span className="inline-flex items-center gap-1">
                <CalendarDays className="h-3.5 w-3.5" aria-hidden />
                {shortDate(r.apply_date, today)}
              </span>
              {r.phone && (
                <a href={`tel:${r.phone}`} dir="ltr" className="inline-flex items-center gap-1 text-[#93C5FD] hover:underline">
                  <Phone className="h-3.5 w-3.5" aria-hidden />
                  {r.phone}
                </a>
              )}
              {r.approval_ref && (
                <span className="inline-flex items-center gap-0.5">
                  <Hash className="h-3.5 w-3.5" aria-hidden />
                  <bdi dir="ltr" className="font-mono">
                    {r.approval_ref}
                  </bdi>
                </span>
              )}
            </div>
          </div>
        </div>
        <StatusBadge status={r.status} compact />
      </div>

      <Timeline r={r} today={today} />

      <dl className={`mt-3 grid grid-cols-4 divide-x divide-x-reverse divide-white/[0.06] py-2 text-center text-[11px] ${T.inset}`}>
        <div>
          <dt className={T.muted}>البيع</dt>
          <dd className="mt-0.5 font-bold text-[#EEF2F7]">
            <bdi dir="ltr">{usd(r.sale_price)}</bdi>
          </dd>
        </div>
        <div>
          <dt className={T.muted}>التكلفة</dt>
          <dd className={`mt-0.5 font-bold ${T.sub}`}>
            <bdi dir="ltr">{usd(r.cost_price)}</bdi>
          </dd>
        </div>
        <div>
          <dt className={T.muted}>الربح</dt>
          <dd className={`mt-0.5 font-extrabold ${rejected ? `${T.muted} line-through` : profit >= 0 ? T.good : T.bad}`}>
            <bdi dir="ltr">{usd(profit)}</bdi>
          </dd>
        </div>
        <div>
          <dt className={T.muted}>التحصيل</dt>
          <dd className={`mt-0.5 font-bold ${remaining > 0 ? T.bad : T.good}`} data-remaining={remaining}>
            {remaining > 0 ? (
              <>
                باقٍ <bdi dir="ltr">{usd(remaining)}</bdi>
              </>
            ) : (
              "خالص"
            )}
          </dd>
        </div>
      </dl>

      {r.notes && (
        <p className={`mt-2.5 flex items-start gap-1.5 break-words text-xs ${T.sub}`}>
          <StickyNote className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#7D8EA3]" aria-hidden />
          {r.notes}
        </p>
      )}

      <div className="mt-3 flex items-center gap-2">
        {next && NextIcon && (
          <button
            disabled={busy}
            onClick={() => onAdvance(next)}
            data-action="advance"
            className={`${T.primary} h-10 flex-1 px-4 text-xs sm:flex-none`}
          >
            <NextIcon className="h-4 w-4" aria-hidden />
            {next === "صدرت الموافقة" ? "صدرت الموافقة" : "سُلّمت للعميل"}
            <ArrowLeft className="h-3.5 w-3.5 opacity-70" aria-hidden />
          </button>
        )}
        {remaining > 0 && !rejected && (
          <button disabled={busy} onClick={onCollect} data-action="collect" className={`${T.ghost} h-10 flex-1 px-3 text-xs text-[#6EE7B7] sm:flex-none`}>
            <Wallet className="h-4 w-4" aria-hidden />
            تحصيل <bdi dir="ltr">{usd(remaining)}</bdi>
          </button>
        )}
        <div className="ms-auto flex gap-1.5">
          <button disabled={busy} onClick={onEdit} data-action="edit" aria-label="تعديل" title="تعديل" className={`${T.ghost} h-10 w-10`}>
            <Pencil className="h-4 w-4" aria-hidden />
          </button>
          <button
            disabled={busy}
            onClick={onDelete}
            data-action="delete"
            aria-label="حذف"
            title="حذف"
            className={`${T.ghost} h-10 w-10 text-[#FCA5A5] hover:bg-[#e66767]/15`}
          >
            <Trash2 className="h-4 w-4" aria-hidden />
          </button>
        </div>
      </div>
    </li>
  )
}
