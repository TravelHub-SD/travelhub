"use client"

import { useMemo, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { todayISO } from "@/lib/dashboard-format"
import {
  NEXT_STATUS,
  OVERDUE_DAYS,
  STATUSES,
  STATUS_STYLE,
  byAgent,
  daysBetween,
  fromCents,
  matches,
  pricePresets,
  profitOf,
  remainingOf,
  shortDate,
  summarize,
  toCsv,
  toLegacyJson,
  usd,
  type Approval,
  type ApprovalStatus,
} from "@/lib/approvals-format"
import { fromLegacy, MAX_IMPORT } from "@/lib/approvals-validate"
import { ApprovalForm, toLogin } from "@/components/approvals/approval-form"

type Period = "all" | "this" | "last"

const PERIODS: { key: Period; label: string }[] = [
  { key: "all", label: "كل الفترات" },
  { key: "this", label: "هذا الشهر" },
  { key: "last", label: "الشهر الماضي" },
]

function monthOf(today: string, back: number): string {
  const d = new Date(`${today.slice(0, 7)}-01T00:00:00`)
  d.setMonth(d.getMonth() - back)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
}

/** الحقول بأسماء الجدول من سجلٍّ موجود — للإجراءات السريعة التي تغيّر حقلاً واحداً. */
function inputOf(r: Approval) {
  const { full_name, passport_no, phone, agent, apply_date, status, approval_ref, sale_price, cost_price, paid_amount, notes } = r
  return { full_name, passport_no, phone, agent, apply_date, status, approval_ref, sale_price, cost_price, paid_amount, notes }
}

function download(name: string, content: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }))
  const a = document.createElement("a")
  a.href = url
  a.download = name
  a.click()
  URL.revokeObjectURL(url)
}

// ─── لبنات العرض ─────────────────────────────────────────────────────────────

function Kpi({ id, label, value, hint, tone = "plain" }: { id: string; label: string; value: string; hint?: string; tone?: "plain" | "warn" | "bad" | "hero" }) {
  const box = {
    plain: "bg-white",
    warn: "bg-white ring-1 ring-amber-200",
    bad: "bg-white ring-1 ring-red-200",
    hero: "bg-[#164563] text-white",
  }[tone]
  return (
    <div data-kpi={id} className={`rounded-2xl p-3.5 shadow-sm ${box}`}>
      <p className={`text-[11px] font-bold ${tone === "hero" ? "text-sky-100" : "text-slate-500"}`}>{label}</p>
      <p className={`mt-1 text-xl font-extrabold sm:text-2xl ${tone === "hero" ? "text-white" : "text-[#164563]"}`}>
        <bdi dir="ltr">{value}</bdi>
      </p>
      {hint && <p className={`mt-0.5 text-[11px] ${tone === "hero" ? "text-sky-100/80" : "text-slate-400"}`}>{hint}</p>}
    </div>
  )
}

