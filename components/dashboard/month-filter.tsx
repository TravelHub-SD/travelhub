"use client"

import { useRouter, useSearchParams } from "next/navigation"
import { monthLabel, recentMonths } from "@/lib/dashboard-format"

export function MonthFilter({ value }: { value: string }) {
  const router = useRouter()
  const params = useSearchParams()
  const months = recentMonths()

  // الشهر المختار قد يكون أقدم من قائمة الاثني عشر (رابط محفوظ مثلاً)،
  // فنضمّه حتى لا يبدو المحدّد فارغاً.
  const options = months.includes(value) ? months : [value, ...months]

  return (
    <select
      aria-label="الشهر"
      value={value}
      onChange={(e) => {
        const next = new URLSearchParams(params.toString())
        next.set("month", e.target.value)
        router.push(`/dashboard?${next.toString()}`)
      }}
      className="h-11 rounded-xl border border-slate-300 bg-white px-3 text-sm font-semibold text-[#164563] outline-none focus:border-[#EF790F]"
    >
      {options.map((m) => (
        <option key={m} value={m}>
          {monthLabel(m)}
        </option>
      ))}
    </select>
  )
}
