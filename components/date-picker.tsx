"use client"

import { useState, useRef, useEffect } from "react"
import { Calendar as CalIcon, ChevronRight, ChevronLeft } from "lucide-react"
import {
  format,
  addMonths,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  isBefore,
  startOfToday,
  parseISO,
} from "date-fns"
import { ar } from "date-fns/locale"

interface DatePickerProps {
  value: string // YYYY-MM-DD
  onChange: (v: string) => void
  label: string
  placeholder?: string
  disabled?: boolean
  minDate?: string // YYYY-MM-DD
  // مسار الرحلة — عند توفّره تُجلب أيام الإتاحة وتُلوَّن بالأخضر
  routeFrom?: string
  routeTo?: string
}

const WEEKDAYS = ["سبت", "أحد", "إثن", "ثلا", "أرب", "خمي", "جمع"] // weekStartsOn = 6 (Saturday)

// كاش إتاحة مشترك بين كل التقاويم: "KRT-PZU-2026-08" → { "2026-08-03": 9, ... }
const availCache = new Map<string, Record<string, number>>()

export function DatePicker({ value, onChange, label, placeholder = "اختر التاريخ", disabled, minDate, routeFrom, routeTo }: DatePickerProps) {
  const [open, setOpen] = useState(false)
  const [view, setView] = useState<Date>(value ? parseISO(value) : startOfToday())
  const [avail, setAvail] = useState<Record<string, number> | null>(null)
  const [availLoading, setAvailLoading] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  // جلب أيام الإتاحة للشهر المعروض (من النظام عبر الموصّل)
  useEffect(() => {
    if (!open || !routeFrom || !routeTo || !/^[A-Z]{3}$/.test(routeFrom) || !/^[A-Z]{3}$/.test(routeTo)) {
      setAvail(null)
      return
    }
    const monthKey = format(view, "yyyy-MM")
    const cacheKey = `${routeFrom}-${routeTo}-${monthKey}`
    const cached = availCache.get(cacheKey)
    if (cached) {
      setAvail(cached)
      return
    }
    let alive = true
    setAvailLoading(true)
    const start = format(startOfMonth(view), "yyyy-MM-dd")
    const end = format(endOfMonth(view), "yyyy-MM-dd")
    fetch(`/api/availability?origin=${routeFrom}&destination=${routeTo}&start=${start}&end=${end}`)
      .then((r) => r.json())
      .then((d) => {
        const days = d?.days || {}
        // لا نخبّئ النتيجة الفارغة — قد تكون فشلاً مؤقتاً (جلسة باردة/مهلة)
        // فنعيد المحاولة عند فتح التقويم مرة أخرى بدل بقائه بلا أخضر
        if (Object.keys(days).length > 0) availCache.set(cacheKey, days)
        if (alive) setAvail(days)
      })
      .catch(() => alive && setAvail(null))
      .finally(() => alive && setAvailLoading(false))
    return () => {
      alive = false
    }
  }, [open, view, routeFrom, routeTo])

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", h)
    return () => document.removeEventListener("mousedown", h)
  }, [])

  const min = minDate ? parseISO(minDate) : startOfToday()
  const selected = value ? parseISO(value) : null
  const days = eachDayOfInterval({
    start: startOfWeek(startOfMonth(view), { weekStartsOn: 6 }),
    end: endOfWeek(endOfMonth(view), { weekStartsOn: 6 }),
  })

  return (
    <div className="space-y-2" ref={ref}>
      <label className="text-sm font-medium text-slate-700 flex items-center gap-2">
        <CalIcon className="w-4 h-4 text-[#ff8c42]" />
        {label}
      </label>
      <div className="relative">
        <div
          onClick={() => !disabled && setOpen((o) => !o)}
          className={`w-full h-12 rounded-xl border border-slate-200 px-3 flex items-center justify-between gap-2 transition ${
            disabled ? "opacity-50 cursor-not-allowed bg-slate-50" : "cursor-pointer hover:border-[#ff8c42]"
          }`}
        >
          <span className={selected ? "font-semibold text-slate-800 truncate" : "text-slate-400 truncate"}>
            {selected ? format(selected, "EEEE، d MMMM yyyy", { locale: ar }) : placeholder}
          </span>
          <CalIcon className="w-4 h-4 text-slate-400 shrink-0" />
        </div>

        {open && !disabled && (
          <div className="absolute z-50 mt-1 w-[300px] bg-white border border-slate-200 rounded-2xl shadow-xl p-3">
            <div className="flex items-center justify-between mb-3">
              <button
                type="button"
                onClick={() => setView(addMonths(view, 1))}
                className="w-8 h-8 rounded-lg hover:bg-slate-100 flex items-center justify-center"
                aria-label="التالي"
              >
                <ChevronLeft className="w-4 h-4 text-slate-600" />
              </button>
              <span className="font-bold text-[#1e3a5f]">{format(view, "MMMM yyyy", { locale: ar })}</span>
              <button
                type="button"
                onClick={() => setView(addMonths(view, -1))}
                className="w-8 h-8 rounded-lg hover:bg-slate-100 flex items-center justify-center"
                aria-label="السابق"
              >
                <ChevronRight className="w-4 h-4 text-slate-600" />
              </button>
            </div>
            <div className="grid grid-cols-7 gap-1 mb-1">
              {WEEKDAYS.map((d) => (
                <div key={d} className="text-[11px] text-slate-400 text-center py-1 font-medium">
                  {d}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-1">
              {days.map((day) => {
                const isDisabled = isBefore(day, min)
                const isSel = selected && isSameDay(day, selected)
                const outside = !isSameMonth(day, view)
                const seats = avail?.[format(day, "yyyy-MM-dd")]
                const hasFlights = !isDisabled && !outside && seats != null && seats > 0
                return (
                  <button
                    key={day.toISOString()}
                    type="button"
                    disabled={isDisabled}
                    title={hasFlights ? `${seats} مقعد متاح` : undefined}
                    onClick={() => {
                      onChange(format(day, "yyyy-MM-dd"))
                      setOpen(false)
                    }}
                    className={`h-9 rounded-lg text-sm transition ${
                      isSel
                        ? "bg-[#ff8c42] text-white font-bold"
                        : isDisabled
                          ? "text-slate-300 cursor-not-allowed"
                          : outside
                            ? "text-slate-300 hover:bg-slate-50"
                            : hasFlights
                              ? "bg-emerald-500/15 text-emerald-700 font-bold hover:bg-emerald-500/25"
                              : "text-slate-700 hover:bg-[#ff8c42]/10"
                    }`}
                  >
                    {format(day, "d")}
                  </button>
                )
              })}
            </div>
            {routeFrom && routeTo && (
              <div className="flex items-center justify-between mt-3 pt-2 border-t border-slate-100 text-[11px] text-slate-500">
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded bg-emerald-500/20 border border-emerald-500/50 inline-block" />
                  أيام بها رحلات متاحة
                </span>
                {availLoading && <span className="text-slate-400">جاري التحديث...</span>}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
