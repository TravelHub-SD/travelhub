"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import type { Agent, Transaction } from "@/lib/dashboard-store"
import { longDate, money, SOURCE_LABEL } from "@/lib/dashboard-format"
import { TransactionForm } from "@/components/dashboard/transaction-form"

export function TransactionsList({ rows, agents }: { rows: Transaction[]; agents: Agent[] }) {
  const router = useRouter()
  const [editing, setEditing] = useState<Transaction | null>(null)
  const [deleting, setDeleting] = useState<number | null>(null)
  const [error, setError] = useState("")

  async function remove(t: Transaction) {
    if (!confirm(`حذف عملية ${t.service_type} بتاريخ ${longDate(t.date)}؟\nلا يمكن التراجع.`)) return
    setDeleting(t.id)
    setError("")
    try {
      const res = await fetch(`/api/dashboard/transactions/${t.id}`, { method: "DELETE" })
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
        <h2 className="mb-3 text-sm font-extrabold text-[#164563]">تعديل عملية {longDate(editing.date)}</h2>
        <TransactionForm
          agents={agents}
          existing={editing}
          onSaved={() => setEditing(null)}
          onCancel={() => setEditing(null)}
        />
      </div>
    )
  }

  if (!rows.length) {
    return <p className="rounded-2xl bg-white p-6 text-center text-sm text-slate-400 shadow-sm">لا عمليات مطابقة</p>
  }

  return (
    <div className="space-y-2">
      {error && (
        <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
          {error}
        </p>
      )}

      {rows.map((t) => (
        <article key={t.id} className="rounded-2xl bg-white p-3 shadow-sm">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="truncate text-sm font-extrabold text-[#164563]">{t.service_type}</p>
              <p className="mt-0.5 text-xs text-slate-500">
                {longDate(t.date)} · {SOURCE_LABEL[t.source]}
                {t.agents?.name ? ` · ${t.agents.name}` : ""}
                {t.source === "مباشر" ? ` · ${t.direct_source || "غير محدد"}` : ""}
                {t.quantity > 1 ? ` · ${t.quantity} وحدات` : ""}
              </p>
              {t.note && <p className="mt-1 text-xs text-slate-400">{t.note}</p>}
            </div>
            <div className="shrink-0 text-left">
              <p className="text-base font-extrabold tabular-nums text-[#164563]">{money(t.net_profit)}</p>
              {t.agent_profit > 0 && (
                <p className="text-[11px] tabular-nums text-slate-400">للوكيل {money(t.agent_profit)}</p>
              )}
            </div>
          </div>

          <div className="mt-2 flex gap-2 border-t border-slate-50 pt-2">
            <button
              onClick={() => setEditing(t)}
              className="h-9 flex-1 rounded-lg bg-slate-100 text-xs font-bold text-slate-700 active:bg-slate-200"
            >
              تعديل
            </button>
            <button
              onClick={() => remove(t)}
              disabled={deleting === t.id}
              className="h-9 flex-1 rounded-lg bg-red-50 text-xs font-bold text-red-700 active:bg-red-100 disabled:opacity-50"
            >
              {deleting === t.id ? "…" : "حذف"}
            </button>
          </div>
        </article>
      ))}
    </div>
  )
}
