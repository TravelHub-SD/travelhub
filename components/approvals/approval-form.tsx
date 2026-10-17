"use client"

import { useId, useMemo, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { todayISO } from "@/lib/dashboard-format"
import { STATUSES, STATUS_STYLE, cents, fromCents, usd, type Approval, type ApprovalStatus } from "@/lib/approvals-format"
import { DateField } from "@/components/dashboard/date-field"

const FIELD =
  "h-12 w-full rounded-xl border border-slate-300 bg-white px-3.5 text-base outline-none focus:border-[#EF790F] focus:ring-2 focus:ring-[#EF790F]/30"
const LABEL = "mb-1 block text-xs font-bold text-slate-600"

type Values = {
  full_name: string
  passport_no: string
  phone: string
  agent: string
  apply_date: string
  status: ApprovalStatus
  approval_ref: string
  sale_price: string
  cost_price: string
  paid_amount: string
  notes: string
}

const num = (s: string) => {
  const n = Number(String(s).replace(/[,\s$]/g, ""))
  return Number.isFinite(n) ? n : 0
}

export function toLogin() {
  window.location.href = `/admin/approvals/login?next=${encodeURIComponent(window.location.pathname + window.location.search)}`
}

export function ApprovalForm({
  existing,
  agents,
  presets,
  onSaved,
  onCancel,
}: {
  existing?: Approval
  agents: string[]
  presets: { sale: number; cost: number }[]
  onSaved?: (row: Approval) => void
  onCancel?: () => void
}) {
  const router = useRouter()
  const editing = Boolean(existing)
  const uid = useId()
  const id = (n: string) => `${uid}-${n}`
  const nameRef = useRef<HTMLInputElement>(null)

  const [v, setV] = useState<Values>(() =>
    existing
      ? {
          full_name: existing.full_name,
          passport_no: existing.passport_no,
          phone: existing.phone ?? "",
          agent: existing.agent,
          apply_date: existing.apply_date,
          status: existing.status,
          approval_ref: existing.approval_ref ?? "",
          sale_price: String(existing.sale_price),
          cost_price: String(existing.cost_price),
          paid_amount: String(existing.paid_amount),
          notes: existing.notes ?? "",
        }
      : {
          full_name: "",
          passport_no: "",
          phone: "",
          agent: "",
          // تاريخ الجهاز لا UTC: الأداة القديمة استعملت valueAsDate = new Date()
          // فسجّلت طلبات منتصف الليل حتى الثانية صباحاً بتاريخ الأمس.
          apply_date: todayISO(),
          status: "قيد الإجراء",
          approval_ref: "",
          sale_price: presets[0] ? String(presets[0].sale) : "",
          cost_price: presets[0] ? String(presets[0].cost) : "",
          paid_amount: "",
          notes: "",
        },
  )
  // كل طلباتك الحالية مدفوعة بالكامل عند التسجيل — فهذا الافتراضي، ويُلغى
  // للدفع الجزئي فيظهر حقل المدفوع.
  const [paidInFull, setPaidInFull] = useState(() =>
    existing ? cents(existing.paid_amount) === cents(existing.sale_price) : true,
  )
  const [error, setError] = useState("")
  const [saved, setSaved] = useState("")
  const [busy, setBusy] = useState(false)

  const set = (k: keyof Values) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setV((s) => ({ ...s, [k]: e.target.value }))

  const sale = num(v.sale_price)
  const cost = num(v.cost_price)
  const paid = paidInFull ? sale : num(v.paid_amount)
  const profit = fromCents(cents(sale) - cents(cost))
  const remaining = fromCents(cents(sale) - cents(paid))

  const agentOptions = useMemo(() => agents.filter((a) => a !== v.agent).slice(0, 30), [agents, v.agent])

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError("")
    setSaved("")
    try {
      const res = await fetch(editing ? `/api/admin/approvals/${existing!.id}` : "/api/admin/approvals", {
        method: editing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...v, paid_amount: paid }),
      })
      if (res.status === 401) return toLogin()
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(json?.error || "تعذّر الحفظ")
        return
      }
      onSaved?.(json.row)
      router.refresh()
      if (editing) return

      // تبقى الجهة والتاريخ والحالة والأسعار: الطلبات تأتي دفعات — أربعة
      // من «تايغر» في يوم واحد بنفس السعر. ويُفرَّغ ما يخصّ المسافر وحده.
      setSaved(`✓ سُجّل طلب ${v.full_name}`)
      setV((s) => ({ ...s, full_name: "", passport_no: "", phone: "", approval_ref: "", notes: "" }))
      nameRef.current?.focus()
    } catch {
      setError("تعذّر الاتصال — تحقّق من الشبكة")
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} className="space-y-3" data-approval-form={editing ? "edit" : "new"}>
      <div>
        <label htmlFor={id("name")} className={LABEL}>
          الاسم الرباعي للمسافر *
        </label>
        <input
          id={id("name")}
          ref={nameRef}
          name="full_name"
          required
          minLength={2}
          maxLength={200}
          autoComplete="off"
          placeholder="مثال: محمد أحمد علي عثمان"
          value={v.full_name}
          onChange={set("full_name")}
          className={FIELD}
        />
      </div>

      <div className="grid grid-cols-2 gap-2.5">
        <div>
          <label htmlFor={id("passport")} className={LABEL}>
            رقم الجواز *
          </label>
          <input
            id={id("passport")}
            name="passport_no"
            required
            maxLength={30}
            dir="ltr"
            autoComplete="off"
            autoCapitalize="characters"
            placeholder="P00000000"
            value={v.passport_no}
            onChange={set("passport_no")}
            className={`${FIELD} text-left font-mono uppercase`}
          />
        </div>
        <div>
          <label htmlFor={id("phone")} className={LABEL}>
            الهاتف / واتساب
          </label>
          <input
            id={id("phone")}
            name="phone"
            type="tel"
            inputMode="tel"
            maxLength={30}
            dir="ltr"
            autoComplete="off"
            placeholder="09xxxxxxxx"
            value={v.phone}
            onChange={set("phone")}
            className={`${FIELD} text-left`}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2.5">
        <div>
          <label htmlFor={id("agent")} className={LABEL}>
            الجهة / الوكيل
          </label>
          {/* اقتراحات من الجهات السابقة: «تايغر» لا تُكتب «تايقر» مرة و«تايغر» مرة */}
          <input
            id={id("agent")}
            name="agent"
            list={id("agents")}
            maxLength={100}
            autoComplete="off"
            placeholder="مباشر"
            value={v.agent}
            onChange={set("agent")}
            className={FIELD}
          />
          <datalist id={id("agents")}>
            {agentOptions.map((a) => (
              <option key={a} value={a} />
            ))}
          </datalist>
        </div>
        <div>
          <label htmlFor={id("ref")} className={LABEL}>
            رقم الموافقة / المرجع
          </label>
          <input
            id={id("ref")}
            name="approval_ref"
            maxLength={60}
            dir="ltr"
            autoComplete="off"
            placeholder="اختياري"
            value={v.approval_ref}
            onChange={set("approval_ref")}
            className={`${FIELD} text-left font-mono`}
          />
        </div>
      </div>

      <DateField
        id={id("date")}
        label="تاريخ التقديم *"
        value={v.apply_date}
        onChange={(d) => setV((s) => ({ ...s, apply_date: d }))}
      />

      <fieldset>
        <legend className={LABEL}>حالة الطلب</legend>
        <div className="grid grid-cols-2 gap-1.5" role="radiogroup">
          {STATUSES.map((s) => {
            const on = v.status === s
            return (
              <button
                key={s}
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => setV((x) => ({ ...x, status: s }))}
                className={`flex h-11 items-center justify-center gap-1 rounded-xl text-sm font-bold ring-1 transition ${
                  on ? `${STATUS_STYLE[s].badge} ring-2` : "bg-white text-slate-500 ring-slate-200"
                }`}
              >
                <span aria-hidden>{STATUS_STYLE[s].icon}</span>
                {STATUS_STYLE[s].short}
              </button>
            )
          })}
        </div>
      </fieldset>

      <div className="space-y-2.5 rounded-xl bg-slate-50 p-3 ring-1 ring-slate-200">
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs font-extrabold text-slate-700">المبالغ بالدولار</p>
          {presets.length > 0 && (
            <div className="flex flex-wrap justify-end gap-1">
              {presets.map((p) => (
                <button
                  key={`${p.sale}-${p.cost}`}
                  type="button"
                  data-preset
                  onClick={() => setV((s) => ({ ...s, sale_price: String(p.sale), cost_price: String(p.cost) }))}
                  className="rounded-lg bg-white px-2 py-1 text-[11px] font-bold text-[#164563] ring-1 ring-slate-200 hover:ring-[#164563]"
                  title={`سعر ${usd(p.sale)} — تكلفة ${usd(p.cost)}`}
                >
                  <bdi dir="ltr">
                    {p.sale} / {p.cost}
                  </bdi>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-2.5">
          <div>
            <label htmlFor={id("sale")} className={LABEL}>
              سعر البيع للعميل
            </label>
            <input
              id={id("sale")}
              name="sale_price"
              inputMode="decimal"
              dir="ltr"
              autoComplete="off"
              placeholder="0"
              value={v.sale_price}
              onChange={set("sale_price")}
              className={`${FIELD} text-left font-bold`}
            />
          </div>
          <div>
            <label htmlFor={id("cost")} className={LABEL}>
              تكلفة المصدر
            </label>
            <input
              id={id("cost")}
              name="cost_price"
              inputMode="decimal"
              dir="ltr"
              autoComplete="off"
              placeholder="0"
              value={v.cost_price}
              onChange={set("cost_price")}
              className={`${FIELD} text-left font-bold`}
            />
          </div>
        </div>

        <label className="flex cursor-pointer items-center gap-2 text-sm font-semibold text-slate-700">
          <input
            type="checkbox"
            name="paid_in_full"
            checked={paidInFull}
            onChange={(e) => {
              setPaidInFull(e.target.checked)
              if (!e.target.checked) setV((s) => ({ ...s, paid_amount: "" }))
            }}
            className="h-5 w-5 accent-[#164563]"
          />
          دفع العميل المبلغ كاملاً
        </label>

        {!paidInFull && (
          <div>
            <label htmlFor={id("paid")} className={LABEL}>
              المدفوع حتى الآن
            </label>
            <input
              id={id("paid")}
              name="paid_amount"
              inputMode="decimal"
              dir="ltr"
              autoComplete="off"
              placeholder="0"
              value={v.paid_amount}
              onChange={set("paid_amount")}
              className={`${FIELD} text-left font-bold`}
            />
          </div>
        )}

        <div className="flex items-center justify-between border-t border-slate-200 pt-2 text-sm" data-live>
          <span className={`font-extrabold ${profit >= 0 ? "text-emerald-700" : "text-red-700"}`}>
            الربح <bdi dir="ltr">{usd(profit)}</bdi>
          </span>
          <span className={`font-bold ${remaining > 0 ? "text-red-700" : remaining < 0 ? "text-red-700" : "text-slate-500"}`}>
            {remaining > 0 ? (
              <>
                متبقٍّ على العميل <bdi dir="ltr">{usd(remaining)}</bdi>
              </>
            ) : remaining < 0 ? (
              "المدفوع أكبر من السعر"
            ) : (
              "خالص ✓"
            )}
          </span>
        </div>
      </div>

      <div>
        <label htmlFor={id("notes")} className={LABEL}>
          ملاحظات
        </label>
        <textarea
          id={id("notes")}
          name="notes"
          rows={2}
          maxLength={1000}
          value={v.notes}
          onChange={set("notes")}
          className={`${FIELD} h-auto py-2.5`}
        />
      </div>

      {error && (
        <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
          {error}
        </p>
      )}
      {saved && (
        <p role="status" className="rounded-lg bg-emerald-50 px-3 py-2 text-sm font-bold text-emerald-700">
          {saved}
        </p>
      )}

      <div className="flex gap-2">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="h-12 flex-1 rounded-xl border border-slate-300 bg-white font-bold text-slate-600"
          >
            إلغاء
          </button>
        )}
        <button
          type="submit"
          disabled={busy}
          className="h-12 flex-[2] rounded-xl bg-[#EF790F] text-base font-extrabold text-white shadow-sm transition active:scale-[0.99] disabled:opacity-50"
        >
          {busy ? "جارٍ الحفظ…" : editing ? "حفظ التعديل" : "حفظ الطلب"}
        </button>
      </div>
    </form>
  )
}
