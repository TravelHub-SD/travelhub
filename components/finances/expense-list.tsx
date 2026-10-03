"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import type { Expense, ExpenseCategory } from "@/lib/finance-store"
import { fromCents, sdg, toCents } from "@/lib/finance-format"
import { longDate } from "@/lib/dashboard-format"
import { ExpenseForm } from "@/components/finances/expense-form"

/** البنود مجمّعة باليوم، ولكل يوم مجموعه — هكذا يُراجَع الصرف عادةً. */
function byDay(rows: Expense[]) {
  const days = new Map<string, Expense[]>()
  for (const r of rows) days.set(r.date, [...(days.get(r.date) || []), r])
  return [...days.entries()].map(([date, items]) => ({
    date,
    items,
    total: fromCents(items.reduce((s, i) => s + toCents(i.amount), 0)),
  }))
}

export function ExpenseList({ rows, categories }: { rows: Expense[]; categories: ExpenseCategory[] }) {
  const router = useRouter()
  const [editing, setEditing] = useState<Expense | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [error, setError] = useState("")

  async function remove(e: Expense) {
    const label = `${e.expense_categories?.name ?? "بند"} بمبلغ ${sdg(e.amount)} جنيه — ${longDate(e.date)}`
    if (!confirm(`حذف ${label}؟`)) return
    setDeleting(e.id)
    setError("")
    try {
      const res = await fetch(`/api/admin/finances/expenses/${e.id}`, { method: "DELETE" })
      if (res.status === 401) {
        window.location.href = "/admin/finances/login"
        return
      }
      const json = await res.json().catch(() => ({}))
      if (!res.ok) setError(json?.error || "تعذّر الحذف")
      else router.refresh()
    } catch {
      setError("تعذّر الاتصال — تحقّق من الشبكة")
    } finally {
      setDeleting(null)
    }
  }

  if (editing) {
    return (
      <div className="rounded-2xl bg-white p-4 shadow-sm">
        <h3 className="mb-3 text-sm font-extrabold text-[#164563]">تعديل بند — {longDate(editing.date)}</h3>
        <ExpenseForm
          categories={categories}
          existing={editing}
          onSaved={() => setEditing(null)}
          onCancel={() => setEditing(null)}
        />
      </div>
    )
  }

  if (!rows.length) {
    return <p className="rounded-2xl bg-white p-6 text-center text-sm text-slate-400 shadow-sm">لا منصرفات مسجّلة في هذا الشهر</p>
  }

  return (
    <div className="space-y-3">
      {error && (
        <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
          {error}
        </p>
      )}
      {byDay(rows).map((day) => (
        <section key={day.date} className="rounded-2xl bg-white shadow-sm">
          <header className="flex items-center justify-between border-b border-slate-100 px-4 py-2.5">
            <h3 className="text-sm font-bold text-[#164563]">{longDate(day.date)}</h3>
            <span className="text-sm font-bold text-slate-600">{sdg(day.total)}</span>
          </header>
          <ul>
            {day.items.map((e) => (
              <li key={e.id} data-expense={e.id} className="border-b border-slate-50 px-4 py-3 last:border-0">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-800">{e.expense_categories?.name ?? "بلا تصنيف"}</p>
                    {e.note && <p className="mt-0.5 break-words text-xs text-slate-500">{e.note}</p>}
                  </div>
                  <p className="shrink-0 text-base font-extrabold tabular-nums text-[#164563]">{sdg(e.amount)}</p>
                </div>
                <div className="mt-2 flex gap-2">
                  <button
                    onClick={() => setEditing(e)}
                    className="h-9 flex-1 rounded-lg bg-slate-100 text-xs font-bold text-slate-700 active:bg-slate-200"
                  >
                    تعديل
                  </button>
                  <button
                    onClick={() => remove(e)}
                    disabled={deleting === e.id}
                    className="h-9 flex-1 rounded-lg bg-red-50 text-xs font-bold text-red-700 active:bg-red-100 disabled:opacity-50"
                  >
                    {deleting === e.id ? "جارٍ الحذف…" : "حذف"}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  )
}
