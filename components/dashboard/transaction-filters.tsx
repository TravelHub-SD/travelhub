"use client"

import { useRouter, useSearchParams } from "next/navigation"
import { SERVICE_TYPES, SOURCES, type Agent } from "@/lib/dashboard-store"

const CTL = "h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm outline-none focus:border-[#EF790F]"
const LBL = "mb-1 block text-[11px] font-bold text-slate-500"

export function TransactionFilters({ agents }: { agents: Agent[] }) {
  const router = useRouter()
  const params = useSearchParams()
  const get = (k: string) => params.get(k) || ""

  function apply(key: string, value: string) {
    const next = new URLSearchParams(params.toString())
    if (value) next.set(key, value)
    else next.delete(key)
    router.push(`/dashboard/transactions?${next.toString()}`)
  }

  const active = ["from", "to", "service_type", "source", "agent_id"].some((k) => get(k))

  return (
    <div className="rounded-2xl bg-white p-3 shadow-sm">
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className={LBL} htmlFor="f-from">
            من تاريخ
          </label>
          <input id="f-from" type="date" value={get("from")} onChange={(e) => apply("from", e.target.value)} className={CTL} />
        </div>
        <div>
          <label className={LBL} htmlFor="f-to">
            إلى تاريخ
          </label>
          <input id="f-to" type="date" value={get("to")} onChange={(e) => apply("to", e.target.value)} className={CTL} />
        </div>
        <div>
          <label className={LBL} htmlFor="f-service">
            نوع الخدمة
          </label>
          <select id="f-service" value={get("service_type")} onChange={(e) => apply("service_type", e.target.value)} className={CTL}>
            <option value="">الكل</option>
            {SERVICE_TYPES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={LBL} htmlFor="f-source">
            المصدر
          </label>
          <select id="f-source" value={get("source")} onChange={(e) => apply("source", e.target.value)} className={CTL}>
            <option value="">الكل</option>
            {SOURCES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </div>
        <div className="col-span-2">
          <label className={LBL} htmlFor="f-agent">
            الوكيل
          </label>
          <select id="f-agent" value={get("agent_id")} onChange={(e) => apply("agent_id", e.target.value)} className={CTL}>
            <option value="">الكل</option>
            {agents.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
                {a.is_active ? "" : " (معطّل)"}
              </option>
            ))}
          </select>
        </div>
      </div>

      {active && (
        <button
          onClick={() => router.push("/dashboard/transactions")}
          className="mt-3 h-10 w-full rounded-xl border border-slate-300 text-sm font-semibold text-slate-600"
        >
          مسح الفلاتر
        </button>
      )}
    </div>
  )
}
