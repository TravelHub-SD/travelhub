"use client"

import { useState, useRef, useEffect } from "react"
import { Input } from "@/components/ui/input"
import { popularAirports, searchAirports } from "@/lib/airports"
import { Plane } from "lucide-react"

interface AirportSelectProps {
  value: string
  onChange: (code: string) => void
  placeholder: string
  label: string
}

export function AirportSelect({ value, onChange, placeholder, label }: AirportSelectProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [filteredAirports, setFilteredAirports] = useState(popularAirports)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (searchQuery) {
      setFilteredAirports(searchAirports(searchQuery))
    } else {
      setFilteredAirports(popularAirports)
    }
  }, [searchQuery])

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  const handleSelect = (code: string, nameAr: string) => {
    onChange(code)
    setSearchQuery(`${nameAr} (${code})`)
    setIsOpen(false)
  }

  const displayValue = value
    ? popularAirports.find((a) => a.code === value)
      ? `${popularAirports.find((a) => a.code === value)?.nameAr} (${value})`
      : value
    : searchQuery

  return (
    <div className="space-y-2" ref={containerRef}>
      <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
        <Plane className="w-4 h-4" />
        {label}
      </label>
      <div className="relative">
        <Input
          placeholder={placeholder}
          className="h-12"
          value={displayValue}
          onChange={(e) => {
            setSearchQuery(e.target.value)
            setIsOpen(true)
          }}
          onFocus={() => setIsOpen(true)}
          required
        />
        {isOpen && (
          <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
            {filteredAirports.length > 0 ? (
              filteredAirports.map((airport) => (
                <button
                  key={airport.code}
                  type="button"
                  className="w-full px-4 py-3 text-right hover:bg-gray-50 flex items-center justify-between border-b border-gray-100 last:border-0"
                  onClick={() => handleSelect(airport.code, airport.nameAr)}
                >
                  <div className="flex flex-col items-start">
                    <span className="font-medium text-gray-900">{airport.nameAr}</span>
                    <span className="text-sm text-gray-500">
                      {airport.nameEn} - {airport.country}
                    </span>
                  </div>
                  <span className="text-sm font-bold text-[#1e3a5f] bg-gray-100 px-2 py-1 rounded">{airport.code}</span>
                </button>
              ))
            ) : (
              <div className="px-4 py-3 text-center text-gray-500">لا توجد نتائج</div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
