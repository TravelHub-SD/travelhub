import Link from "next/link"
import { Suspense } from "react"
import { listTransactions, type Transaction } from "@/lib/dashboard-store"
import { currentMonth, money, monthLabel, monthRange, todayISO, SOURCE_LABEL } from "@/lib/dashboard-format"
import { MonthFilter } from "@/components/dashboard/month-filter"

export const dynamic = "force-dynamic"

// ─── حساب أرقام الشهر ────────────────────────────────────────────────────────
// الشهر الجاري يُقاس بالأيام المنقضية منه فقط: قسمة ربح ١٠ أيام على ٣٠ يوماً
// تعطي معدّلاً يبدو ثلث الحقيقة، وأيام المستقبل ليست "أيام صفر" بعد.
function summarize(rows: Transaction[], ym: string) {
  const { days } = monthRange(ym)
  const today = todayISO()
  const elapsed = ym === currentMonth() ? Number(today.slice(8, 10)) : days

  const total = rows.reduce((s, r) => s + r.net_profit, 0)
  const withDays = new Set(rows.map((r) => r.date))

  let zeroDays = 0
  for (let d = 1; d <= elapsed; d++) {
    const iso = `${ym}-${String(d).padStart(2, "0")}`
    if (!withDays.has(iso)) zeroDays++
  }

  return {
    total,
    count: rows.length,
    zeroDays,
    elapsed,
    perDay: elapsed > 0 ? Math.round(total / elapsed) : 0,
  }
}

function bySource(rows: Transaction[]) {
  const total = rows.reduce((s, r) => s + r.net_profit, 0)
  return (["وكيل", "مباشر"] as const).map((src) => {
    const of = rows.filter((r) => r.source === src)
    const sum = of.reduce((s, r) => s + r.net_profit, 0)
    return {
      source: SOURCE_LABEL[src],
      sum,
      count: of.length,
      share: total ? Math.round((sum / total) * 100) : 0,
    }
  })
}

function byService(rows: Transaction[]) {
  const map = new Map<string, { sum: number; count: number }>()
  for (const r of rows) {
    const cur = map.get(r.service_type) || { sum: 0, count: 0 }
    cur.sum += r.net_profit
    cur.count += 1
    map.set(r.service_type, cur)
  }
  return [...map.entries()]
    .map(([service, v]) => ({ service, ...v, avg: Math.round(v.sum / v.count) }))
    .sort((a, b) => b.sum - a.sum)
}

function byAgent(rows: Transaction[]) {
  const map = new Map<string, { sum: number; count: number }>()
  for (const r of rows) {
    if (r.source !== "وكيل") continue
    const name = r.agents?.name || `وكيل #${r.agent_id}`
    const cur = map.get(name) || { sum: 0, count: 0 }
    cur.sum += r.net_profit
    cur.count += 1
    map.set(name, cur)
  }
  return [...map.entries()].map(([name, v]) => ({ name, ...v })).sort((a, b) => b.sum - a.sum)
}

function dailySeries(rows: Transaction[], ym: string) {
  const { days } = monthRange(ym)
  const out = Array.from({ length: days }, (_, i) => ({ day: i + 1, sum: 0 }))
  for (const r of rows) {
    const d = Number(r.date.slice(8, 10))
    if (d >= 1 && d <= days) out[d - 1].sum += r.net_profit
  }
  return out
}

// ─── لبنات العرض ─────────────────────────────────────────────────────────────

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-2xl bg-white p-4 shadow-sm">
      <p className="text-xs font-semibold text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-extrabold tabular-nums text-[#164563]">{value}</p>
      {hint && <p className="mt-0.5 text-[11px] text-slate-400">{hint}</p>}
    </div>
  )
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl bg-white p-4 shadow-sm">
      <h2 className="mb-3 text-sm font-extrabold text-[#164563]">{title}</h2>
      {children}
    </section>
  )
}

const TH = "px-2 py-2 text-right text-xs font-bold text-slate-500"
const TD = "px-2 py-2 text-right text-sm tabular-nums"

// ─── الصفحة ──────────────────────────────────────────────────────────────────

