import { Suspense } from "react"
import { redirect } from "next/navigation"
import { financeToken } from "@/lib/finance-auth"
import {
  agencyNetProfit,
  FinanceAuthError,
  FinanceForbiddenError,
  listCategories,
  listExpenses,
  type Expense,
  type ExpenseCategory,
} from "@/lib/finance-store"
import { fromCents, sdg, sudanMonth, summarizeMonth } from "@/lib/finance-format"
import { monthLabel, monthRange } from "@/lib/dashboard-format"
import { MonthFilter } from "@/components/dashboard/month-filter"
import { ExpenseForm } from "@/components/finances/expense-form"
import { ExpenseList } from "@/components/finances/expense-list"

export const dynamic = "force-dynamic"

const PATH = "/admin/finances/personal"

// ─── لبنات العرض ─────────────────────────────────────────────────────────────

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl bg-white p-4 shadow-sm">
      <h2 className="mb-3 text-sm font-extrabold text-[#164563]">{title}</h2>
      {children}
    </section>
  )
}

/** الرقم الكبير بأرقام تناسبية لا جدولية: الجدولية تمطّ الرقم المنفرد. */
function Kpi({ label, cents, hint }: { label: string; cents: number; hint?: string }) {
  return (
    <div className="rounded-2xl bg-white p-4 shadow-sm">
      <p className="text-xs font-semibold text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-extrabold text-[#164563]">
        <bdi dir="ltr">{sdg(fromCents(cents))}</bdi>
      </p>
      <p className="mt-0.5 text-[11px] text-slate-400">{hint ?? "جنيه"}</p>
    </div>
  )
}

/**
 * الفائض أو العجز. اللون حالة (أخضر/أحمر)، والحالة لا تُحمَّل على اللون
 * وحده: معه أيقونة وكلمة، فيقرؤها من لا يميّز الأحمر من الأخضر أيضاً.
 *
 * والعدّاد تحته نسبةٌ واحدة إلى حدّ — كم استُهلك من الأرباح. يمتلئ بلون
 * يشتدّ مع الخطر، ومساره درجةٌ أفتح من نفس اللون فتُقرأ الحالة على
 * طوله كلّه.
 */
function Surplus({ cents, pct }: { cents: number; pct: number | null }) {
  const ok = cents >= 0
  const tone =
    pct === null ? null : pct > 100 ? "danger" : pct >= 70 ? "warning" : "ok"
  const meter = {
    ok: { fill: "bg-[#164563]", track: "bg-[#dbe6ef]" },
    warning: { fill: "bg-amber-500", track: "bg-amber-100" },
    danger: { fill: "bg-red-600", track: "bg-red-100" },
  }

  return (
    <div
      data-surplus={ok ? "positive" : "negative"}
      className={`rounded-2xl p-4 shadow-sm ${ok ? "bg-emerald-50" : "bg-red-50"}`}
    >
      <p className={`flex items-center gap-1.5 text-xs font-bold ${ok ? "text-emerald-800" : "text-red-800"}`}>
        <span aria-hidden>{ok ? "▲" : "▼"}</span>
        {ok ? "الفائض المتبقّي للادخار" : "عجز — المنصرفات تجاوزت الدخل"}
      </p>
      <p className={`mt-1 text-3xl font-extrabold ${ok ? "text-emerald-700" : "text-red-700"}`}>
        <bdi dir="ltr">{(ok ? "" : "−") + sdg(fromCents(Math.abs(cents)))}</bdi>
        <span className="ms-1.5 text-sm font-semibold">جنيه</span>
      </p>

      {pct !== null && tone ? (
        <div className="mt-3">
          <div
            role="meter"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.min(pct, 100)}
            aria-label="نسبة المستهلك من أرباح الوكالة"
            className={`h-2.5 w-full overflow-hidden rounded-full ${meter[tone].track}`}
          >
            <div className={`h-full rounded-full ${meter[tone].fill}`} style={{ width: `${Math.min(pct, 100)}%` }} />
          </div>
          <p className="mt-1.5 text-xs font-medium text-slate-600">
            استهلكت <span className="font-extrabold text-slate-800">{pct}%</span> من أرباح الوكالة هذا الشهر
          </p>
        </div>
      ) : (
        <p className="mt-2 text-xs font-medium text-slate-600">لا أرباح موجبة هذا الشهر تُقاس عليها النسبة</p>
      )}
    </div>
  )
}

