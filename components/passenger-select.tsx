"use client"

import { useState, useRef, useEffect } from "react"
import { Users, Minus, Plus, ChevronDown } from "lucide-react"

interface PassengerSelectProps {
  adults: string
  onAdultsChange: (n: string) => void
  cabin: string
  onCabinChange: (c: string) => void
  label: string
}

const CABINS = [
  { v: "economy", l: "الاقتصادية" },
  { v: "business", l: "رجال الأعمال" },
]

export function PassengerSelect({ adults, onAdultsChange, cabin, onCabinChange, label }: PassengerSelectProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", h)
    return () => document.removeEventListener("mousedown", h)
  }, [])

  const n = Math.max(1, Math.min(9, Number(adults) || 1))
  const cabinLabel = CABINS.find((c) => c.v === cabin)?.l || "الاقتصادية"

  const step = (dir: number) => onAdultsChange(String(Math.max(1, Math.min(9, n + dir))))

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
            {n} مسافر · {cabinLabel}
          </span>
          <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />
        </div>

        {open && (
          <div className="absolute z-50 w-full mt-1 bg-white border border-slate-200 rounded-2xl shadow-xl p-4 min-w-[260px]">
            <div className="flex items-center justify-between py-1">
              <div>
                <p className="font-semibold text-slate-800 text-sm">البالغون</p>
                <p className="text-xs text-slate-400">12 سنة فأكثر</p>
              </div>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => step(-1)}
                  disabled={n <= 1}
                  className="w-8 h-8 rounded-full border border-slate-200 flex items-center justify-center text-[#1e3a5f] hover:border-[#ff8c42] disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <Minus className="w-4 h-4" />
                </button>
                <span className="w-6 text-center font-bold text-slate-800">{n}</span>
                <button
                  type="button"
                  onClick={() => step(1)}
                  disabled={n >= 9}
                  className="w-8 h-8 rounded-full border border-slate-200 flex items-center justify-center text-[#1e3a5f] hover:border-[#ff8c42] disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="border-t border-slate-100 mt-3 pt-3">
              <p className="font-semibold text-slate-800 text-sm mb-2">درجة السفر</p>
              <div className="grid grid-cols-2 gap-2">
                {CABINS.map((c) => (
                  <button
                    key={c.v}
                    type="button"
                    onClick={() => onCabinChange(c.v)}
                    className={`py-2 rounded-lg text-sm font-medium border transition ${
                      cabin === c.v
                        ? "border-[#ff8c42] bg-[#ff8c42]/10 text-[#ff7a2e]"
                        : "border-slate-200 text-slate-500 hover:border-slate-300"
                    }`}
                  >
                    {c.l}
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
