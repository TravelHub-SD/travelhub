"use client"

import { useMemo, useState } from "react"
import { Activity, CircleDollarSign, Gauge, Hourglass, PieChart, Timer, TriangleAlert, Users } from "lucide-react"
import { STATUSES, STATUS_STYLE, fromCents, usd, type Approval } from "@/lib/approvals-format"
import {
  agentPerformance,
  change,
  inRange,
  processing,
  timeSeries,
  totals,
  waiting,
  type Bucket,
  type Range,
  type Unit,
} from "@/lib/approvals-analytics"
import { ColumnChart, Meter, Sparkline, StackedBar, type Column } from "@/components/approvals/charts"
import { Delta, Panel, STATUS_ICON, T, daysLabel, sinceLabel } from "@/components/approvals/ui"

const money = (c: number) => usd(fromCents(c))

/** محور المبالغ: $1.2K بدل $1,200 حين تكبر. */
function moneyAxis(c: number): string {
  const v = fromCents(c)
  if (Math.abs(v) >= 1000) return `$${(v / 1000).toFixed(v % 1000 === 0 ? 0 : 1)}K`
  return usd(v)
}

const DAY = (iso: string, o: Intl.DateTimeFormatOptions) =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString("ar-EG-u-nu-latn", { timeZone: "UTC", ...o })

function bucketLabels(b: Bucket, unit: Unit): { axis: string; label: string } {
  if (unit === "day") return { axis: `${+b.from.slice(8)}/${+b.from.slice(5, 7)}`, label: DAY(b.from, { weekday: "long", day: "numeric", month: "long" }) }
  if (unit === "week")
    return { axis: `${+b.from.slice(8)}/${+b.from.slice(5, 7)}`, label: `${DAY(b.from, { day: "numeric", month: "long" })} – ${DAY(b.to, { day: "numeric", month: "long" })}` }
  return { axis: DAY(b.from, { month: "short" }), label: DAY(b.from, { month: "long", year: "numeric" }) }
}

type Measure = "count" | "profit" | "revenue"
const MEASURES: { key: Measure; label: string }[] = [
  { key: "count", label: "الطلبات" },
  { key: "profit", label: "الربح" },
  { key: "revenue", label: "المبيعات" },
]

const UNIT_WORD: Record<Unit, string> = { day: "يوماً بيوم", week: "أسبوعاً بأسبوع", month: "شهراً بشهر" }

