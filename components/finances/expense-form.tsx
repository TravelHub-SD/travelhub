"use client"

import { useEffect, useId, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import type { Expense, ExpenseCategory } from "@/lib/finance-store"
import { sdg } from "@/lib/finance-format"
import { todayISO } from "@/lib/dashboard-format"
import { DateField } from "@/components/dashboard/date-field"

// ٥٦ بكسل لكل حقل، كفورم العمليات: أصغر من ذلك يصعب إصابته بالإبهام.
const FIELD =
  "h-14 w-full rounded-xl border border-slate-300 bg-white px-4 text-base outline-none focus:border-[#EF790F] focus:ring-2 focus:ring-[#EF790F]/30"
const LABEL = "mb-1.5 block text-sm font-semibold text-[#164563]"

type Values = { date: string; category_id: string; amount: string; note: string }

/** انتهت الجلسة ولم يُجدّدها الحارس — نعيده للدخول ثم إلى هنا. */
function toLogin() {
  window.location.href = `/admin/finances/login?next=${encodeURIComponent(window.location.pathname + window.location.search)}`
}

export function ExpenseForm({
  categories,
  existing,
  onSaved,
  onCancel,
}: {
  categories: ExpenseCategory[]
  existing?: Expense
  onSaved?: () => void
  onCancel?: () => void
}) {
  const router = useRouter()
  const editing = Boolean(existing)
  const [v, setV] = useState<Values>(() =>
    existing
      ? { date: existing.date, category_id: existing.category_id, amount: String(existing.amount), note: existing.note ?? "" }
      : { date: todayISO(), category_id: "", amount: "", note: "" },
  )
  const [error, setError] = useState("")
  const [busy, setBusy] = useState(false)
  // ما سُجّل في هذه الجلسة — تأكيدٌ مرئي أن كل بند دخل، ومجموعٌ جارٍ
  // لجلسة «نهاية اليوم» دون النزول إلى السجل.
  const [added, setAdded] = useState<{ id: string; label: string; amount: number }[]>([])
  const amountRef = useRef<HTMLInputElement>(null)
  // فورم الإضافة وفورم التعديل قد يجتمعان في الصفحة: معرّفات ثابتة كانت
  // ستتكرّر فتربط عنوان الحقل بالحقل الخطأ عند قارئ الشاشة.
  const uid = useId()
  const id = (name: string) => `${uid}-${name}`

  const set = (k: keyof Values) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setV((s) => ({ ...s, [k]: e.target.value }))

  // المبلغ مكتوباً بفواصل تحت الحقل: صفرٌ زائد في ١٥٠٠٠٠ يُرى قبل الحفظ.
  const preview = (() => {
    const n = Number(v.amount.replace(/[,\s]/g, ""))
    return v.amount && Number.isFinite(n) && n > 0 ? sdg(n) : null
  })()

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError("")
    try {
      const res = await fetch(editing ? `/api/admin/finances/expenses/${existing!.id}` : "/api/admin/finances/expenses", {
        method: editing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...v, note: v.note.trim() || null }),
      })
      if (res.status === 401) return toLogin()
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(json?.error || "تعذّر الحفظ")
        return
      }

      if (editing) {
        onSaved?.()
        router.refresh()
        return
      }

      // يبقى التاريخ، ويُفرَّغ الباقي — التصنيف أيضاً: بنود نهاية اليوم
      // تختلف تصنيفاتها غالباً، وتصنيفٌ عالق من البند السابق يُدخل
      // «مواصلات» تحت «طعام» بصمت. الحقل المطلوب يُجبر على الاختيار.
      const name = categories.find((c) => c.id === v.category_id)?.name ?? ""
      setAdded((a) => [{ id: json.row.id, label: name, amount: Number(json.row.amount) }, ...a])
      setV((s) => ({ date: s.date, category_id: "", amount: "", note: "" }))
      amountRef.current?.focus()
      router.refresh()
    } catch {
      setError("تعذّر الاتصال — تحقّق من الشبكة")
    } finally {
      setBusy(false)
    }
  }

  useEffect(() => {
    if (!error) return
    const t = setTimeout(() => setError(""), 6000)
    return () => clearTimeout(t)
  }, [error])

  const addedTotal = added.reduce((s, a) => s + Math.round(a.amount * 100), 0) / 100

  return (
    <form onSubmit={submit} className="space-y-3">
      <div>
        <label htmlFor={id("amount")} className={LABEL}>
          المبلغ <span className="font-normal text-slate-400">(جنيه)</span>
        </label>
        <input
          id={id("amount")} name="amount"
          ref={amountRef}
          type="text"
          inputMode="decimal"
          dir="ltr"
          required
          autoComplete="off"
          placeholder="0"
          value={v.amount}
          onChange={set("amount")}
          className={`${FIELD} text-left text-xl font-bold`}
        />
        <p className="mt-1 h-4 text-xs text-slate-500">{preview && <>{preview} جنيه</>}</p>
      </div>

      <div>
        <label htmlFor={id("category")} className={LABEL}>
          التصنيف
        </label>
        <select id={id("category")} name="category" required value={v.category_id} onChange={set("category_id")} className={FIELD}>
          <option value="" disabled>
            اختر…
          </option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor={id("note")} className={LABEL}>
          ملاحظة <span className="font-normal text-slate-400">(اختياري)</span>
        </label>
        <input id={id("note")} name="note" type="text" maxLength={500} autoComplete="off" value={v.note} onChange={set("note")} className={FIELD} />
      </div>

      <DateField id={id("date")} label="التاريخ" value={v.date} onChange={(d) => setV((s) => ({ ...s, date: d }))} />

      {error && (
        <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
          {error}
        </p>
      )}

      <div className="flex gap-2 pt-1">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="h-14 flex-1 rounded-xl border border-slate-300 bg-white font-bold text-slate-600"
          >
            إلغاء
          </button>
        )}
        <button
          type="submit"
          disabled={busy}
          className="h-14 flex-[2] rounded-xl bg-[#EF790F] text-lg font-extrabold text-white shadow-sm transition active:scale-[0.99] disabled:opacity-50"
        >
          {busy ? "جارٍ الحفظ…" : editing ? "حفظ التعديل" : "تسجيل بند"}
        </button>
      </div>

      {added.length > 0 && (
        <div role="status" className="rounded-xl bg-emerald-50 p-3">
          <p className="text-sm font-bold text-emerald-800">
            ✓ سُجّل {added.length === 1 ? "بند" : `${added.length} بنود`} — المجموع {sdg(addedTotal)} جنيه
          </p>
          <ul className="mt-1.5 space-y-0.5">
            {added.map((a) => (
              <li key={a.id} className="flex justify-between text-xs text-emerald-900">
                <span>{a.label}</span>
                <span className="font-semibold">{sdg(a.amount)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </form>
  )
}
