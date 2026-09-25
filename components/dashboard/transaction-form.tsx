"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { SERVICE_TYPES, SOURCES, type Agent, type Transaction } from "@/lib/dashboard-store"
import { todayISO } from "@/lib/dashboard-format"

// ارتفاع ٥٦ بكسل لكل حقل: أصغر من ذلك يصعب إصابته بالإبهام على الهاتف.
const FIELD = "h-14 w-full rounded-xl border border-slate-300 bg-white px-4 text-base outline-none focus:border-[#EF790F] focus:ring-2 focus:ring-[#EF790F]/30"
const LABEL = "mb-1.5 block text-sm font-semibold text-[#164563]"

type Values = {
  date: string
  service_type: string
  source: string
  agent_id: string
  quantity: string
  agent_profit: string
  net_profit: string
  note: string
}

function emptyValues(): Values {
  return {
    date: todayISO(),
    service_type: "",
    source: "",
    agent_id: "",
    quantity: "1",
    agent_profit: "",
    net_profit: "",
    note: "",
  }
}

function fromTransaction(t: Transaction): Values {
  return {
    date: t.date,
    service_type: t.service_type,
    source: t.source,
    agent_id: t.agent_id ? String(t.agent_id) : "",
    quantity: String(t.quantity),
    agent_profit: String(t.agent_profit),
    net_profit: String(t.net_profit),
    note: t.note ?? "",
  }
}

