"use client"

import { useState, useRef, useEffect } from "react"
import { Input } from "@/components/ui/input"
import { popularAirports } from "@/lib/airports"
import { Plane, ChevronDown } from "lucide-react"

// أسماء عربية للأكواد المعروفة (من قائمة المطارات) — بديلها اسم النظام الإنجليزي.
const AR_BY_CODE: Record<string, string> = Object.fromEntries(popularAirports.map((a) => [a.code, a.nameAr]))

interface Airport {
  code: string
  name: string
  nameAr: string
}

interface AirportSelectProps {
  value: string
  onChange: (code: string) => void
  placeholder: string
  label: string
}

// تُجلب مرة واحدة وتُشارك بين كل الحقول.
let cachedAirports: Airport[] | null = null

export function AirportSelect({ value, onChange, placeholder, label }: AirportSelectProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [query, setQuery] = useState("")
  const [airports, setAirports] = useState<Airport[]>(cachedAirports || [])
  const [loading, setLoading] = useState(!cachedAirports)
  const containerRef = useRef<HTMLDivElement>(null)

  // جلب مطارات النظام من الموصّل (القوائم المنسدلة الفعلية).
  useEffect(() => {
    if (cachedAirports) return
    let alive = true
    fetch("/api/airports")
      .then((r) => r.json())
      .then((d) => {
        const list: Airport[] = (d?.airports || []).map((a: any) => ({
          code: a.code,
          name: a.name,
          nameAr: AR_BY_CODE[a.code] || a.name,
        }))
        if (alive && list.length) {
          cachedAirports = list
          setAirports(list)
        }
      })
      .catch(() => {})
      .finally(() => alive && setLoading(false))
    return () => {
      alive = false
    }
  }, [])

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) setIsOpen(false)
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  const q = query.trim().toLowerCase()
  const filtered = q
    ? airports.filter(
        (a) => a.nameAr.includes(query) || a.name.toLowerCase().includes(q) || a.code.toLowerCase().includes(q),
      )
    : airports

  const selected = airports.find((a) => a.code === value)
  const displayValue = value ? (selected ? `${selected.nameAr} (${value})` : value) : query

  const handleSelect = (a: Airport) => {
    onChange(a.code)
    setQuery(`${a.nameAr} (${a.code})`)
    setIsOpen(false)
  }

  return (
    <div className="space-y-2" ref={containerRef}>
      <label className="text-sm font-medium text-slate-700 flex items-center gap-2">
        <Plane className="w-4 h-4 text-[#ff8c42]" />
        {label}
      </label>
      <div className="relative">
        <Input
          placeholder={loading ? "جاري تحميل المطارات..." : placeholder}
          className="h-12 rounded-xl border-slate-200 pl-9"
          value={displayValue}
          onChange={(e) => {
            setQuery(e.target.value)
            setIsOpen(true)
          }}
          onFocus={() => setIsOpen(true)}
          required
        />
        <ChevronDown className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
        {isOpen && (
          <div className="absolute z-50 w-full mt-1 bg-white border border-slate-200 rounded-xl shadow-lg max-h-60 overflow-y-auto">
            {filtered.length > 0 ? (
              filtered.map((airport) => (
                <button
                  key={airport.code}
                  type="button"
                  className="w-full px-4 py-3 text-right hover:bg-slate-50 flex items-center justify-between border-b border-slate-100 last:border-0"
                  onClick={() => handleSelect(airport)}
                >
                  <div className="flex flex-col items-start">
                    <span className="font-medium text-slate-900">{airport.nameAr}</span>
                    {airport.name !== airport.nameAr && (
                      <span className="text-sm text-slate-500">{airport.name}</span>
                    )}
                  </div>
                  <span className="text-sm font-bold text-[#1e3a5f] bg-slate-100 px-2 py-1 rounded">{airport.code}</span>
                </button>
              ))
            ) : (
              <div className="px-4 py-3 text-center text-slate-500">
                {loading ? "جاري التحميل..." : "لا توجد مطارات مطابقة"}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
