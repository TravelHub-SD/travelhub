"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { Calendar as CalIcon, ChevronLeft, ChevronRight } from "lucide-react"
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isAfter,
  isSameDay,
  isSameMonth,
  parseISO,
  startOfMonth,
  startOfToday,
  startOfWeek,
  subDays,
} from "date-fns"
import { ar } from "date-fns/locale"

const WEEKDAYS = ["سبت", "أحد", "إثن", "ثلا", "أرب", "خمي", "جمع"] // weekStartsOn = 6

const iso = (d: Date) => format(d, "yyyy-MM-dd")

/**
 * تقويم عربي للوحة العمليات.
 *
 * لا نستعمل input[type=date]: يعرض النمط اللاتيني (mm/dd/yyyy) داخل واجهة
 * عربية، ويختلف شكله بين المتصفحات.
 *
 * ومختلف عن تقويم الموقع: هناك تُختار رحلة قادمة فيُمنع الماضي وتُلوَّن أيام
 * الإتاحة؛ هنا تُسجَّل عملية وقعت فعلاً — فالماضي مفتوح، والمستقبل ممنوع
 * افتراضياً (تاريخٌ لم يأتِ بعد هو غلطة طباعة لا عملية)، ومعه اختصارات
 * لليوم والأمس لأنهما أغلب ما يُسجَّل.
 */