function StatusBadge({ status }: { status: ApprovalStatus }) {
  const s = STATUS_STYLE[status]
  return (
    <span className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-bold ring-1 ${s.badge}`}>
      <span aria-hidden>{s.icon}</span>
      {status}
    </span>
  )
}

// ─── اللوحة ─────────────────────────────────────────────────────────────────

export function ApprovalsBoard({ rows }: { rows: Approval[] }) {
  const router = useRouter()
  const today = todayISO()
  const [period, setPeriod] = useState<Period>("all")
  const [status, setStatus] = useState<ApprovalStatus | "all">("all")
  const [query, setQuery] = useState("")
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Approval | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [notice, setNotice] = useState<{ kind: "ok" | "err"; text: string } | null>(null)
  const [limit, setLimit] = useState(60)
  const [pending, setPending] = useState<{ fresh: number; existing: number; invalid: { name: string; error: string }[]; records: unknown[] } | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const formRef = useRef<HTMLDivElement>(null)

  const inPeriod = useMemo(() => {
    if (period === "all") return rows
    const ym = monthOf(today, period === "this" ? 0 : 1)
    return rows.filter((r) => r.apply_date.startsWith(ym))
  }, [rows, period, today])

  const summary = useMemo(() => summarize(inPeriod, today), [inPeriod, today])
  const agents = useMemo(() => byAgent(inPeriod), [inPeriod])
  const visible = useMemo(
    () => inPeriod.filter((r) => (status === "all" || r.status === status) && matches(r, query)),
    [inPeriod, status, query],
  )

  // من كل السجلات لا من الفترة: الاقتراحات تخدم الإدخال لا التقرير.
  const knownAgents = useMemo(() => {
    const freq = new Map<string, number>()
    for (const r of rows) freq.set(r.agent, (freq.get(r.agent) || 0) + 1)
    return [...freq.entries()].sort((a, b) => b[1] - a[1]).map(([a]) => a)
  }, [rows])
  const presets = useMemo(() => pricePresets(rows), [rows])

  function flash(kind: "ok" | "err", text: string) {
    setNotice({ kind, text })
    setTimeout(() => setNotice((n) => (n?.text === text ? null : n)), 5000)
  }

  async function patch(r: Approval, change: Partial<ReturnType<typeof inputOf>>, okText: string) {
    setBusy(r.id)
    try {
      const res = await fetch(`/api/admin/approvals/${r.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...inputOf(r), ...change }),
      })
      if (res.status === 401) return toLogin()
      const json = await res.json().catch(() => ({}))
      if (!res.ok) flash("err", json?.error || "تعذّر الحفظ")
      else {
        flash("ok", okText)
        router.refresh()
      }
    } catch {
      flash("err", "تعذّر الاتصال — تحقّق من الشبكة")
    } finally {
      setBusy(null)
    }
  }

  async function remove(r: Approval) {
    if (!confirm(`حذف طلب ${r.full_name} (${r.passport_no})؟\nيبقى محفوظاً في سجلّ التغييرات ويمكن استرجاعه.`)) return
    setBusy(r.id)
    try {
      const res = await fetch(`/api/admin/approvals/${r.id}`, { method: "DELETE" })
      if (res.status === 401) return toLogin()
      const json = await res.json().catch(() => ({}))
      if (!res.ok) flash("err", json?.error || "تعذّر الحذف")
      else {
        flash("ok", `حُذف طلب ${r.full_name}`)
        router.refresh()
      }
    } catch {
      flash("err", "تعذّر الاتصال — تحقّق من الشبكة")
    } finally {
      setBusy(null)
    }
  }

  function startEdit(r: Approval) {
    setEditing(r)
    setFormOpen(true)
    requestAnimationFrame(() => formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }))
  }

  // ── الاستيراد: قراءة ومعاينة في المتصفح، ثم التأكيد. لا شيء يُكتب قبل الموافقة.
  async function pickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ""
    if (!file) return
    let data: unknown
    try {
      data = JSON.parse(await file.text())
    } catch {
      return flash("err", "الملف ليس JSON صالحاً")
    }
    if (!Array.isArray(data)) return flash("err", "الملف ليس قائمة سجلات")
    if (data.length > MAX_IMPORT) return flash("err", `الحدّ ${MAX_IMPORT} سجل في المرة`)
    const known = new Set(rows.flatMap((r) => [r.id, r.legacy_id].filter(Boolean) as string[]))
    let fresh = 0
    let existing = 0
    const invalid: { name: string; error: string }[] = []
    for (const raw of data) {
      const p = fromLegacy(raw)
      if (!p.ok) invalid.push({ name: String((raw as any)?.fullName ?? (raw as any)?.full_name ?? "؟").slice(0, 40), error: p.error })
      else if (known.has(p.value.legacy_id)) existing++
      else {
        fresh++
        known.add(p.value.legacy_id)
      }
    }
    setPending({ fresh, existing, invalid, records: data })
  }

  async function confirmImport() {
    if (!pending) return
    setBusy("import")
    try {
      const res = await fetch("/api/admin/approvals/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ records: pending.records }),
      })
      if (res.status === 401) return toLogin()
      const json = await res.json().catch(() => ({}))
      if (!res.ok) flash("err", json?.error || "تعذّر الاستيراد")
      else {
        flash("ok", `استُورد ${json.inserted} طلب${json.skipped ? ` — وتُخطّي ${json.skipped} موجود مسبقاً` : ""}`)
        setPending(null)
        router.refresh()
      }
    } catch {
      flash("err", "تعذّر الاتصال — تحقّق من الشبكة")
    } finally {
      setBusy(null)
    }
  }

  const stamp = today
  const periodLabel = PERIODS.find((p) => p.key === period)!.label

  return (
    <div className="space-y-4">
      {/* ── العنوان والأدوات ── */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-extrabold text-[#164563]">الموافقات الأمنية</h1>
          <p className="text-xs text-slate-500">
            {rows.length} طلب مسجّل · المبالغ بالدولار
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            onClick={() => download(`الموافقات_${stamp}.csv`, toCsv(visible), "text/csv;charset=utf-8")}
            disabled={!visible.length}
            className="h-10 rounded-xl bg-white px-3 text-xs font-bold text-slate-700 shadow-sm ring-1 ring-slate-200 disabled:opacity-40"
            title="ما يظهر الآن حسب الفلاتر — يُفتح في Excel"
          >
            Excel ({visible.length})
          </button>
          <button
            onClick={() => download(`security_approvals_backup_${stamp}.json`, toLegacyJson(rows), "application/json")}
            disabled={!rows.length}
            className="h-10 rounded-xl bg-white px-3 text-xs font-bold text-slate-700 shadow-sm ring-1 ring-slate-200 disabled:opacity-40"
            title="كل الطلبات — بصيغة الأداة القديمة"
          >
            نسخة JSON
          </button>
          <button
            onClick={() => fileRef.current?.click()}
            className="h-10 rounded-xl bg-white px-3 text-xs font-bold text-slate-700 shadow-sm ring-1 ring-slate-200"
          >
            استيراد
          </button>
          <input ref={fileRef} type="file" accept=".json,application/json" onChange={pickFile} className="hidden" data-import-input />
          <button
            onClick={() => {
              setEditing(null)
              setFormOpen((o) => !o)
            }}
            className="h-10 rounded-xl bg-[#EF790F] px-4 text-sm font-extrabold text-white shadow-sm lg:hidden"
          >
            {formOpen && !editing ? "إخفاء النموذج" : "+ طلب جديد"}
          </button>
        </div>
      </div>

      {notice && (
        <p
          role={notice.kind === "err" ? "alert" : "status"}
          data-notice={notice.kind}
          className={`rounded-xl px-4 py-2.5 text-sm font-bold ${notice.kind === "ok" ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-700"}`}
        >
          {notice.text}
        </p>
      )}

      {pending && (
        <section data-import-preview className="rounded-2xl bg-white p-4 shadow-sm ring-2 ring-[#164563]/20">
          <h2 className="text-sm font-extrabold text-[#164563]">معاينة الاستيراد</h2>
          <ul className="mt-2 space-y-1 text-sm">
            <li>
              <span className="font-extrabold text-emerald-700">{pending.fresh}</span> طلب جديد سيُضاف
            </li>
            <li>
              <span className="font-extrabold text-slate-600">{pending.existing}</span> موجود مسبقاً سيُتخطّى — لا يُكتب فوقه
            </li>
            {pending.invalid.length > 0 && (
              <li className="text-red-700">
                <span className="font-extrabold">{pending.invalid.length}</span> غير صالح لن يُستورد:
                <ul className="mt-1 list-inside list-disc text-xs">
                  {pending.invalid.slice(0, 5).map((x, i) => (
                    <li key={i}>
                      {x.name} — {x.error}
                    </li>
                  ))}
                </ul>
              </li>
            )}
          </ul>
          <div className="mt-3 flex gap-2">
            <button onClick={() => setPending(null)} className="h-10 flex-1 rounded-xl border border-slate-300 text-sm font-bold text-slate-600">
              إلغاء
            </button>
            <button
              onClick={confirmImport}
              disabled={!pending.fresh || busy === "import"}
              className="h-10 flex-[2] rounded-xl bg-[#164563] text-sm font-extrabold text-white disabled:opacity-40"
            >
              {busy === "import" ? "جارٍ الاستيراد…" : `استيراد ${pending.fresh} طلب`}
            </button>
          </div>
        </section>
      )}

      {/* ── المؤشرات ── */}
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 xl:grid-cols-6">
        <Kpi id="total" label={`الطلبات — ${periodLabel}`} value={String(summary.total)} hint={summary.byStatus["مرفوضة"] ? `منها ${summary.byStatus["مرفوضة"]} مرفوضة` : undefined} />
        <Kpi
          id="pending"
          label="قيد الإجراء"
          value={String(summary.byStatus["قيد الإجراء"])}
          hint={summary.overdue ? `${summary.overdue} منذ ${OVERDUE_DAYS} أيام فأكثر` : "لا متأخر"}
          tone={summary.overdue ? "warn" : "plain"}
        />
        <Kpi id="done" label="صدرت / سُلّمت" value={String(summary.byStatus["صدرت الموافقة"] + summary.byStatus["تم التسليم"])} hint={`${summary.byStatus["تم التسليم"]} سُلّمت للعميل`} />
        <Kpi id="collected" label="المحصّل" value={usd(fromCents(summary.collectedCents))} hint={`من مبيعات ${usd(fromCents(summary.revenueCents))}`} />
        <Kpi
          id="outstanding"
          label="المتبقي عند العملاء"
          value={usd(fromCents(summary.outstandingCents))}
          hint={summary.outstandingCents ? "بلا الطلبات المرفوضة" : "لا ديون ✓"}
          tone={summary.outstandingCents ? "bad" : "plain"}
        />
        <Kpi id="profit" label="صافي الربح" value={usd(fromCents(summary.profitCents))} hint="بلا الطلبات المرفوضة" tone="hero" />
      </div>

      <div className="lg:grid lg:grid-cols-12 lg:items-start lg:gap-5">
        {/* ── النموذج: ظاهر دائماً على الشاشة العريضة، وبزرٍّ على الهاتف ── */}
        <aside className="space-y-4 lg:sticky lg:top-20 lg:col-span-4">
          <div ref={formRef} className={`${formOpen || editing ? "block" : "hidden"} scroll-mt-20 rounded-2xl bg-white p-4 shadow-sm lg:block`}>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-extrabold text-[#164563]">{editing ? `تعديل طلب ${editing.full_name}` : "تسجيل طلب جديد"}</h2>
            </div>
            <ApprovalForm
              key={editing?.id ?? "new"}
              existing={editing ?? undefined}
              agents={knownAgents}
              presets={presets}
              onSaved={(row) => {
                if (editing) {
                  flash("ok", `حُفظ تعديل طلب ${row.full_name}`)
                  setEditing(null)
                  setFormOpen(false)
                }
              }}
              onCancel={editing ? () => setEditing(null) : undefined}
            />
          </div>

          {agents.length > 0 && (
            <section className="hidden rounded-2xl bg-white p-4 shadow-sm lg:block" data-agents>
              <AgentsTable agents={agents} />
            </section>
          )}
        </aside>

        {/* ── القائمة ── */}
        <section className="mt-4 space-y-3 lg:col-span-8 lg:mt-0">
          <div className="space-y-2.5 rounded-2xl bg-white p-3 shadow-sm">
            <div className="flex flex-wrap gap-2">
              <input
                type="search"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value)
                  setLimit(60)
                }}
                placeholder="ابحث بالاسم أو الجواز أو الجهة أو الهاتف…"
                aria-label="بحث"
                className="h-11 w-full min-w-0 rounded-xl border border-slate-300 px-3.5 text-sm outline-none focus:border-[#EF790F] focus:ring-2 focus:ring-[#EF790F]/30 sm:w-auto sm:flex-1"
              />
              <div className="flex w-full rounded-xl bg-slate-100 p-1 sm:w-auto" role="radiogroup" aria-label="الفترة">
                {PERIODS.map((p) => (
                  <button
                    key={p.key}
                    role="radio"
                    aria-checked={period === p.key}
                    onClick={() => setPeriod(p.key)}
                    className={`h-9 flex-1 whitespace-nowrap rounded-lg px-2.5 text-xs font-bold transition sm:flex-none ${
                      period === p.key ? "bg-white text-[#164563] shadow-sm" : "text-slate-500"
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            {/* تمرير أفقي على الهاتف بدل الالتفاف */}
            <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-0.5 [scrollbar-width:none]" role="radiogroup" aria-label="الحالة">
              {(["all", ...STATUSES] as const).map((s) => {
                const on = status === s
                const count = s === "all" ? summary.total : summary.byStatus[s]
                return (
                  <button
                    key={s}
                    role="radio"
                    aria-checked={on}
                    data-status-filter={s}
                    onClick={() => setStatus(s)}
                    className={`flex h-9 shrink-0 items-center gap-1.5 rounded-full px-3 text-xs font-bold ring-1 transition ${
                      on ? "bg-[#164563] text-white ring-[#164563]" : "bg-white text-slate-600 ring-slate-200"
                    }`}
                  >
                    {s !== "all" && <span aria-hidden className={`h-2 w-2 rounded-full ${STATUS_STYLE[s].dot}`} />}
                    {s === "all" ? "الكل" : STATUS_STYLE[s].short}
                    <span className={on ? "text-white/70" : "text-slate-400"}>{count}</span>
                  </button>
                )
              })}
            </div>
          </div>

          {visible.length === 0 ? (
            <p data-empty className="rounded-2xl bg-white p-8 text-center text-sm text-slate-400 shadow-sm">
              {rows.length ? "لا طلبات مطابقة — جرّب كلمة أخرى أو فلتراً آخر" : "لا طلبات بعد — سجّل أول طلب، أو استورد ملف الأداة القديمة"}
            </p>
          ) : (
            <ul className="space-y-2.5">
              {visible.slice(0, limit).map((r) => (
                <ApprovalItem
                  key={r.id}
                  r={r}
                  today={today}
                  busy={busy === r.id}
                  onAdvance={(next) => patch(r, { status: next }, `${r.full_name}: ${next}`)}
                  onCollect={() => patch(r, { paid_amount: r.sale_price }, `حُصّل المتبقي من ${r.full_name}`)}
                  onEdit={() => startEdit(r)}
                  onDelete={() => remove(r)}
                />
              ))}
            </ul>
          )}
          {visible.length > limit && (
            <button
              onClick={() => setLimit((l) => l + 60)}
              className="h-11 w-full rounded-xl bg-white text-sm font-bold text-[#164563] shadow-sm ring-1 ring-slate-200"
            >
              عرض المزيد ({visible.length - limit})
            </button>
          )}

          {agents.length > 0 && (
            <section className="rounded-2xl bg-white p-4 shadow-sm lg:hidden">
              <AgentsTable agents={agents} />
            </section>
          )}
        </section>
      </div>
    </div>
  )
}

/** «منذ يوم»، «منذ يومين»، «منذ ٣ أيام»، «منذ ١١ يوماً» — لا «منذ 1 يوم». */
function sinceLabel(days: number): string {
  if (days <= 0) return "اليوم"
  if (days === 1) return "منذ يوم"
  if (days === 2) return "منذ يومين"
  if (days <= 10) return `منذ ${days} أيام`
  return `منذ ${days} يوماً`
}

function ApprovalItem({
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
  const age = r.status === "قيد الإجراء" ? daysBetween(r.apply_date, today) : null
  const late = age !== null && age >= OVERDUE_DAYS

  return (
    <li data-approval={r.id} data-status={r.status} className={`rounded-2xl bg-white p-3.5 shadow-sm ${busy ? "opacity-60" : ""}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          {/* نصٌّ يُعرض كنص: React يهرّبه. الأداة القديمة كانت تحقنه في innerHTML،
              فاسمٌ مثل <img onerror=…> كان يُنفَّذ كسكربت. */}
          <p className="break-words text-[15px] font-extrabold text-slate-900">{r.full_name}</p>
          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500">
            <bdi dir="ltr" className="rounded bg-slate-100 px-1.5 py-0.5 font-mono font-bold text-slate-700">
              {r.passport_no}
            </bdi>
            <span className="font-semibold text-slate-600">{r.agent}</span>
            <span>{shortDate(r.apply_date, today)}</span>
            {r.phone && (
              <a href={`tel:${r.phone}`} dir="ltr" className="text-[#164563] underline-offset-2 hover:underline">
                {r.phone}
              </a>
            )}
          </div>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <StatusBadge status={r.status} />
          {age !== null && (
            <span className={`text-[11px] font-bold ${late ? "text-red-600" : "text-slate-400"}`} data-age={age}>
              {sinceLabel(age)}
            </span>
          )}
          {r.approval_ref && <bdi dir="ltr" className="font-mono text-[11px] text-slate-500">#{r.approval_ref}</bdi>}
        </div>
      </div>

      <dl className="mt-2.5 grid grid-cols-4 gap-1 rounded-xl bg-slate-50 p-2 text-center text-[11px]">
        <div>
          <dt className="text-slate-400">البيع</dt>
          <dd className="font-bold text-slate-800"><bdi dir="ltr">{usd(r.sale_price)}</bdi></dd>
        </div>
        <div>
          <dt className="text-slate-400">التكلفة</dt>
          <dd className="font-bold text-slate-600"><bdi dir="ltr">{usd(r.cost_price)}</bdi></dd>
        </div>
        <div>
          <dt className="text-slate-400">الربح</dt>
          <dd className={`font-extrabold ${r.status === "مرفوضة" ? "text-slate-400 line-through" : profit >= 0 ? "text-emerald-700" : "text-red-700"}`}>
            <bdi dir="ltr">{usd(profit)}</bdi>
          </dd>
        </div>
        <div>
          <dt className="text-slate-400">التحصيل</dt>
          <dd className={`font-bold ${remaining > 0 ? "text-red-700" : "text-emerald-700"}`} data-remaining={remaining}>
            {remaining > 0 ? <>باقٍ <bdi dir="ltr">{usd(remaining)}</bdi></> : "خالص ✓"}
          </dd>
        </div>
      </dl>

      {r.notes && <p className="mt-2 break-words text-xs text-slate-500">📝 {r.notes}</p>}

      <div className="mt-2.5 flex flex-wrap gap-1.5">
        {next && (
          <button
            disabled={busy}
            onClick={() => onAdvance(next)}
            data-action="advance"
            className="h-9 flex-1 rounded-lg bg-[#164563] px-4 text-xs font-bold text-white disabled:opacity-50 sm:flex-none"
          >
            {STATUS_STYLE[next].icon} {next === "صدرت الموافقة" ? "صدرت الموافقة" : "سُلّمت للعميل"}
          </button>
        )}
        {remaining > 0 && r.status !== "مرفوضة" && (
          <button
            disabled={busy}
            onClick={onCollect}
            data-action="collect"
            className="h-9 flex-1 rounded-lg bg-emerald-600 px-4 text-xs font-bold text-white disabled:opacity-50 sm:flex-none"
          >
            تحصيل <bdi dir="ltr">{usd(remaining)}</bdi>
          </button>
        )}
        <button
          disabled={busy}
          onClick={onEdit}
          data-action="edit"
          className="h-9 rounded-lg bg-slate-100 px-3.5 text-xs font-bold text-slate-700 active:bg-slate-200 disabled:opacity-50"
        >
          تعديل
        </button>
        <button
          disabled={busy}
          onClick={onDelete}
          data-action="delete"
          className="h-9 rounded-lg bg-red-50 px-3.5 text-xs font-bold text-red-700 active:bg-red-100 disabled:opacity-50"
        >
          حذف
        </button>
      </div>
    </li>
  )
}

function AgentsTable({ agents }: { agents: ReturnType<typeof byAgent> }) {
  return (
    <>
      <h2 className="mb-2 text-sm font-extrabold text-[#164563]">حسب الجهة</h2>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-100 text-[11px] text-slate-400">
            <th className="py-1.5 text-right font-bold">الجهة</th>
            <th className="py-1.5 text-center font-bold">الطلبات</th>
            <th className="py-1.5 text-left font-bold">الربح</th>
          </tr>
        </thead>
        <tbody>
          {agents.slice(0, 8).map((a) => (
            <tr key={a.agent} className="border-b border-slate-50 last:border-0">
              <td className="py-1.5 font-semibold text-slate-700">
                {a.agent}
                {a.outstandingCents > 0 && (
                  <span className="ms-1 text-[11px] font-bold text-red-600">
                    (عليه <bdi dir="ltr">{usd(fromCents(a.outstandingCents))}</bdi>)
                  </span>
                )}
              </td>
              <td className="py-1.5 text-center tabular-nums text-slate-600">{a.count}</td>
              <td className="py-1.5 text-left font-bold tabular-nums text-emerald-700">
                <bdi dir="ltr">{usd(fromCents(a.profitCents))}</bdi>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  )
}
