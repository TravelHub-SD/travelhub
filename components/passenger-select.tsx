"use client"

import { useState, useRef, useEffect } from "react"
import { Users, Minus, Plus, ChevronDown } from "lucide-react"

interface PassengerSelectProps {
  adults: string
  children: string
  infants: string
  onChange: (next: { adults: string; children: string; infants: string }) => void
  cabin: string
  onCabinChange: (c: string) => void
  label: string
}

const CABINS = [
  { v: "economy", l: "الاقتصادية" },
  { v: "business", l: "رجال الأعمال" },
]

const MAX_TOTAL = 9 // بالغون + أطفال (قياسي في أنظمة الحجز)

export function PassengerSelect({ adults, children, infants, onChange, cabin, onCabinChange, label }: PassengerSelectProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", h)
    return () => document.removeEventListener("mousedown", h)
  }, [])

  const a = Math.max(1, Number(adults) || 1)
  const c = Math.max(0, Number(children) || 0)
  const inf = Math.max(0, Number(infants) || 0)
  const total = a + c + inf
  const cabinLabel = CABINS.find((x) => x.v === cabin)?.l || "الاقتصادية"

  const set = (next: { adults?: number; children?: number; infants?: number }) =>
    onChange({
      adults: String(next.adults ?? a),
      children: String(next.children ?? c),
      infants: String(next.infants ?? inf),
    })

  // القيود القياسية: (بالغون + أطفال) ≤ 9، الرضّع ≤ عدد البالغين
  const rows = [
    {
      key: "adults" as const,
      title: "البالغون",
      hint: "12 سنة فأكثر",
      value: a,
      dec: () => a > 1 && set({ adults: a - 1, infants: Math.min(inf, a - 1) }),
      inc: () => a + c < MAX_TOTAL && set({ adults: a + 1 }),
      canDec: a > 1,
      canInc: a + c < MAX_TOTAL,
    },
    {
      key: "children" as const,
      title: "الأطفال",
      hint: "من 2 إلى 11 سنة",
      value: c,
      dec: () => c > 0 && set({ children: c - 1 }),
      inc: () => a + c < MAX_TOTAL && set({ children: c + 1 }),
      canDec: c > 0,
      canInc: a + c < MAX_TOTAL,
    },
    {
      key: "infants" as const,
      title: "الرُّضّع",
      hint: "أقل من سنتين (على الحضن)",
      value: inf,
      dec: () => inf > 0 && set({ infants: inf - 1 }),
      inc: () => inf < a && set({ infants: inf + 1 }),
      canDec: inf > 0,
      canInc: inf < a,
    },
  ]

  return (
    <div className="space-y-2" ref={ref}>
      <label className="text-sm font-medium text-slate-700 flex items-center gap-2">
        <Users className="w-4 h-4 text-[#ff8c42]" />
        {label}
      </label>
      <div className="relative">
        <div
          onClick={() => setOpen((o) => !o)}
          className="w-full h-12 rounded-xl border border-slate-200 px-3 flex items-center justify-between gap-2 cursor-pointer hover:border-[#ff8c42] transition"
        >
          <span className="font-semibold text-slate-800 truncate">
            {total} {total === 1 ? "مسافر" : "مسافرين"} · {cabinLabel}
          </span>
          <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />
        </div>

        {open && (
          <div className="absolute z-50 w-full mt-1 bg-white border border-slate-200 rounded-2xl shadow-xl p-4 min-w-[280px]">
            <div className="space-y-3">
              {rows.map((row) => (
                <div key={row.key} className="flex items-center justify-between py-1">
                  <div>
                    <p className="font-semibold text-slate-800 text-sm">{row.title}</p>
                    <p className="text-xs text-slate-400">{row.hint}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={row.dec}
                      disabled={!row.canDec}
                      className="w-8 h-8 rounded-full border border-slate-200 flex items-center justify-center text-[#1e3a5f] hover:border-[#ff8c42] disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <Minus className="w-4 h-4" />
                    </button>
                    <span className="w-6 text-center font-bold text-slate-800">{row.value}</span>
                    <button
                      type="button"
                      onClick={row.inc}
                      disabled={!row.canInc}
                      className="w-8 h-8 rounded-full border border-slate-200 flex items-center justify-center text-[#1e3a5f] hover:border-[#ff8c42] disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="border-t border-slate-100 mt-3 pt-3">
              <p className="font-semibold text-slate-800 text-sm mb-2">درجة السفر</p>
              <div className="grid grid-cols-2 gap-2">
                {CABINS.map((x) => (
                  <button
                    key={x.v}
                    type="button"
                    onClick={() => onCabinChange(x.v)}
                    className={`py-2 rounded-lg text-sm font-medium border transition ${
                      cabin === x.v
                        ? "border-[#ff8c42] bg-[#ff8c42]/10 text-[#ff7a2e]"
                        : "border-slate-200 text-slate-500 hover:border-slate-300"
                    }`}
                  >
                    {x.l}
                  </button>
                ))}
              </div>
            </div>

            <button
              type="button"
              onClick={() => setOpen(false)}
              className="w-full mt-4 h-10 rounded-xl bg-[#1e3a5f] text-white text-sm font-bold hover:bg-[#12294a] transition"
            >
              تم
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