export function TransactionForm({
  agents,
  existing,
  onSaved,
  onCancel,
}: {
  agents: Agent[]
  existing?: Transaction
  onSaved?: () => void
  onCancel?: () => void
}) {
  const router = useRouter()
  const editing = Boolean(existing)

  const [v, setV] = useState<Values>(() => (existing ? fromTransaction(existing) : emptyValues()))
  const [error, setError] = useState("")
  const [saved, setSaved] = useState(false)
  const [busy, setBusy] = useState(false)
  const firstFieldRef = useRef<HTMLSelectElement>(null)

  const withAgent = v.source === "وكيل"

  // في الإضافة نعرض الوكلاء النشطين فقط. في التعديل نُبقي وكيل العملية
  // ولو عُطِّل لاحقاً، وإلا بدا الحقل فارغاً وبدّل الوكيل عند أول حفظ.
  const options = useMemo(() => {
    const active = agents.filter((a) => a.is_active)
    if (!editing || !existing?.agent_id) return active
    return active.some((a) => a.id === existing.agent_id)
      ? active
      : [...active, ...agents.filter((a) => a.id === existing.agent_id)]
  }, [agents, editing, existing])

  // تبديل المصدر إلى «مباشر» يمسح الوكيل وربحه — لا نرسل بقايا اختيار سابق.
  useEffect(() => {
    if (!withAgent && (v.agent_id || v.agent_profit)) {
      setV((s) => ({ ...s, agent_id: "", agent_profit: "" }))
    }
  }, [withAgent, v.agent_id, v.agent_profit])

  const set = (k: keyof Values) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setV((s) => ({ ...s, [k]: e.target.value }))

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError("")
    setSaved(false)

    const payload = {
      date: v.date,
      service_type: v.service_type,
      source: v.source,
      agent_id: withAgent && v.agent_id ? Number(v.agent_id) : null,
      quantity: Number(v.quantity || 1),
      agent_profit: withAgent ? Number(v.agent_profit || 0) : 0,
      net_profit: v.net_profit === "" ? null : Number(v.net_profit),
      note: v.note.trim() || null,
    }

    try {
      const res = await fetch(
        editing ? `/api/dashboard/transactions/${existing!.id}` : "/api/dashboard/transactions",
        {
          method: editing ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      )
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

      // نبقى في الصفحة ونُبقي التاريخ والخدمة والمصدر والوكيل: العمليات
      // المتتالية في اليوم الواحد متشابهة غالباً، فهذا يوفّر أغلب النقرات.
      setV((s) => ({ ...s, quantity: "1", agent_profit: "", net_profit: "", note: "" }))
      setSaved(true)
      firstFieldRef.current?.focus()
      router.refresh()
    } catch {
      setError("تعذّر الاتصال — تحقّق من الشبكة")
    } finally {
      setBusy(false)
    }
  }

  // إخفاء رسالة النجاح تلقائياً حتى لا تبقى معلّقة فوق العملية التالية
  useEffect(() => {
    if (!saved) return
    const t = setTimeout(() => setSaved(false), 2500)
    return () => clearTimeout(t)
  }, [saved])

  return (
    <form onSubmit={submit} className="space-y-4">
      <div>
        <label htmlFor="date" className={LABEL}>
          التاريخ
        </label>
        <input id="date" type="date" required value={v.date} onChange={set("date")} className={FIELD} />
      </div>

      <div>
        <label htmlFor="service" className={LABEL}>
          نوع الخدمة
        </label>
        <select id="service" ref={firstFieldRef} required value={v.service_type} onChange={set("service_type")} className={FIELD}>
          <option value="" disabled>
            اختر…
          </option>
          {SERVICE_TYPES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor="source" className={LABEL}>
          المصدر
        </label>
        <select id="source" required value={v.source} onChange={set("source")} className={FIELD}>
          <option value="" disabled>
            اختر…
          </option>
          {SOURCES.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
      </div>

      {withAgent && (
        <div>
          <label htmlFor="agent" className={LABEL}>
            الوكيل
          </label>
          <select id="agent" required value={v.agent_id} onChange={set("agent_id")} className={FIELD}>
            <option value="" disabled>
              اختر الوكيل…
            </option>
            {options.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
                {a.is_active ? "" : " (معطّل)"}
              </option>
            ))}
          </select>
          {!options.length && (
            <p className="mt-1.5 text-xs font-medium text-amber-700">
              لا يوجد وكلاء نشطون — أضف وكيلاً من صفحة الوكلاء أولاً.
            </p>
          )}
        </div>
      )}

      <div>
        <label htmlFor="qty" className={LABEL}>
          العدد
        </label>
        <input
          id="qty"
          type="number"
          inputMode="numeric"
          min={1}
          step={1}
          required
          value={v.quantity}
          onChange={set("quantity")}
          className={FIELD}
        />
      </div>

      {withAgent && (
        <div>
          <label htmlFor="agent_profit" className={LABEL}>
            ربح الوكيل <span className="font-normal text-slate-400">(جنيه)</span>
          </label>
          <input
            id="agent_profit"
            type="number"
            inputMode="numeric"
            min={0}
            step={1}
            placeholder="0"
            value={v.agent_profit}
            onChange={set("agent_profit")}
            className={FIELD}
          />
        </div>
      )}

      <div>
        <label htmlFor="net" className={LABEL}>
          صافي ربح الوكالة <span className="font-normal text-slate-400">(جنيه — مطلوب)</span>
        </label>
        <input
          id="net"
          type="number"
          inputMode="numeric"
          step={1}
          required
          value={v.net_profit}
          onChange={set("net_profit")}
          className={`${FIELD} font-bold`}
        />
      </div>

      <div>
        <label htmlFor="note" className={LABEL}>
          ملاحظة <span className="font-normal text-slate-400">(اختياري)</span>
        </label>
        <textarea id="note" rows={2} value={v.note} onChange={set("note")} className={`${FIELD} h-auto py-3`} />
      </div>

      {error && (
        <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
          {error}
        </p>
      )}
      {saved && (
        <p role="status" className="rounded-lg bg-emerald-50 px-3 py-2 text-sm font-bold text-emerald-700">
          ✓ تم الحفظ — جاهز للعملية التالية
        </p>
      )}

      <div className="flex gap-2">
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
          {busy ? "جارٍ الحفظ…" : editing ? "حفظ التعديل" : "حفظ"}
        </button>
      </div>
    </form>
  )
}