export default async function DashboardHomePage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>
}) {
  const { month } = await searchParams
  const ym = /^\d{4}-\d{2}$/.test(month || "") ? month! : currentMonth()
  const { from, to } = monthRange(ym)

  let rows: Transaction[] = []
  let error = ""
  try {
    rows = await listTransactions({ from, to, limit: 2000 })
  } catch (e) {
    error = e instanceof Error ? e.message : String(e)
  }

  const s = summarize(rows, ym)
  const sources = bySource(rows)
  const services = byService(rows)
  const agents = byAgent(rows)
  const series = dailySeries(rows, ym)
  const peak = Math.max(1, ...series.map((d) => Math.abs(d.sum)))

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-xl font-extrabold text-[#164563]">{monthLabel(ym)}</h1>
        <Suspense fallback={null}>
          <MonthFilter value={ym} />
        </Suspense>
      </div>

      {error && (
        <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
          {error}
        </p>
      )}

      <div className="grid grid-cols-2 gap-3">
        <Stat label="إجمالي صافي الربح" value={money(s.total)} hint="جنيه" />
        <Stat label="المعدل اليومي" value={money(s.perDay)} hint={`على ${s.elapsed} يوم`} />
        <Stat label="عدد العمليات" value={money(s.count)} />
        <Stat label="أيام الصفر" value={money(s.zeroDays)} hint={`من ${s.elapsed} يوم`} />
      </div>

      <Link
        href="/dashboard/new"
        className="block rounded-2xl bg-[#EF790F] py-4 text-center text-base font-extrabold text-white shadow-sm active:scale-[0.99]"
      >
        + تسجيل عملية جديدة
      </Link>

      <Panel title="الربح حسب المصدر">
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-100">
              <th className={TH}>المصدر</th>
              <th className={TH}>العمليات</th>
              <th className={TH}>صافي الربح</th>
              <th className={TH}>النسبة</th>
            </tr>
          </thead>
          <tbody>
            {sources.map((r) => (
              <tr key={r.source} className="border-b border-slate-50 last:border-0">
                <td className={`${TD} font-semibold`}>{r.source}</td>
                <td className={`${TD} text-slate-500`}>{money(r.count)}</td>
                <td className={`${TD} font-bold`}>{money(r.sum)}</td>
                <td className={`${TD} text-slate-500`}>{r.share}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Panel>

      <Panel title="الربح حسب نوع الخدمة">
        {services.length ? (
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-100">
                <th className={TH}>الخدمة</th>
                <th className={TH}>العمليات</th>
                <th className={TH}>صافي الربح</th>
                <th className={TH}>متوسط العملية</th>
              </tr>
            </thead>
            <tbody>
              {services.map((r) => (
                <tr key={r.service} className="border-b border-slate-50 last:border-0">
                  <td className={`${TD} font-semibold`}>{r.service}</td>
                  <td className={`${TD} text-slate-500`}>{money(r.count)}</td>
                  <td className={`${TD} font-bold`}>{money(r.sum)}</td>
                  <td className={`${TD} text-slate-500`}>{money(r.avg)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="py-2 text-sm text-slate-400">لا عمليات في هذا الشهر</p>
        )}
      </Panel>

      <Panel title="ترتيب الوكلاء">
        {agents.length ? (
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-100">
                <th className={TH}>الوكيل</th>
                <th className={TH}>العمليات</th>
                <th className={TH}>صافي ربح الوكالة</th>
              </tr>
            </thead>
            <tbody>
              {agents.map((r, i) => (
                <tr key={r.name} className="border-b border-slate-50 last:border-0">
                  <td className={`${TD} font-semibold`}>
                    <span className="ms-1 text-xs text-slate-400">{i + 1}.</span> {r.name}
                  </td>
                  <td className={`${TD} text-slate-500`}>{money(r.count)}</td>
                  <td className={`${TD} font-bold`}>{money(r.sum)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="py-2 text-sm text-slate-400">لا عمليات من وكلاء في هذا الشهر</p>
        )}
      </Panel>

      <Panel title="صافي الربح اليومي">
        {/* تمرير أفقي: ٣٠ عموداً لا تتّسع لعرض الهاتف بلا سحق */}
        <div className="overflow-x-auto pb-1">
          <div className="flex h-40 min-w-full items-end gap-1" style={{ minWidth: `${series.length * 18}px` }}>
            {series.map((d) => {
              const h = Math.round((Math.abs(d.sum) / peak) * 100)
              return (
                <div key={d.day} className="flex flex-1 flex-col items-center gap-1" title={`${d.day}: ${money(d.sum)}`}>
                  <div className="flex h-32 w-full items-end">
                    <div
                      className={`w-full rounded-t ${d.sum < 0 ? "bg-red-400" : d.sum > 0 ? "bg-[#164563]" : "bg-slate-200"}`}
                      style={{ height: `${d.sum === 0 ? 2 : Math.max(h, 3)}%` }}
                    />
                  </div>
                  <span className="text-[9px] tabular-nums text-slate-400">{d.day}</span>
                </div>
              )
            })}
          </div>
        </div>
      </Panel>
    </div>
  )
}
