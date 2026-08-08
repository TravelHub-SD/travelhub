"use client"

import { useState, useRef, useEffect } from "react"
import { popularAirports } from "@/lib/airports"
import { Plane, ChevronDown, X, Search } from "lucide-react"

// أسماء عربية للأكواد المعروفة — بديلها اسم النظام الإنجليزي.
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
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const [airports, setAirports] = useState<Airport[]>(cachedAirports || [])
  const [loading, setLoading] = useState(!cachedAirports)
  const containerRef = useRef<HTMLDivElement>(null)

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
    const handle = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", handle)
    return () => document.removeEventListener("mousedown", handle)
  }, [])

  const q = query.trim().toLowerCase()
  const filtered = q
    ? airports.filter(
        (a) => a.nameAr.includes(query) || a.name.toLowerCase().includes(q) || a.code.toLowerCase().includes(q),
      )
    : airports

  const selected = airports.find((a) => a.code === value)

  return (
    <div className="space-y-2" ref={containerRef}>
      <label className="text-sm font-medium text-slate-700 flex items-center gap-2">
        <Plane className="w-4 h-4 text-[#ff8c42]" />
        {label}
      </label>
      <div className="relative">
        {/* الحقل */}
        <div
          onClick={() => {
            setOpen((o) => !o)
            setQuery("")
          }}
          className="w-full h-12 rounded-xl border border-slate-200 px-3 flex items-center justify-between gap-2 cursor-pointer hover:border-[#ff8c42] transition"
        >
          <span className={`truncate ${selected ? "font-semibold text-slate-800" : "text-slate-400"}`}>
            {selected ? `${selected.nameAr} · ${selected.code}` : loading ? "جاري تحميل المطارات..." : placeholder}
          </span>
          {selected ? (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                onChange("")
                setQuery("")
              }}
              className="shrink-0 w-6 h-6 rounded-full hover:bg-slate-100 flex items-center justify-center"
              aria-label="مسح"
            >
              <X className="w-4 h-4 text-slate-400" />
            </button>
          ) : (
            <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />
          )}
        </div>

        {/* القائمة المنسدلة */}
        {open && (
          <div className="absolute z-50 w-full mt-1 bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden">
            <div className="p-2 border-b border-slate-100">
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  autoFocus
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="ابحث عن مطار..."
                  className="w-full h-10 rounded-lg bg-slate-50 pr-9 pl-3 text-sm outline-none focus:ring-2 focus:ring-[#ff8c42]/30"
                />
              </div>
            </div>
            <div className="max-h-56 overflow-y-auto">
              {filtered.length > 0 ? (
                filtered.map((airport) => (
                  <button
                    key={airport.code}
                    type="button"
                    onClick={() => {
                      onChange(airport.code)
                      setOpen(false)
                      setQuery("")
                    }}
                    className={`w-full px-4 py-2.5 text-right hover:bg-slate-50 flex items-center justify-between border-b border-slate-50 last:border-0 transition ${
                      value === airport.code ? "bg-[#ff8c42]/5" : ""
                    }`}
                  >
                    <div className="flex flex-col items-start">
                      <span className="font-medium text-slate-900 text-sm">{airport.nameAr}</span>
                      {airport.name !== airport.nameAr && <span className="text-xs text-slate-400">{airport.name}</span>}
                    </div>
                    <span className="text-xs font-bold text-[#1e3a5f] bg-slate-100 px-2 py-0.5 rounded">{airport.code}</span>
                  </button>
                ))
              ) : (
                <div className="px-4 py-4 text-center text-slate-400 text-sm">
                  {loading ? "جاري التحميل..." : "لا توجد مطارات مطابقة"}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
