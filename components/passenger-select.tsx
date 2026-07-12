"use client"

import { useState, useRef, useEffect } from "react"
import { Users, Minus, Plus, ChevronDown } from "lucide-react"

interface PassengerSelectProps {
  adults: string
  onAdultsChange: (n: string) => void
  childrenCount: string // "children" اسم محجوز في React
  onChildrenChange: (n: string) => void
  infants: string
  onInfantsChange: (n: string) => void
  cabin: string
  onCabinChange: (c: string) => void
  label: string
}

const CABINS = [
  { v: "economy", l: "الاقتصادية" },
  { v: "business", l: "رجال الأعمال" },
]

// نفس فئات نظام الحجز (TTI): بالغ 12+، طفل 2–11، رضيع أقل من سنتين في حضن بالغ.
// الحدود: مقاعد (بالغون + أطفال) ≤ 9، والرضّع ≤ عدد البالغين.
const MAX_SEATS = 9

function Counter({
  title,
  hint,
  value,
  min,
  max,
  onChange,
}: {
  title: string
  hint: string
  value: number
  min: number
  max: number
  onChange: (n: number) => void
}) {
  return (
    <div className="flex items-center justify-between py-1">
      <div>
        <p className="font-semibold text-slate-800 text-sm">{title}</p>
        <p className="text-xs text-slate-400">{hint}</p>
      </div>
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => onChange(value - 1)}
          disabled={value <= min}
          className="w-8 h-8 rounded-full border border-slate-200 flex items-center justify-center text-[#1e3a5f] hover:border-[#ff8c42] disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Minus className="w-4 h-4" />
        </button>
        <span className="w-6 text-center font-bold text-slate-800">{value}</span>
        <button
          type="button"
          onClick={() => onChange(value + 1)}
          disabled={value >= max}
          className="w-8 h-8 rounded-full border border-slate-200 flex items-center justify-center text-[#1e3a5f] hover:border-[#ff8c42] disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}

export function PassengerSelect({
  adults,
  onAdultsChange,
  childrenCount,
  onChildrenChange,
  infants,
  onInfantsChange,
  cabin,
  onCabinChange,
  label,
}: PassengerSelectProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", h)
    return () => document.removeEventListener("mousedown", h)
  }, [])

  const nAdults = Math.max(1, Math.min(MAX_SEATS, Number(adults) || 1))
  const nChildren = Math.max(0, Math.min(MAX_SEATS - nAdults, Number(childrenCount) || 0))
  const nInfants = Math.max(0, Math.min(nAdults, Number(infants) || 0))
  const total = nAdults + nChildren + nInfants
  const cabinLabel = CABINS.find((c) => c.v === cabin)?.l || "الاقتصادية"

  const setAdults = (n: number) => {
    const a = Math.max(1, Math.min(MAX_SEATS, n))
    onAdultsChange(String(a))
    // أعِد ضبط ما يتجاوز الحدود بعد تغيير البالغين
    if (nChildren > MAX_SEATS - a) onChildrenChange(String(MAX_SEATS - a))
    if (nInfants > a) onInfantsChange(String(a))
  }

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
            {total} مسافر · {cabinLabel}
          </span>
          <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />
        </div>

        {open && (
          <div className="absolute z-50 w-full mt-1 bg-white border border-slate-200 rounded-2xl shadow-xl p-4 min-w-[260px]">
            <Counter
              title="البالغون"
              hint="12 سنة فأكثر"
              value={nAdults}
              min={1}
              max={MAX_SEATS - nChildren}
              onChange={setAdults}
            />
            <Counter
              title="الأطفال"
              hint="من 2 إلى 11 سنة"
              value={nChildren}
              min={0}
              max={MAX_SEATS - nAdults}
              onChange={(n) => onChildrenChange(String(n))}
            />
            <Counter
              title="الرضّع"
              hint="أقل من سنتين (في حضن بالغ)"
              value={nInfants}
              min={0}
              max={nAdults}
              onChange={(n) => onInfantsChange(String(n))}
            />

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