/**
 * أين ذهب المال: أشرطة أفقية بلون واحد، مرتّبة من الأكبر. المهمّة مقارنة
 * مقادير، فالدائرة أضعف هنا — العين لا تقارن زوايا متقاربة. كل قيمة
 * مكتوبة نصّاً أيضاً، فالشريط يُسرّع القراءة ولا يحتكرها.
 */
function Breakdown({ rows }: { rows: ReturnType<typeof summarizeMonth>["byCategory"] }) {
  if (!rows.length) return <p className="py-2 text-sm text-slate-400">لا منصرفات في هذا الشهر</p>
  const max = rows[0].cents
  return (
    <ul className="space-y-3">
      {rows.map((r) => (
        <li key={r.name} title={`${r.name}: ${sdg(fromCents(r.cents))} جنيه — ${r.share}%`}>
          <div className="mb-1 flex items-baseline justify-between gap-2 text-sm">
            <span className="font-semibold text-slate-700">{r.name}</span>
            <span className="shrink-0 tabular-nums text-slate-600">
              <bdi dir="ltr" className="font-bold text-slate-800">{sdg(fromCents(r.cents))}</bdi>
              <span className="text-xs text-slate-400"> · {r.share}% · {r.count} {r.count === 1 ? "بند" : "بنود"}</span>
            </span>
          </div>
          {/* سماكة ١٢ بكسل، مربّع عند خطّ البداية ومدوّر ٤ بكسل عند طرف القيمة */}
          <div className="h-3">
            <div
              className="h-full rounded-e-[4px] bg-[#164563]"
              style={{ width: `${Math.max((r.cents / max) * 100, 1.5)}%` }}
            />
          </div>
        </li>
      ))}
    </ul>
  )
}

// ─── الصفحة ──────────────────────────────────────────────────────────────────

export default async function PersonalFinancePage({ searchParams }: { searchParams: Promise<{ month?: string }> }) {
  const { month } = await searchParams
  const ym = /^\d{4}-(0[1-9]|1[0-2])$/.test(month || "") ? month! : sudanMonth()
  const { from, to } = monthRange(ym)
  const here = month ? `${PATH}?month=${ym}` : PATH

  const token = await financeToken()
  if (!token) redirect(`/admin/finances/login?next=${encodeURIComponent(here)}`)

  let categories: ExpenseCategory[] = []
  let expenses: Expense[] = []
  let income = 0
  let failure: "auth" | "forbidden" | null = null
  let error = ""
  try {
    ;[categories, expenses, income] = await Promise.all([
      listCategories(token),
      listExpenses(token, from, to),
      agencyNetProfit(token, from, to),
    ])
  } catch (e) {
    if (e instanceof FinanceAuthError) failure = "auth"
    else if (e instanceof FinanceForbiddenError) failure = "forbidden"
    else error = e instanceof Error ? e.message : String(e)
  }

  // خارج try: redirect يعمل برمي استثناء، وcatch كان سيبتلعه.
  if (failure === "auth") redirect(`/admin/finances/login?next=${encodeURIComponent(here)}`)
  if (failure === "forbidden") {
    return (
      <p role="alert" className="rounded-2xl bg-amber-50 p-6 text-center text-sm font-medium text-amber-800">
        هذا الحساب غير مخوّل لقسم المنصرفات.
      </p>
    )
  }

  const s = summarizeMonth(income, expenses)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-xl font-extrabold text-[#164563]">{monthLabel(ym)}</h1>
        <Suspense fallback={null}>
          <MonthFilter value={ym} path={PATH} />
        </Suspense>
      </div>

      {error && (
        <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
          {error}
        </p>
      )}

      <div className="grid grid-cols-2 gap-3" data-kpis>
        <Kpi label="صافي أرباح الوكالة" cents={s.incomeCents} />
        <Kpi label="إجمالي منصرفاتك" cents={s.spentCents} hint={`جنيه · ${expenses.length} بند`} />
      </div>
      <Surplus cents={s.surplusCents} pct={s.consumedPct} />

      <Panel title="تسجيل بند">
        <ExpenseForm categories={categories} />
      </Panel>

      <Panel title="أين ذهبت المنصرفات">
        <Breakdown rows={s.byCategory} />
      </Panel>

      <section>
        <h2 className="mb-2 px-1 text-sm font-extrabold text-[#164563]">سجل {monthLabel(ym)}</h2>
        <ExpenseList rows={expenses} categories={categories} />
      </section>
    </div>
  )
}
