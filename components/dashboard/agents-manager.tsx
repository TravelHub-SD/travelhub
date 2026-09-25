"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import type { Agent } from "@/lib/dashboard-store"

const CTL = "h-12 w-full rounded-xl border border-slate-300 bg-white px-3 text-base outline-none focus:border-[#EF790F] focus:ring-2 focus:ring-[#EF790F]/30"

export function AgentsManager({ agents }: { agents: Agent[] }) {
  const router = useRouter()
  const [name, setName] = useState("")
  const [phone, setPhone] = useState("")
  const [editing, setEditing] = useState<Agent | null>(null)
  const [error, setError] = useState("")
  const [busy, setBusy] = useState(false)

  async function send(url: string, method: string, body: unknown) {
    setBusy(true)
    setError("")
    try {
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(json?.error || "تعذّر الحفظ")
        return false
      }
      router.refresh()
      return true
    } catch {
      setError("تعذّر الاتصال — تحقّق من الشبكة")
      return false
    } finally {
      setBusy(false)
    }
  }

  async function add(e: React.FormEvent) {
    e.preventDefault()
    if (await send("/api/dashboard/agents", "POST", { name, phone })) {
      setName("")
      setPhone("")
    }
  }

  async function saveEdit(e: React.FormEvent) {
    e.preventDefault()
    if (!editing) return
    if (await send(`/api/dashboard/agents/${editing.id}`, "PATCH", { name: editing.name, phone: editing.phone })) {
      setEditing(null)
    }
  }

  const toggle = (a: Agent) => send(`/api/dashboard/agents/${a.id}`, "PATCH", { is_active: !a.is_active })

  return (
    <div className="space-y-3">
      {error && (
        <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
          {error}
        </p>
      )}

      <form onSubmit={add} className="rounded-2xl bg-white p-4 shadow-sm">
        <h2 className="mb-3 text-sm font-extrabold text-[#164563]">إضافة وكيل</h2>
        <div className="space-y-2">
          <input
            required
            placeholder="اسم الوكيل"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={CTL}
          />
          <input
            inputMode="tel"
            placeholder="الهاتف (اختياري)"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className={CTL}
          />
          <button
            type="submit"
            disabled={busy || !name.trim()}
            className="h-12 w-full rounded-xl bg-[#164563] font-bold text-white active:scale-[0.99] disabled:opacity-50"
          >
            إضافة
          </button>
        </div>
      </form>

      {agents.map((a) =>
        editing?.id === a.id ? (
          <form key={a.id} onSubmit={saveEdit} className="rounded-2xl bg-white p-4 shadow-sm ring-2 ring-[#EF790F]/40">
            <div className="space-y-2">
              <input
                required
                value={editing.name}
                onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                className={CTL}
              />
              <input
                inputMode="tel"
                placeholder="الهاتف"
                value={editing.phone ?? ""}
                onChange={(e) => setEditing({ ...editing, phone: e.target.value })}
                className={CTL}
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setEditing(null)}
                  className="h-11 flex-1 rounded-xl border border-slate-300 text-sm font-bold text-slate-600"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={busy}
                  className="h-11 flex-[2] rounded-xl bg-[#EF790F] text-sm font-extrabold text-white disabled:opacity-50"
                >
                  حفظ
                </button>
              </div>
            </div>
          </form>
        ) : (
          <article key={a.id} className="flex items-center justify-between gap-3 rounded-2xl bg-white p-3 shadow-sm">
            <div className="min-w-0">
              <p className={`truncate text-sm font-bold ${a.is_active ? "text-[#164563]" : "text-slate-400 line-through"}`}>
                {a.name}
              </p>
              {a.phone && <p className="text-xs tabular-nums text-slate-400">{a.phone}</p>}
            </div>
            <div className="flex shrink-0 gap-2">
              <button
                onClick={() => setEditing(a)}
                className="h-9 rounded-lg bg-slate-100 px-3 text-xs font-bold text-slate-700 active:bg-slate-200"
              >
                تعديل
              </button>
              <button
                onClick={() => toggle(a)}
                disabled={busy}
                className={`h-9 rounded-lg px-3 text-xs font-bold disabled:opacity-50 ${
                  a.is_active ? "bg-amber-50 text-amber-700" : "bg-emerald-50 text-emerald-700"
                }`}
              >
                {a.is_active ? "تعطيل" : "تفعيل"}
              </button>
            </div>
          </article>
        ),
      )}

      {!agents.length && (
        <p className="rounded-2xl bg-white p-6 text-center text-sm text-slate-400 shadow-sm">لا وكلاء بعد</p>
      )}
    </div>
  )
}
