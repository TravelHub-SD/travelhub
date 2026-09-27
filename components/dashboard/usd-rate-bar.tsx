"use client"

import { useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { money, monthLabel } from "@/lib/dashboard-format"

/**
 * سعر الدولار للشهر المعروض + مبدّل العملة.
 *
 * السعر يُحفظ للشهر لا كإعداد عام — انظر تعليق جدول usd_rates. والمبدّل
 * يمرّ في الرابط لا في حالة المكوّن: الصفحة تُرسم على الخادم، فالعملة
 * جزء من العنوان يبقى بعد التحديث ويمكن مشاركته.
 */
export function UsdRateBar({
  month,
  rate,
  from,
  exact,
  currency,
}: {
  month: string
  rate: number | null
  from: string | null
  exact: boolean
  currency: "sdg" | "usd"
}) {
  const router = useRouter()
  const params = useSearchParams()
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(rate ? String(rate) : "")
  const [error, setError] = useState("")
  const [busy, setBusy] = useState(false)

  function switchTo(c: "sdg" | "usd") {
    const next = new URLSearchParams(params.toString())
    if (c === "usd") next.set("currency", "usd")
    else next.delete("currency")
    router.push(`/dashboard?${next.toString()}`)
  }

  async function save(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError("")
    try {
      const res = await fetch("/api/dashboard/usd-rate", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ month, rate: draft }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(json?.error || "تعذّر الحفظ")
        return
      }
      setEditing(false)
      router.refresh()
    } catch {
      setError("تعذّر الاتصال — تحقّق من الشبكة")
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="rounded-2xl bg-white p-3 shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[11px] font-bold text-slate-500">سعر الدولار</p>
          {rate ? (
            <p className="text-sm font-extrabold tabular-nums text-[#164563]">
              {money(rate)} <span className="font-normal text-slate-400">جنيه</span>
            </p>
          ) : (
            <p className="text-sm font-bold text-amber-700">لم يُحدَّد بعد</p>
          )}
          {rate && !exact && from && (
            // نقولها صراحةً: الرقم بالدولار محسوب بسعر شهرٍ آخر، وإلا بدا
            // كأنه سعر هذا الشهر.
            <p className="text-[11px] text-amber-700">بسعر {monthLabel(from)} — حدّده لهذا الشهر</p>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <button
            onClick={() => {
              setDraft(rate ? String(rate) : "")
              setEditing((v) => !v)
            }}
            className="h-9 rounded-lg bg-slate-100 px-3 text-xs font-bold text-slate-700 active:bg-slate-200"
          >
            {editing ? "إلغاء" : rate ? "تعديل" : "تحديد"}
          </button>

          <div className="flex rounded-lg bg-slate-100 p-0.5">
            {(["sdg", "usd"] as const).map((c) => (
              <button
                key={c}
                onClick={() => switchTo(c)}
                disabled={c === "usd" && !rate}
                className={`h-8 rounded-md px-3 text-xs font-bold transition disabled:opacity-40 ${
                  currency === c ? "bg-[#164563] text-white" : "text-slate-600"
                }`}
              >
                {c === "sdg" ? "جنيه" : "دولار"}
              </button>
            ))}
          </div>
        </div>
      </div>

      {editing && (
        <form onSubmit={save} className="mt-3 flex gap-2">
          <input
            autoFocus
            inputMode="numeric"
            type="number"
            min={1}
            step={1}
            placeholder="مثال: 3650"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            className="h-11 flex-1 rounded-xl border border-slate-300 px-3 text-base tabular-nums outline-none focus:border-[#EF790F] focus:ring-2 focus:ring-[#EF790F]/30"
          />
          <button
            type="submit"
            disabled={busy || !draft}
            className="h-11 rounded-xl bg-[#EF790F] px-5 text-sm font-extrabold text-white disabled:opacity-50"
          >
            حفظ
          </button>
        </form>
      )}

      {editing && (
        <p className="mt-1.5 text-[11px] text-slate-400">
          السعر يخصّ {monthLabel(month)} وحده — كل شهر بسعره حتى تبقى أرقام الأشهر السابقة صحيحة.
        </p>
      )}

      {error && (
        <p role="alert" className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-xs font-medium text-red-700">
          {error}
        </p>
      )}
    </div>
  )
}
