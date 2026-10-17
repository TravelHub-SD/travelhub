"use client"

import type React from "react"
import { useEffect, useMemo, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import {
  BadgeCheck,
  ChartColumn,
  CircleCheck,
  CircleDollarSign,
  Clock3,
  FileJson,
  FileSpreadsheet,
  Inbox,
  LayoutList,
  Plus,
  Search,
  TriangleAlert,
  Upload,
  Wallet,
  X,
  type LucideIcon,
} from "lucide-react"
import { todayISO } from "@/lib/dashboard-format"
import {
  STATUSES,
  STATUS_STYLE,
  fromCents,
  matches,
  pricePresets,
  summarize,
  toCsv,
  toLegacyJson,
  usd,
  type Approval,
  type ApprovalStatus,
} from "@/lib/approvals-format"
import { PERIODS, inRange, periodRange, type PeriodKey } from "@/lib/approvals-analytics"
import { fromLegacy, MAX_IMPORT } from "@/lib/approvals-validate"
import { ApprovalForm, toLogin } from "@/components/approvals/approval-form"
import { ApprovalCard } from "@/components/approvals/approval-card"
import { AnalyticsView } from "@/components/approvals/analytics-view"
import { STATUS_ICON, T } from "@/components/approvals/ui"

export type View = "list" | "analytics"

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

const isDesktop = () => typeof window !== "undefined" && window.matchMedia("(min-width: 1024px)").matches

// ─── لبنات العرض ─────────────────────────────────────────────────────────────

function Kpi({
  id,
  label,
  value,
  hint,
  icon: Icon,
  tone = "plain",
}: {
  id: string
  label: string
  value: string
  hint?: React.ReactNode
  icon: LucideIcon
  tone?: "plain" | "warn" | "bad" | "hero"
}) {
  const ring = { plain: "ring-white/[0.07]", warn: "ring-[#c98500]/40", bad: "ring-[#e66767]/40", hero: "ring-[#EF790F]/40" }[tone]
  const glow = tone === "hero" ? "bg-gradient-to-br from-[#2A1E14] via-[#16202C] to-[#0E1A28]" : "bg-[#0E1A28]"
  const iconTone = { plain: "text-[#7D8EA3]", warn: "text-[#FCD34D]", bad: "text-[#FCA5A5]", hero: "text-[#F7A04B]" }[tone]
  return (
    <div data-kpi={id} className={`relative rounded-2xl p-3.5 ring-1 ${ring} ${glow}`}>
      <p className={`flex items-center justify-between gap-2 text-[11px] font-bold ${T.sub}`}>
        {label}
        <Icon className={`h-4 w-4 shrink-0 ${iconTone}`} aria-hidden />
      </p>
      <p className={`mt-1.5 text-xl font-extrabold sm:text-2xl ${tone === "hero" ? "text-[#F7A04B]" : T.ink}`}>
        <bdi dir="ltr">{value}</bdi>
      </p>
      {hint && <p className={`mt-0.5 text-[11px] ${tone === "warn" ? "text-[#FCD34D]" : tone === "bad" ? T.bad : T.muted}`}>{hint}</p>}
    </div>
  )
}

/** على الهاتف أيقونةٌ فقط؛ الاسم في aria-label لقارئ الشاشة، وفي title عند المرور. */
function ToolButton({ id, icon: Icon, label, onClick, disabled, title }: { id: string; icon: LucideIcon; label: string; onClick: () => void; disabled?: boolean; title?: string }) {
  return (
    <button onClick={onClick} disabled={disabled} title={title} aria-label={label} data-tool={id} className={`${T.ghost} h-10 px-3 text-xs`}>
      <Icon className="h-4 w-4" aria-hidden />
      <span className="hidden sm:inline">{label}</span>
    </button>
  )
}

// ─── اللوحة ─────────────────────────────────────────────────────────────────

export function ApprovalsBoard({ rows, initialView = "list" }: { rows: Approval[]; initialView?: View }) {
  const router = useRouter()
  const today = todayISO()
  const [view, setView] = useState<View>(initialView)
  const [period, setPeriod] = useState<PeriodKey>("all")
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
  const nameRef = useRef<HTMLInputElement>(null)

  const range = useMemo(() => periodRange(period, today), [period, today])
  const periodLabel = PERIODS.find((p) => p.key === period)!.label
  const inPeriod = useMemo(() => rows.filter((r) => inRange(r, range.from, range.to)), [rows, range])
  const summary = useMemo(() => summarize(inPeriod, today), [inPeriod, today])
  const visible = useMemo(() => inPeriod.filter((r) => (status === "all" || r.status === status) && matches(r, query)), [inPeriod, status, query])

  // من كل السجلات لا من الفترة: الاقتراحات تخدم الإدخال لا التقرير.
  const knownAgents = useMemo(() => {
    const freq = new Map<string, number>()
    for (const r of rows) freq.set(r.agent, (freq.get(r.agent) || 0) + 1)
    return [...freq.entries()].sort((a, b) => b[1] - a[1]).map(([a]) => a)
  }, [rows])
  const presets = useMemo(() => pricePresets(rows), [rows])

  // التبويب في الرابط: يبقى بعد التحديث، ويُرسل لمن يريد التحليلات مباشرة.
  function switchView(v: View) {
    setView(v)
    const url = new URL(window.location.href)
    if (v === "analytics") url.searchParams.set("view", "analytics")
    else url.searchParams.delete("view")
    window.history.replaceState(null, "", url)
  }

  // ورقة النموذج على الهاتف: لا تمرير للصفحة خلفها، وEsc يغلقها.
  const sheetOpen = formOpen || editing !== null
  useEffect(() => {
    if (!sheetOpen || isDesktop()) return
    const prev = document.body.style.overflow
    document.body.style.overflow = "hidden"
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return
      setEditing(null)
      setFormOpen(false)
    }
    document.addEventListener("keydown", onKey)
    return () => {
      document.body.style.overflow = prev
      document.removeEventListener("keydown", onKey)
    }
  }, [sheetOpen])

  function flash(kind: "ok" | "err", text: string) {
    setNotice({ kind, text })
    setTimeout(() => setNotice((n) => (n?.text === text ? null : n)), 5000)
  }

  function newRequest() {
    setEditing(null)
    if (isDesktop()) {
      switchView("list")
      requestAnimationFrame(() => {
        formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })
        nameRef.current?.focus()
      })
    } else setFormOpen(true)
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
    if (isDesktop()) requestAnimationFrame(() => formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }))
  }

  /** من «أطول الطلبات انتظاراً» إلى الطلب نفسه في القائمة. */
  function openRequest(r: Approval) {
    setStatus("all")
    setPeriod("all")
    setQuery(r.passport_no)
    switchView("list")
    window.scrollTo({ top: 0, behavior: "smooth" })
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

  const done = summary.byStatus["صدرت الموافقة"] + summary.byStatus["تم التسليم"]

  return (
    <div className="space-y-4">
      {/* ── العنوان والأدوات ── */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className={`text-2xl font-extrabold tracking-tight ${T.ink}`}>الموافقات الأمنية</h1>
          <p className={`mt-0.5 text-xs ${T.muted}`}>{rows.length} طلب مسجّل · المبالغ بالدولار</p>
        </div>
        <div className="flex items-center gap-1.5">
          <ToolButton
            id="excel"
            icon={FileSpreadsheet}
            label={`Excel (${visible.length})`}
            title="ما يظهر الآن حسب الفلاتر — يُفتح في Excel"
            disabled={!visible.length}
            onClick={() => download(`الموافقات_${today}.csv`, toCsv(visible), "text/csv;charset=utf-8")}
          />
          <ToolButton
            id="json"
            icon={FileJson}
            label="نسخة JSON"
            title="كل الطلبات — بصيغة الأداة القديمة"
            disabled={!rows.length}
            onClick={() => download(`security_approvals_backup_${today}.json`, toLegacyJson(rows), "application/json")}
          />
          <ToolButton id="import" icon={Upload} label="استيراد" title="ملف JSON من الأداة القديمة أو من هنا" onClick={() => fileRef.current?.click()} />
          <input ref={fileRef} type="file" accept=".json,application/json" onChange={pickFile} className="hidden" data-import-input />
          <button onClick={newRequest} className={`${T.primary} h-10 px-4 text-sm`} data-new-request>
            <Plus className="h-4 w-4" aria-hidden strokeWidth={2.8} />
            طلب جديد
          </button>
        </div>
      </div>

      {/* ── التبويب والفترة: صفٌّ واحد فوق كل ما يحكمانه ── */}
      <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex rounded-2xl bg-[#0E1A28] p-1 ring-1 ring-white/[0.07]" role="tablist" aria-label="العرض">
          {(
            [
              ["list", "الطلبات", LayoutList],
              ["analytics", "التحليلات", ChartColumn],
            ] as const
          ).map(([key, label, Icon]) => (
            <button
              key={key}
              role="tab"
              aria-selected={view === key}
              data-view={key}
              onClick={() => switchView(key)}
              className={`flex h-10 flex-1 items-center justify-center gap-2 rounded-xl px-5 text-sm font-bold transition sm:flex-none ${
                view === key ? "bg-[#1A2A3E] text-[#EEF2F7] shadow-[inset_0_-2px_0_#EF790F]" : `${T.muted} hover:text-[#A7B4C3]`
              }`}
            >
              <Icon className="h-4 w-4" aria-hidden />
              {label}
            </button>
          ))}
        </div>
        <div className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-0.5 [scrollbar-width:none]" role="radiogroup" aria-label="الفترة">
          {PERIODS.map((p) => (
            <button
              key={p.key}
              role="radio"
              aria-checked={period === p.key}
              onClick={() => {
                setPeriod(p.key)
                setLimit(60)
              }}
              className={`h-9 shrink-0 whitespace-nowrap rounded-xl px-3 text-xs font-bold ring-1 transition ${
                period === p.key ? "bg-[#EF790F]/15 text-[#F7A04B] ring-[#EF790F]/50" : `bg-transparent ${T.muted} ring-white/[0.07] hover:text-[#A7B4C3]`
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {notice && (
        <p
          role={notice.kind === "err" ? "alert" : "status"}
          data-notice={notice.kind}
          className={`flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-bold ring-1 ${
            notice.kind === "ok" ? "bg-[#199e70]/15 text-[#6EE7B7] ring-[#199e70]/30" : "bg-[#e66767]/15 text-[#FCA5A5] ring-[#e66767]/30"
          }`}
        >
          {notice.kind === "ok" ? <CircleCheck className="h-4 w-4 shrink-0" aria-hidden /> : <TriangleAlert className="h-4 w-4 shrink-0" aria-hidden />}
          {notice.text}
        </p>
      )}

      {pending && (
        <section data-import-preview className="rounded-2xl bg-[#0E1A28] p-4 ring-1 ring-[#EF790F]/40">
          <h2 className={`flex items-center gap-2 text-sm font-extrabold ${T.ink}`}>
            <Upload className="h-4 w-4 text-[#F7A04B]" aria-hidden />
            معاينة الاستيراد
          </h2>
          <ul className={`mt-3 space-y-1.5 text-sm ${T.sub}`}>
            <li>
              <span className={`font-extrabold ${T.good}`}>{pending.fresh}</span> طلب جديد سيُضاف
            </li>
            <li>
              <span className={`font-extrabold ${T.ink}`}>{pending.existing}</span> موجود مسبقاً سيُتخطّى — لا يُكتب فوقه
            </li>
            {pending.invalid.length > 0 && (
              <li className={T.bad}>
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
          <div className="mt-4 flex gap-2">
            <button onClick={() => setPending(null)} className={`${T.ghost} h-11 flex-1 text-sm`}>
              إلغاء
            </button>
            <button onClick={confirmImport} disabled={!pending.fresh || busy === "import"} className={`${T.primary} h-11 flex-[2] text-sm`}>
              {busy === "import" ? "جارٍ الاستيراد…" : `استيراد ${pending.fresh} طلب`}
            </button>
          </div>
        </section>
      )}

      {view === "analytics" ? (
        <AnalyticsView rows={rows} range={range} periodLabel={periodLabel} today={today} onOpen={openRequest} />
      ) : (
        <>
          {/* ── المؤشرات ── */}
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 xl:grid-cols-6">
            <Kpi id="total" icon={Inbox} label={`الطلبات — ${periodLabel}`} value={String(summary.total)} hint={summary.byStatus["مرفوضة"] ? `منها ${summary.byStatus["مرفوضة"]} مرفوضة` : undefined} />
            <Kpi
              id="pending"
              icon={Clock3}
              label="قيد الإجراء"
              value={String(summary.byStatus["قيد الإجراء"])}
              hint={summary.overdue ? `${summary.overdue} متأخر 3 أيام فأكثر` : "لا متأخر"}
              tone={summary.overdue ? "warn" : "plain"}
            />
            <Kpi id="done" icon={BadgeCheck} label="صدرت / سُلّمت" value={String(done)} hint={`${summary.byStatus["تم التسليم"]} سُلّمت للعميل`} />
            <Kpi id="collected" icon={Wallet} label="المحصّل" value={usd(fromCents(summary.collectedCents))} hint={<>من مبيعات <bdi dir="ltr">{usd(fromCents(summary.revenueCents))}</bdi></>} />
            <Kpi
              id="outstanding"
              icon={TriangleAlert}
              label="المتبقي عند العملاء"
              value={usd(fromCents(summary.outstandingCents))}
              hint={summary.outstandingCents ? "بلا الطلبات المرفوضة" : "لا ديون"}
              tone={summary.outstandingCents ? "bad" : "plain"}
            />
            <Kpi id="profit" icon={CircleDollarSign} label="صافي الربح" value={usd(fromCents(summary.profitCents))} hint="بلا الطلبات المرفوضة" tone="hero" />
          </div>

          <div className="lg:grid lg:grid-cols-12 lg:items-start lg:gap-5">
            {/* ── النموذج: عمودٌ ثابت على الشاشة العريضة، وورقةٌ من الأسفل على الهاتف ── */}
            {sheetOpen && (
              <div
                aria-hidden
                className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden"
                onClick={() => {
                  setEditing(null)
                  setFormOpen(false)
                }}
              />
            )}
            <aside className="lg:sticky lg:top-20 lg:col-span-4 lg:order-last">
              <div
                ref={formRef}
                className={`${sheetOpen ? "fixed inset-x-0 bottom-0 z-50 max-h-[92dvh] overflow-y-auto rounded-t-3xl" : "hidden"} scroll-mt-24 bg-[#0E1A28] p-4 pb-8 ring-1 ring-white/10 lg:static lg:z-auto lg:block lg:max-h-none lg:overflow-visible lg:rounded-2xl lg:pb-4 lg:ring-white/[0.07]`}
              >
                <div aria-hidden className="mx-auto mb-3 h-1 w-10 rounded-full bg-white/15 lg:hidden" />
                <div className="mb-4 flex items-center justify-between gap-2">
                  <h2 className={`flex items-center gap-2 text-sm font-extrabold ${T.ink}`}>
                    <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#EF790F]/15">
                      <Plus className="h-4 w-4 text-[#F7A04B]" aria-hidden />
                    </span>
                    {editing ? `تعديل طلب ${editing.full_name}` : "تسجيل طلب جديد"}
                  </h2>
                  <button
                    onClick={() => {
                      setEditing(null)
                      setFormOpen(false)
                    }}
                    aria-label="إغلاق"
                    className={`${T.ghost} h-9 w-9 lg:hidden`}
                  >
                    <X className="h-4 w-4" aria-hidden />
                  </button>
                </div>
                <ApprovalForm
                  key={editing?.id ?? "new"}
                  existing={editing ?? undefined}
                  agents={knownAgents}
                  presets={presets}
                  nameRef={nameRef}
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
            </aside>

            {/* ── القائمة ── */}
            <section className="mt-4 space-y-3 lg:col-span-8 lg:mt-0">
              <div className={`space-y-2.5 p-3 ${T.card}`}>
                <label className="relative block">
                  <Search className="pointer-events-none absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#7D8EA3]" aria-hidden />
                  <input
                    type="search"
                    value={query}
                    onChange={(e) => {
                      setQuery(e.target.value)
                      setLimit(60)
                    }}
                    placeholder="ابحث بالاسم أو الجواز أو الجهة أو الهاتف…"
                    aria-label="بحث"
                    className={`${T.field} h-11 pe-3.5 ps-10 text-sm`}
                  />
                </label>
                {/* تمرير أفقي على الهاتف بدل الالتفاف */}
                <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-0.5 [scrollbar-width:none]" role="radiogroup" aria-label="الحالة">
                  {(["all", ...STATUSES] as const).map((s) => {
                    const on = status === s
                    const count = s === "all" ? summary.total : summary.byStatus[s]
                    const Icon = s === "all" ? LayoutList : STATUS_ICON[s]
                    return (
                      <button
                        key={s}
                        role="radio"
                        aria-checked={on}
                        data-status-filter={s}
                        onClick={() => setStatus(s)}
                        className={`flex h-9 shrink-0 items-center gap-1.5 rounded-full px-3 text-xs font-bold ring-1 transition ${
                          on
                            ? s === "all"
                              ? "bg-[#1A2A3E] text-[#EEF2F7] ring-white/20"
                              : `${STATUS_STYLE[s].tint} ${STATUS_STYLE[s].text}`
                            : `${T.muted} ring-white/[0.07] hover:text-[#A7B4C3]`
                        }`}
                      >
                        <Icon className="h-3.5 w-3.5" aria-hidden />
                        {s === "all" ? "الكل" : STATUS_STYLE[s].short}
                        <span className="opacity-70">{count}</span>
                      </button>
                    )
                  })}
                </div>
              </div>

              {visible.length === 0 ? (
                <div data-empty className={`flex flex-col items-center gap-2 py-12 text-center text-sm ${T.card} ${T.muted}`}>
                  <Inbox className="h-8 w-8 opacity-60" aria-hidden />
                  {rows.length ? "لا طلبات مطابقة — جرّب كلمة أخرى أو فلتراً آخر" : "لا طلبات بعد — سجّل أول طلب، أو استورد ملف الأداة القديمة"}
                </div>
              ) : (
                <ul className="space-y-2.5">
                  {visible.slice(0, limit).map((r) => (
                    <ApprovalCard
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
                <button onClick={() => setLimit((l) => l + 60)} className={`${T.ghost} h-11 w-full text-sm`}>
                  عرض المزيد ({visible.length - limit})
                </button>
              )}
            </section>
          </div>
        </>
      )}
    </div>
  )
}