export function DateField({
  id,
  value,
  onChange,
  label,
  allowFuture = false,
  placeholder = "اختر التاريخ",
  compact = false,
  tone = "light",
}: {
  id: string
  value: string
  onChange: (v: string) => void
  label?: string
  allowFuture?: boolean
  placeholder?: string
  // في شريط الفلاتر تصطفّ الحقول مع قوائم بارتفاع ٤٤؛ في الفورم ٥٦.
  compact?: boolean
  // قسم الموافقات داكن؛ لوحة العمليات والمنصرفات فاتحة كما هي.
  tone?: "light" | "dark"
}) {
  const [open, setOpen] = useState(false)
  const selected = value ? parseISO(value) : null
  const [view, setView] = useState<Date>(selected ?? startOfToday())
  const box = useRef<HTMLDivElement>(null)

  const today = startOfToday()
  const dark = tone === "dark"

  const days = useMemo(
    () =>
      eachDayOfInterval({
        start: startOfWeek(startOfMonth(view), { weekStartsOn: 6 }),
        end: endOfWeek(endOfMonth(view), { weekStartsOn: 6 }),
      }),
    [view],
  )

  // الإغلاق بالنقر خارجه أو بـEsc — على الهاتف النقر خارج القائمة هو
  // ردّ الفعل الطبيعي للتراجع.
  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent | TouchEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false)
    document.addEventListener("mousedown", onDown)
    document.addEventListener("touchstart", onDown)
    document.addEventListener("keydown", onKey)
    return () => {
      document.removeEventListener("mousedown", onDown)
      document.removeEventListener("touchstart", onDown)
      document.removeEventListener("keydown", onKey)
    }
  }, [open])

  function pick(d: Date) {
    onChange(iso(d))
    setView(d)
    setOpen(false)
  }

  const shortcuts: { label: string; date: Date }[] = [
    { label: "اليوم", date: today },
    { label: "أمس", date: subDays(today, 1) },
    { label: "أول أمس", date: subDays(today, 2) },
  ]

  return (
    <div className="relative" ref={box}>
      {label && (
        <label htmlFor={id} className={dark ? "mb-1.5 block text-xs font-bold text-[#A7B4C3]" : "mb-1.5 block text-sm font-semibold text-[#164563]"}>
          {label}
        </label>
      )}

      <button
        id={id}
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="dialog"
        aria-expanded={open}
        className={`flex w-full items-center justify-between gap-2 rounded-xl border transition ${
          dark ? "h-12 border-transparent bg-[#07111C] px-3.5 text-base ring-1 ring-white/10" : compact ? "h-11 bg-white px-3 text-sm" : "h-14 bg-white px-4 text-base"
        } ${
          open ? (dark ? "ring-2 ring-[#EF790F]/70" : "border-[#EF790F] ring-2 ring-[#EF790F]/30") : dark ? "" : "border-slate-300"
        }`}
      >
        <span className={selected ? `truncate font-semibold ${dark ? "text-[#EEF2F7]" : "text-slate-800"}` : `truncate ${dark ? "text-[#7D8EA3]" : "text-slate-400"}`}>
          {selected ? format(selected, "EEEE، d MMMM yyyy", { locale: ar }) : placeholder}
        </span>
        <CalIcon className={`h-4 w-4 shrink-0 ${dark ? "text-[#7D8EA3]" : "text-slate-400"}`} />
      </button>

      {/* القيمة الحقيقية للفورم — الزرّ أعلاه واجهة فقط */}
      <input type="hidden" name={id} value={value} readOnly />

      {open && (
        <div
          role="dialog"
          aria-label="اختيار التاريخ"
          className={`absolute z-50 mt-1 w-full rounded-2xl p-3 shadow-xl ${dark ? "bg-[#13233A] ring-1 ring-white/10" : "border border-slate-200 bg-white"}`}
        >
          <div className="mb-3 flex gap-1.5">
            {shortcuts.map((s) => {
              const on = value === iso(s.date)
              return (
                <button
                  key={s.label}
                  type="button"
                  onClick={() => pick(s.date)}
                  className={`h-9 flex-1 rounded-lg text-xs font-bold transition ${
                    on ? (dark ? "bg-[#EF790F] text-[#07111C]" : "bg-[#164563] text-white") : dark ? "bg-white/[0.05] text-[#A7B4C3]" : "bg-slate-100 text-slate-600 active:bg-slate-200"
                  }`}
                >
                  {s.label}
                </button>
              )
            })}
          </div>

          <div className="mb-2 flex items-center justify-between">
            <button
              type="button"
              onClick={() => setView(addMonths(view, 1))}
              disabled={!allowFuture && isAfter(startOfMonth(addMonths(view, 1)), today)}
              className={`flex h-9 w-9 items-center justify-center rounded-lg disabled:opacity-30 ${dark ? "text-[#A7B4C3] active:bg-white/10" : "text-slate-600 active:bg-slate-100"}`}
              aria-label="الشهر التالي"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className={`font-bold ${dark ? "text-[#EEF2F7]" : "text-[#164563]"}`}>{format(view, "MMMM yyyy", { locale: ar })}</span>
            <button
              type="button"
              onClick={() => setView(addMonths(view, -1))}
              className={`flex h-9 w-9 items-center justify-center rounded-lg ${dark ? "text-[#A7B4C3] active:bg-white/10" : "text-slate-600 active:bg-slate-100"}`}
              aria-label="الشهر السابق"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          <div className="mb-1 grid grid-cols-7 gap-1">
            {WEEKDAYS.map((d) => (
              <div key={d} className={`py-1 text-center text-[11px] font-medium ${dark ? "text-[#7D8EA3]" : "text-slate-400"}`}>
                {d}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1">
            {days.map((day) => {
              const disabled = !allowFuture && isAfter(day, today)
              const isSel = selected != null && isSameDay(day, selected)
              const isToday = isSameDay(day, today)
              const outside = !isSameMonth(day, view)
              return (
                <button
                  key={day.toISOString()}
                  type="button"
                  disabled={disabled}
                  onClick={() => pick(day)}
                  className={`h-11 rounded-lg text-sm transition ${
                    isSel
                      ? dark
                        ? "bg-[#EF790F] font-bold text-[#07111C]"
                        : "bg-[#164563] font-bold text-white"
                      : disabled
                        ? `cursor-not-allowed ${dark ? "text-white/15" : "text-slate-200"}`
                        : isToday
                          ? `font-bold ring-1 ring-[#EF790F]/40 ${dark ? "text-[#F7A04B]" : "text-[#EF790F]"}`
                          : outside
                            ? dark ? "text-white/25" : "text-slate-300"
                            : dark ? "text-[#D5DDE6] active:bg-[#EF790F]/15" : "text-slate-700 active:bg-[#EF790F]/10"
                  }`}
                >
                  {format(day, "d")}
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