export function AnalyticsView({
  rows,
  range,
  periodLabel,
  today,
  onOpen,
}: {
  rows: Approval[]
  range: Range
  periodLabel: string
  today: string
  onOpen: (r: Approval) => void
}) {
  const [measure, setMeasure] = useState<Measure>("count")

  const current = useMemo(() => rows.filter((r) => inRange(r, range.from, range.to)), [rows, range])
  const previous = useMemo(() => (range.prev ? rows.filter((r) => inRange(r, range.prev!.from, range.prev!.to)) : null), [rows, range])

  const now = useMemo(() => totals(current), [current])
  const before = useMemo(() => (previous ? totals(previous) : null), [previous])
  const series = useMemo(() => timeSeries(current, range, today), [current, range, today])
  const proc = useMemo(() => processing(current), [current])
  const procBefore = useMemo(() => (previous ? processing(previous) : null), [previous])
  const agents = useMemo(() => agentPerformance(current), [current])
  const queue = useMemo(() => waiting(rows, today), [rows, today])

  const vs = range.prev?.label
  const active = now.count - now.rejected
  const avgProfit = active ? now.profitCents / active : 0
  const avgProfitBefore = before && before.count - before.rejected ? before.profitCents / (before.count - before.rejected) : 0
  const collectRate = now.revenueCents ? now.paidCents / now.revenueCents : 0
  const rejectRate = now.count ? now.rejected / now.count : 0

  const columns: Column[] = series.buckets.map((b) => {
    const { axis, label } = bucketLabels(b, series.unit)
    const value = measure === "count" ? b.count : measure === "profit" ? b.profitCents : b.revenueCents
    const extra =
      measure === "count"
        ? STATUSES.filter((s) => b.byStatus[s]).map((s) => ({ label: STATUS_STYLE[s].short, value: String(b.byStatus[s]), color: STATUS_STYLE[s].color }))
        : [
            { label: "الطلبات", value: String(b.count) },
            ...(measure === "profit" ? [{ label: "المبيعات", value: money(b.revenueCents) }] : [{ label: "الربح", value: money(b.profitCents) }]),
          ]
    return { key: b.from, axis, label, value, extra }
  })
  const format = measure === "count" ? (v: number) => String(Math.round(v)) : moneyAxis

  return (
    <div className="space-y-4" data-analytics>
      {/* ── الصف الأول: الرقم الرئيسي ومؤشراته ── */}
      <div className="grid gap-3 lg:grid-cols-3">
        <section
          className="relative flex flex-col overflow-hidden rounded-2xl bg-gradient-to-br from-[#16324F] via-[#0F2238] to-[#0E1A28] p-5 ring-1 ring-white/10"
          data-kpi="hero-profit"
        >
          <div aria-hidden className="pointer-events-none absolute -left-16 -top-16 h-48 w-48 rounded-full bg-[#EF790F]/20 blur-3xl" />
          <p className={`flex items-center gap-2 text-xs font-bold ${T.sub}`}>
            <CircleDollarSign className="h-4 w-4 text-[#F7A04B]" aria-hidden />
            صافي الربح — {periodLabel}
          </p>
          <p className="mt-2 text-5xl font-extrabold tracking-tight text-[#EEF2F7]">
            <bdi dir="ltr">{money(now.profitCents)}</bdi>
          </p>
          <div className="mt-2 min-h-5">{before && <Delta value={change(now.profitCents, before.profitCents)} vs={vs} />}</div>
          <div className="mt-auto pt-3">
            <Sparkline values={series.buckets.map((b) => b.profitCents)} ariaLabel={`الربح ${UNIT_WORD[series.unit]}`} />
          </div>
        </section>

        <div className="grid grid-cols-2 gap-3 lg:col-span-2">
          <Tile id="a-count" label="الطلبات" value={String(now.count)} foot={before ? <Delta value={change(now.count, before.count)} vs={vs} /> : <span className={`text-[11px] ${T.muted}`}>منها {now.rejected} مرفوضة</span>} />
          <Tile
            id="a-avg-profit"
            label="متوسط الربح للطلب"
            value={money(Math.round(avgProfit))}
            foot={before ? <Delta value={change(avgProfit, avgProfitBefore)} vs={vs} /> : <span className={`text-[11px] ${T.muted}`}>بلا المرفوضة</span>}
          />
          <Tile
            id="a-collect"
            label="نسبة التحصيل"
            value={`${Math.round(collectRate * 100)}%`}
            foot={
              <div className="space-y-1.5">
                <Meter value={collectRate} label="نسبة التحصيل" />
                <p className={`text-[11px] ${T.muted}`}>
                  <bdi dir="ltr">{money(now.paidCents)}</bdi> من <bdi dir="ltr">{money(now.revenueCents)}</bdi>
                </p>
              </div>
            }
          />
          <Tile
            id="a-speed"
            label="متوسط مدة الإصدار"
            value={proc.toApproval.n ? daysLabel(proc.toApproval.avg, 1) : "—"}
            foot={
              proc.toApproval.n ? (
                procBefore?.toApproval.n ? (
                  <Delta value={change(proc.toApproval.avg!, procBefore.toApproval.avg!)} vs={vs} upIsGood={false} />
                ) : (
                  <span className={`text-[11px] ${T.muted}`}>من {proc.toApproval.n} طلب</span>
                )
              ) : (
                <span className={`text-[11px] ${T.muted}`}>يبدأ مع أول إصدار من اللوحة</span>
              )
            }
          />
        </div>
      </div>

      {/* ── السلسلة الزمنية ── */}
      <Panel
        title={`${MEASURES.find((x) => x.key === measure)!.label} ${UNIT_WORD[series.unit]}`}
        icon={Activity}
        hint={`حسب تاريخ التقديم · ${periodLabel}${measure !== "count" ? " · بلا المرفوضة" : ""}`}
        action={
          <div className="flex shrink-0 rounded-xl bg-[#07111C] p-1 ring-1 ring-white/[0.06]" role="radiogroup" aria-label="المقياس">
            {MEASURES.map((x) => (
              <button
                key={x.key}
                role="radio"
                aria-checked={measure === x.key}
                onClick={() => setMeasure(x.key)}
                data-measure={x.key}
                className={`h-8 rounded-lg px-3 text-xs font-bold transition ${measure === x.key ? "bg-[#1A2A3E] text-[#EEF2F7]" : T.muted}`}
              >
                {x.label}
              </button>
            ))}
          </div>
        }
      >
        {current.length ? (
          <ColumnChart data={columns} format={format} ariaLabel={`${MEASURES.find((x) => x.key === measure)!.label} ${UNIT_WORD[series.unit]}`} tableHead={["الفترة", MEASURES.find((x) => x.key === measure)!.label]} />
        ) : (
          <Empty text={`لا طلبات في ${periodLabel}`} />
        )}
      </Panel>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* ── توزيع الحالات ── */}
        <Panel title="أين وصلت الطلبات" icon={PieChart} hint={`${now.count} طلب · ${periodLabel}`} data-status-split>
          <StackedBar
            ariaLabel="توزيع الطلبات على الحالات"
            segments={STATUSES.map((s) => {
              const Icon = STATUS_ICON[s]
              return {
                key: s,
                label: STATUS_STYLE[s].short,
                value: current.filter((r) => r.status === s).length,
                color: STATUS_STYLE[s].color,
                icon: <Icon className="h-3.5 w-3.5" aria-hidden />,
              }
            })}
          />
          <table className="mt-5 w-full text-xs" data-stage-values>
            <thead>
              <tr className={T.muted}>
                <th className="pb-2 text-right font-bold">المرحلة</th>
                <th className="pb-2 text-center font-bold">الطلبات</th>
                <th className="pb-2 text-left font-bold">المبيعات</th>
                <th className="pb-2 text-left font-bold">الربح</th>
              </tr>
            </thead>
            <tbody>
              {STATUSES.map((s) => {
                const t = totals(current.filter((r) => r.status === s))
                const Icon = STATUS_ICON[s]
                const rejected = s === "مرفوضة"
                return (
                  <tr key={s} className="border-t border-white/[0.05]">
                    <td className={`py-2 font-bold ${STATUS_STYLE[s].text}`}>
                      <span className="inline-flex items-center gap-1.5">
                        <Icon className="h-3.5 w-3.5" aria-hidden />
                        {STATUS_STYLE[s].short}
                      </span>
                    </td>
                    <td className="py-2 text-center font-bold tabular-nums text-[#EEF2F7]">{t.count}</td>
                    <td className={`py-2 text-left tabular-nums ${T.sub}`}>
                      <bdi dir="ltr">{rejected ? "—" : money(t.revenueCents)}</bdi>
                    </td>
                    <td className={`py-2 text-left font-bold tabular-nums ${rejected ? T.muted : T.good}`}>
                      <bdi dir="ltr">{rejected ? "—" : money(t.profitCents)}</bdi>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          <div className={`mt-3 flex items-center justify-between rounded-xl px-3 py-2.5 text-xs ${T.inset}`}>
            <span className={T.sub}>نسبة الرفض</span>
            <span className={`font-extrabold ${rejectRate > 0.1 ? T.bad : "text-[#EEF2F7]"}`}>
              <bdi dir="ltr">{Math.round(rejectRate * 100)}%</bdi>
            </span>
          </div>
        </Panel>

        {/* ── مدة الإنجاز ── */}
        <Panel
          title="مدة الإنجاز"
          icon={Timer}
          hint={proc.toApproval.n ? `من ${proc.toApproval.n} طلب له توقيت مسجّل` : undefined}
          data-processing
        >
          <div className="grid grid-cols-3 gap-2">
            <Mini label="تقديم ← إصدار" value={daysLabel(proc.toApproval.avg, 1)} sub={proc.toApproval.n ? `الوسيط ${daysLabel(proc.toApproval.median)}` : undefined} />
            <Mini label="إصدار ← تسليم" value={daysLabel(proc.handover.avg, 1)} sub={proc.handover.n ? `من ${proc.handover.n} طلب` : undefined} />
            <Mini label="تقديم ← تسليم" value={daysLabel(proc.toDelivery.avg, 1)} sub={proc.toDelivery.max !== null ? `الأطول ${daysLabel(proc.toDelivery.max)}` : undefined} />
          </div>
          {proc.toApproval.n ? (
            <div className="mt-4">
              <p className={`mb-1 text-xs font-bold ${T.sub}`}>كم استغرق الإصدار</p>
              <ColumnChart
                height={150}
                data={proc.distribution.map((d) => ({ key: d.label, axis: d.label, label: d.label, value: d.count }))}
                format={(v) => String(Math.round(v))}
                ariaLabel="توزيع مدة الإصدار"
                tableHead={["المدة", "الطلبات"]}
              />
            </div>
          ) : (
            <p className={`mt-4 rounded-xl px-3 py-3 text-xs leading-6 ${T.inset} ${T.sub}`}>
              تُسجَّل المدة تلقائياً من الآن: كل طلب يتحوّل إلى «صدرت» أو «سُلّمت» من اللوحة يُحفظ وقته، وتظهر هنا المتوسطات والتوزيع.
            </p>
          )}
          {proc.untimed > 0 && (
            <p className={`mt-3 text-[11px] ${T.muted}`}>
              {proc.untimed} طلب صدر قبل نقل البيانات — الأداة القديمة لم تسجّل متى، فلا يدخل الحساب.
            </p>
          )}
        </Panel>
      </div>

      {/* ── الجهات ── */}
      <Panel title="أداء الجهات" icon={Users} hint={`${agents.length} جهة · ${periodLabel} · المبالغ بلا المرفوضة`} data-agents>
        {agents.length ? <AgentsTable agents={agents} /> : <Empty text="لا جهات في هذه الفترة" />}
      </Panel>

      {/* ── الانتظار ── */}
      <Panel
        title="أطول الطلبات انتظاراً"
        icon={Hourglass}
        hint={queue.length ? `${queue.length} طلب قيد الإجراء الآن — من كل الفترات` : undefined}
        data-waiting
      >
        {queue.length ? (
          <ul className="divide-y divide-white/[0.05]">
            {queue.slice(0, 6).map(({ r, days }) => (
              <li key={r.id}>
                <button onClick={() => onOpen(r)} className="flex w-full items-center justify-between gap-3 py-2.5 text-right transition hover:bg-white/[0.02]">
                  <span className="min-w-0">
                    <span className={`block truncate text-sm font-bold ${T.ink}`}>{r.full_name}</span>
                    <span className={`text-xs ${T.muted}`}>{r.agent}</span>
                  </span>
                  <span
                    className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold ring-1 ${
                      days >= 3 ? "bg-[#e66767]/15 text-[#FCA5A5] ring-[#e66767]/35" : "bg-white/[0.04] text-[#A7B4C3] ring-white/10"
                    }`}
                  >
                    {days >= 3 && <TriangleAlert className="h-3.5 w-3.5" aria-hidden />}
                    {sinceLabel(days)}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <Empty text="لا طلبات معلّقة — كل شيء صدر أو سُلّم" good />
        )}
      </Panel>
    </div>
  )
}

function Tile({ id, label, value, foot }: { id: string; label: string; value: string; foot?: React.ReactNode }) {
  return (
    <div data-kpi={id} className={`${T.card} p-4`}>
      <p className={`text-xs font-bold ${T.sub}`}>{label}</p>
      <p className="mt-1.5 text-2xl font-extrabold text-[#EEF2F7] sm:text-3xl">
        {/* مبلغ أو نسبة → LTR؛ مدةٌ بالكلام («2.3 يوم») تبقى عربية الاتجاه */}
        {/[\u0600-\u06FF]/.test(value) ? value : <bdi dir="ltr">{value}</bdi>}
      </p>
      <div className="mt-1.5">{foot}</div>
    </div>
  )
}

function Mini({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className={`p-3 ${T.inset}`}>
      <p className={`text-[11px] font-bold ${T.muted}`}>{label}</p>
      <p className="mt-1 text-lg font-extrabold text-[#EEF2F7]">{value}</p>
      {sub && <p className={`mt-0.5 text-[11px] ${T.muted}`}>{sub}</p>}
    </div>
  )
}

function Empty({ text, good = false }: { text: string; good?: boolean }) {
  return (
    <p className={`flex items-center justify-center gap-2 rounded-xl py-8 text-sm ${T.inset} ${good ? T.good : T.muted}`}>
      {!good && <Gauge className="h-4 w-4" aria-hidden />}
      {text}
    </p>
  )
}

function AgentsTable({ agents }: { agents: ReturnType<typeof agentPerformance> }) {
  const most = Math.max(...agents.map((a) => a.count), 1)
  return (
    <>
      {/* الهاتف: بطاقة لكل جهة — جدولٌ بسبعة أعمدة يُخفي المبالغ خلف تمريرٍ لا يُرى */}
      <ul className="space-y-2 sm:hidden">
        {agents.map((a) => {
          const rate = a.revenueCents ? a.paidCents / a.revenueCents : 0
          return (
            <li key={a.agent} className={`p-3 ${T.inset}`} data-agent={a.agent}>
              <div className="flex items-center justify-between gap-2">
                <span className={`font-bold ${T.ink}`}>{a.agent}</span>
                <span className="flex items-center gap-2">
                  {a.rejected > 0 && <span className={`text-[11px] ${T.bad}`}>{a.rejected} مرفوض</span>}
                  <span className="text-lg font-extrabold text-[#EEF2F7]">{a.count}</span>
                </span>
              </div>
              <span className="mt-1.5 block h-1.5 overflow-hidden rounded-full bg-white/[0.05]">
                <span className="block h-full rounded-full bg-[#EF790F]" style={{ width: `${(a.count / most) * 100}%` }} />
              </span>
              <dl className="mt-2.5 grid grid-cols-4 gap-1 text-center text-[11px]">
                <div>
                  <dt className={T.muted}>المبيعات</dt>
                  <dd className={`font-bold ${T.sub}`}><bdi dir="ltr">{money(a.revenueCents)}</bdi></dd>
                </div>
                <div>
                  <dt className={T.muted}>الربح</dt>
                  <dd className={`font-extrabold ${T.good}`}><bdi dir="ltr">{money(a.profitCents)}</bdi></dd>
                </div>
                <div>
                  <dt className={T.muted}>التحصيل</dt>
                  <dd className={`font-bold ${rate < 1 ? T.accent : T.sub}`}><bdi dir="ltr">{Math.round(rate * 100)}%</bdi></dd>
                </div>
                <div>
                  <dt className={T.muted}>الإصدار</dt>
                  <dd className={`font-bold ${T.sub}`}>{a.approval.n ? daysLabel(a.approval.avg, 1) : "—"}</dd>
                </div>
              </dl>
              {a.outstandingCents > 0 && (
                <p className={`mt-2 text-[11px] font-bold ${T.bad}`}>
                  متبقٍّ عليها <bdi dir="ltr">{money(a.outstandingCents)}</bdi>
                </p>
              )}
            </li>
          )
        })}
      </ul>

      <div className="hidden sm:block">
        <table className="w-full text-sm">
          <thead>
            <tr className={`text-[11px] ${T.muted}`}>
              <th className="pb-2 text-right font-bold">الجهة</th>
              <th className="pb-2 text-right font-bold">الطلبات</th>
              <th className="pb-2 text-left font-bold">المبيعات</th>
              <th className="pb-2 text-left font-bold">الربح</th>
              <th className="pb-2 text-left font-bold">التحصيل</th>
              <th className="pb-2 text-left font-bold">المتبقي</th>
              <th className="pb-2 text-left font-bold">مدة الإصدار</th>
            </tr>
          </thead>
          <tbody>
            {agents.map((a) => {
              const rate = a.revenueCents ? a.paidCents / a.revenueCents : 0
              return (
                <tr key={a.agent} className="border-t border-white/[0.05]" data-agent={a.agent}>
                  <td className={`py-2.5 pe-3 font-bold ${T.ink}`}>{a.agent}</td>
                  <td className="py-2.5 pe-3">
                    <div className="flex items-center gap-2">
                      <span className="w-6 font-extrabold tabular-nums text-[#EEF2F7]">{a.count}</span>
                      <span className="h-1.5 w-24 overflow-hidden rounded-full bg-white/[0.05]">
                        <span className="block h-full rounded-full bg-[#EF790F]" style={{ width: `${(a.count / most) * 100}%` }} />
                      </span>
                      {a.rejected > 0 && <span className={`text-[11px] ${T.bad}`}>{a.rejected} مرفوض</span>}
                    </div>
                  </td>
                  <td className={`py-2.5 text-left tabular-nums ${T.sub}`}>
                    <bdi dir="ltr">{money(a.revenueCents)}</bdi>
                  </td>
                  <td className={`py-2.5 text-left font-extrabold tabular-nums ${T.good}`}>
                    <bdi dir="ltr">{money(a.profitCents)}</bdi>
                  </td>
                  <td className="py-2.5 text-left">
                    <span className={`font-bold tabular-nums ${rate < 1 ? T.accent : T.sub}`}>
                      <bdi dir="ltr">{Math.round(rate * 100)}%</bdi>
                    </span>
                  </td>
                  <td className={`py-2.5 text-left font-bold tabular-nums ${a.outstandingCents ? T.bad : T.muted}`}>
                    <bdi dir="ltr">{a.outstandingCents ? money(a.outstandingCents) : "—"}</bdi>
                  </td>
                  <td className={`py-2.5 text-left tabular-nums ${T.sub}`}>{a.approval.n ? daysLabel(a.approval.avg, 1) : "—"}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </>
  )
}
