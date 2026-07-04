"use client"

import type React from "react"
import { useRef, useState } from "react"
import {
  Phone,
  Mail,
  Plane,
  Hotel,
  FileText,
  Search,
  Calendar,
  MapPin,
  Users,
  MessageCircle,
  Globe,
  Clock,
  ArrowLeftRight,
  ShieldCheck,
  Headphones,
  BadgeCheck,
  Star,
  ChevronLeft,
  Briefcase,
  Zap,
  TrendingDown,
  Luggage,
  X,
  SlidersHorizontal,
  Leaf,
  Check,
  RefreshCw,
  RotateCcw,
  Info,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { AirportSelect } from "@/components/airport-select"
import { getAirlineName, getAirlineLogo } from "@/lib/airlines"

const EXCHANGE_RATE = 3650 // سعر الدولار مقابل الجنيه السوداني
const PHONE_NUMBER = "249114610204"
const WHATSAPP_NUMBER = "249960278594"

const formatPrice = (usdPrice: string) => {
  const price = Number.parseFloat(usdPrice)
  const sdgPrice = Math.round(price * EXCHANGE_RATE)
  return { usd: price.toFixed(2), sdg: sdgPrice.toLocaleString("ar-SA") }
}

// PT7H15M -> "7 س 15 د"
const formatDuration = (iso?: string) => {
  if (!iso) return ""
  const m = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?/)
  if (!m) return iso.replace("PT", "")
  const h = m[1] ? `${m[1]} س` : ""
  const min = m[2] ? `${m[2]} د` : ""
  return [h, min].filter(Boolean).join(" ")
}

const durationToMinutes = (iso?: string) => {
  if (!iso) return Number.MAX_SAFE_INTEGER
  const m = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?/)
  if (!m) return Number.MAX_SAFE_INTEGER
  return Number.parseInt(m[1] || "0") * 60 + Number.parseInt(m[2] || "0")
}

// فرق الأيام بين المغادرة والوصول (لعرض +1 / +2)
const dayOffset = (dep: string, arr: string) => {
  const d1 = new Date(dep).setHours(0, 0, 0, 0)
  const d2 = new Date(arr).setHours(0, 0, 0, 0)
  return Math.round((d2 - d1) / 86400000)
}

const bookViaWhatsApp = (flightDetails: any) => {
  const message = `مرحباً، أريد حجز رحلة من ${flightDetails.origin} إلى ${flightDetails.destination} بتاريخ ${flightDetails.date} بسعر ${flightDetails.price} جنيه`
  window.open(`https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`, "_blank")
}

export default function Home() {
  const [activeTab, setActiveTab] = useState<"flights" | "hotels" | "activities">("flights")
  const [tripType, setTripType] = useState<"one-way" | "round-trip" | "multi-city">("round-trip")
  const [language, setLanguage] = useState<"ar" | "en">("ar")
  const [isLoading, setIsLoading] = useState(false)
  const [searchResults, setSearchResults] = useState<any>(null)
  const [sortBy, setSortBy] = useState<"cheapest" | "fastest" | "nonstop">("cheapest")
  const [selectedFlight, setSelectedFlight] = useState<any>(null)
  const [filters, setFilters] = useState<{
    airlines: string[]
    stops: "all" | "0" | "1" | "2"
    maxPrice: number | null
    baggageOnly: boolean
    refundableOnly: boolean
  }>({ airlines: [], stops: "all", maxPrice: null, baggageOnly: false, refundableOnly: false })
  const resultsRef = useRef<HTMLDivElement>(null)

  const resetFilters = () =>
    setFilters({ airlines: [], stops: "all", maxPrice: null, baggageOnly: false, refundableOnly: false })

  const [flightForm, setFlightForm] = useState({ origin: "", destination: "", departureDate: "", adults: "1" })
  const [hotelForm, setHotelForm] = useState({ city: "", checkIn: "", checkOut: "", adults: "1" })

  const handleFlightSearch = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setSearchResults(null)
    resetFilters()
    setSortBy("cheapest")
    try {
      const response = await fetch("/api/flights/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(flightForm),
      })
      const data = await response.json()
      if (!response.ok) {
        alert(data.error || "حدث خطأ أثناء البحث")
        return
      }
      setSearchResults(data)
      setTimeout(() => resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 300)
    } catch (error) {
      console.error("Search error:", error)
      alert("حدث خطأ أثناء البحث عن الرحلات")
    } finally {
      setIsLoading(false)
    }
  }

  const handleHotelSearch = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setSearchResults(null)
    try {
      const response = await fetch("/api/hotels/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(hotelForm),
      })
      const data = await response.json()
      if (!response.ok) {
        alert(data.error || "حدث خطأ أثناء البحث")
        return
      }
      setSearchResults(data)
      setTimeout(() => resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 300)
    } catch (error) {
      console.error("Search error:", error)
      alert("حدث خطأ أثناء البحث عن الفنادق")
    } finally {
      setIsLoading(false)
    }
  }

  const topHotels = [
    { city: "القاهرة", hotel: "Ramses Hilton", image: "/cairo-hotel.jpg", price: "من 85$" },
    { city: "دبي", hotel: "Atlantis The Royal", image: "/dubai-hotel.jpg", price: "من 240$" },
    { city: "إسطنبول", hotel: "DoubleTree by Hilton", image: "/istanbul-hotel.jpg", price: "من 70$" },
    { city: "لندن", hotel: "Royal Lancaster London", image: "/london-hotel.jpg", price: "من 180$" },
  ]

  const tripTypes: { key: typeof tripType; label: string }[] = [
    { key: "round-trip", label: "ذهاب وعودة" },
    { key: "one-way", label: "ذهاب فقط" },
    { key: "multi-city", label: "متعدد المدن" },
  ]

  const services = [
    { icon: Plane, title: "حجز طيران", desc: "رحلات دولية ومحلية بأفضل الأسعار مع أكثر من 450 شركة طيران عالمية." },
    { icon: Hotel, title: "فنادق ومنتجعات", desc: "تأكيد فوري لحجوزات الفنادق في أكثر من 180 دولة حول العالم." },
    { icon: FileText, title: "استخراج التأشيرات", desc: "نسهّل عليك إجراءات التأشيرات السياحية وتأشيرات الزيارة لكل الوجهات." },
  ]

  const trust = [
    { icon: BadgeCheck, title: "أسعار موثوقة", desc: "أسعار حيّة ومحدّثة لحظياً" },
    { icon: ShieldCheck, title: "حجز آمن", desc: "تأكيد مباشر عبر واتساب" },
    { icon: Headphones, title: "دعم 24/7", desc: "على مدار الأسبوع" },
  ]

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800" dir={language === "ar" ? "rtl" : "ltr"}>
      {/* ─── Header ─── */}
      <header className="sticky top-0 z-50 bg-[#12294a]/95 backdrop-blur-md border-b border-white/10">
        <div className="container mx-auto px-4 h-16 flex justify-between items-center">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-[#ff8c42] flex items-center justify-center shadow-lg shadow-orange-500/20">
              <Plane className="w-5 h-5 text-white -rotate-45" />
            </div>
            <h1 className="text-xl font-bold tracking-tight">
              <span className="text-white">Travel</span>
              <span className="text-[#ff8c42]">Hub</span>
            </h1>
          </div>
          <nav className="hidden md:flex items-center gap-8 text-sm text-white/80">
            <a href="#flights" className="hover:text-[#ff8c42] transition">الرحلات</a>
            <a href="#hotels" className="hover:text-[#ff8c42] transition">الفنادق</a>
            <a href="#services" className="hover:text-[#ff8c42] transition">خدماتنا</a>
            <a href="#contact" className="hover:text-[#ff8c42] transition">تواصل معنا</a>
          </nav>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setLanguage(language === "ar" ? "en" : "ar")}
            className="bg-white/5 text-white border-white/20 hover:bg-[#ff8c42] hover:border-[#ff8c42] transition-all rounded-full"
          >
            <Globe className="w-4 h-4 ml-1" />
            {language === "ar" ? "English" : "العربية"}
          </Button>
        </div>
      </header>

      {/* ─── Hero + Booking ─── */}
      <section className="relative bg-hero-gradient text-white pt-16 pb-28 overflow-hidden">
        <div className="absolute inset-0 opacity-[0.07] bg-[url('/airplane-flying-in-blue-sky.jpg')] bg-cover bg-center" />
        <div className="container mx-auto px-4 relative z-10">
          <div className="max-w-3xl mx-auto text-center space-y-5 animate-rise">
            <span className="inline-flex items-center gap-2 text-xs font-medium px-4 py-1.5 rounded-full glass text-white/90">
              <Star className="w-3.5 h-3.5 text-[#ff8c42] fill-[#ff8c42]" />
              وجهتك الموثوقة للسفر من السودان إلى العالم
            </span>
            <h2 className="text-4xl md:text-6xl font-extrabold leading-tight text-balance">
              احجز رحلتك القادمة <span className="text-[#ff8c42]">بثقة</span>
            </h2>
            <p className="text-base md:text-lg text-white/75 text-balance max-w-xl mx-auto">
              قارن أسعار أكثر من 450 شركة طيران و1.5 مليون فندق، واحجز مباشرة عبر واتساب في دقائق.
            </p>
          </div>

          {/* Booking Card */}
          <Card className="border-0 rounded-3xl shadow-float mt-10 max-w-5xl mx-auto animate-rise">
            <CardContent className="p-4 md:p-6">
              <Tabs value={activeTab} onValueChange={setActiveTab as any} className="w-full">
                <TabsList className="grid w-full max-w-md mx-auto grid-cols-3 mb-6 bg-slate-100 rounded-2xl p-1 h-12">
                  {[
                    { v: "flights", icon: Plane, label: "طيران" },
                    { v: "hotels", icon: Hotel, label: "فنادق" },
                    { v: "activities", icon: MapPin, label: "أنشطة" },
                  ].map(({ v, icon: Icon, label }) => (
                    <TabsTrigger
                      key={v}
                      value={v}
                      className="rounded-xl data-[state=active]:bg-[#ff8c42] data-[state=active]:text-white data-[state=active]:shadow-md font-semibold transition-all"
                    >
                      <Icon className="w-4 h-4 ml-1.5" />
                      {label}
                    </TabsTrigger>
                  ))}
                </TabsList>

                {/* Flights */}
                <TabsContent value="flights" className="space-y-4">
                  <form onSubmit={handleFlightSearch}>
                    <div className="inline-flex gap-1 mb-5 bg-slate-100 p-1 rounded-full">
                      {tripTypes.map((t) => (
                        <button
                          key={t.key}
                          type="button"
                          onClick={() => setTripType(t.key)}
                          className={`px-4 py-1.5 text-sm font-medium rounded-full transition-all ${
                            tripType === t.key ? "bg-white text-[#1e3a5f] shadow-sm" : "text-slate-500 hover:text-slate-700"
                          }`}
                        >
                          {t.label}
                        </button>
                      ))}
                    </div>

                    <div className="grid md:grid-cols-3 gap-4">
                      <AirportSelect
                        value={flightForm.origin}
                        onChange={(code) => setFlightForm({ ...flightForm, origin: code })}
                        placeholder="مثال: الخرطوم، الرياض"
                        label="من (المغادرة)"
                      />
                      <AirportSelect
                        value={flightForm.destination}
                        onChange={(code) => setFlightForm({ ...flightForm, destination: code })}
                        placeholder="مثال: دبي، القاهرة"
                        label="إلى (الوجهة)"
                      />
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-slate-700 flex items-center gap-2">
                          <Calendar className="w-4 h-4 text-[#ff8c42]" />
                          تاريخ المغادرة
                        </label>
                        <Input
                          type="date"
                          className="h-12 rounded-xl border-slate-200"
                          value={flightForm.departureDate}
                          onChange={(e) => setFlightForm({ ...flightForm, departureDate: e.target.value })}
                          required
                        />
                      </div>
                    </div>
                    <div className="grid md:grid-cols-3 gap-4 mt-4">
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-slate-700 flex items-center gap-2">
                          <Users className="w-4 h-4 text-[#ff8c42]" />
                          عدد المسافرين
                        </label>
                        <Input
                          type="number"
                          min="1"
                          max="9"
                          className="h-12 rounded-xl border-slate-200"
                          value={flightForm.adults}
                          onChange={(e) => setFlightForm({ ...flightForm, adults: e.target.value })}
                        />
                      </div>
                      <div className="md:col-span-2 flex items-end">
                        <Button
                          type="submit"
                          className="w-full bg-[#ff8c42] hover:bg-[#ff7a2e] text-white h-12 rounded-xl text-base font-bold shadow-lg shadow-orange-500/25"
                          disabled={isLoading}
                        >
                          {isLoading ? "جاري البحث..." : (<><Search className="ml-2 w-5 h-5" /> بحث عن رحلات</>)}
                        </Button>
                      </div>
                    </div>
                  </form>
                </TabsContent>

                {/* Hotels */}
                <TabsContent value="hotels" className="space-y-4">
                  <form onSubmit={handleHotelSearch}>
                    <div className="grid md:grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-slate-700 flex items-center gap-2">
                          <MapPin className="w-4 h-4 text-[#ff8c42]" /> المدينة أو الفندق
                        </label>
                        <Input
                          placeholder="مثال: Dubai أو London"
                          className="h-12 rounded-xl border-slate-200"
                          value={hotelForm.city}
                          onChange={(e) => setHotelForm({ ...hotelForm, city: e.target.value })}
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-slate-700 flex items-center gap-2">
                          <Calendar className="w-4 h-4 text-[#ff8c42]" /> تاريخ الوصول
                        </label>
                        <Input
                          type="date"
                          className="h-12 rounded-xl border-slate-200"
                          value={hotelForm.checkIn}
                          onChange={(e) => setHotelForm({ ...hotelForm, checkIn: e.target.value })}
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-slate-700 flex items-center gap-2">
                          <Calendar className="w-4 h-4 text-[#ff8c42]" /> تاريخ المغادرة
                        </label>
                        <Input
                          type="date"
                          className="h-12 rounded-xl border-slate-200"
                          value={hotelForm.checkOut}
                          onChange={(e) => setHotelForm({ ...hotelForm, checkOut: e.target.value })}
                          required
                        />
                      </div>
                    </div>
                    <Button
                      type="submit"
                      className="w-full bg-[#ff8c42] hover:bg-[#ff7a2e] text-white h-12 rounded-xl mt-4 text-base font-bold shadow-lg shadow-orange-500/25"
                      disabled={isLoading}
                    >
                      {isLoading ? "جاري البحث..." : (<><Search className="ml-2 w-5 h-5" /> بحث عن فنادق</>)}
                    </Button>
                  </form>
                </TabsContent>

                {/* Activities */}
                <TabsContent value="activities" className="space-y-4">
                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-slate-700 flex items-center gap-2">
                        <MapPin className="w-4 h-4 text-[#ff8c42]" /> الوجهة
                      </label>
                      <Input placeholder="اختر المدينة" className="h-12 rounded-xl border-slate-200" />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-slate-700 flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-[#ff8c42]" /> التاريخ
                      </label>
                      <Input type="date" className="h-12 rounded-xl border-slate-200" />
                    </div>
                  </div>
                  <Button className="w-full bg-[#ff8c42] hover:bg-[#ff7a2e] text-white h-12 rounded-xl text-base font-bold shadow-lg shadow-orange-500/25">
                    <Search className="ml-2 w-5 h-5" /> استكشف الأنشطة
                  </Button>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>

          {/* Trust row */}
          <div className="max-w-5xl mx-auto mt-6 grid grid-cols-3 gap-3">
            {trust.map((t, i) => (
              <div key={i} className="glass rounded-2xl px-3 py-3 flex items-center gap-3 justify-center text-center">
                <t.icon className="w-6 h-6 text-[#ff8c42] shrink-0" />
                <div className="text-right hidden sm:block">
                  <p className="text-sm font-semibold text-white leading-tight">{t.title}</p>
                  <p className="text-xs text-white/60">{t.desc}</p>
                </div>
                <p className="text-sm font-semibold text-white sm:hidden">{t.title}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Loading ─── */}
      {isLoading && (
        <section className="container mx-auto px-4 py-12">
          <Card className="border-0 rounded-3xl shadow-card">
            <CardContent className="p-12 text-center">
              <div className="relative w-24 h-24 mx-auto mb-6">
                <div className="absolute inset-0 rounded-full border-4 border-[#ff8c42]/20" />
                <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-[#ff8c42] animate-spin" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <Plane className="w-9 h-9 text-[#ff8c42] -rotate-45" />
                </div>
              </div>
              <h3 className="text-2xl font-bold text-[#1e3a5f] mb-2">جاري البحث عن أفضل العروض...</h3>
              <p className="text-slate-500">نقارن الأسعار من مئات شركات الطيران</p>
            </CardContent>
          </Card>
        </section>
      )}

      {/* ─── Results ─── */}
      {searchResults && (
        <section ref={resultsRef} className="container mx-auto px-4 py-10 scroll-mt-20">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-2xl md:text-3xl font-bold text-[#1e3a5f]">
                {activeTab === "flights" ? "نتائج الرحلات" : "نتائج الفنادق"}
              </h3>
              {searchResults.data && (
                <p className="text-slate-500 text-sm mt-1">
                  عثرنا على {searchResults.data.length} {activeTab === "flights" ? "رحلة" : "فندق"}
                  {searchResults?.meta?.source === "mock" && " (بيانات تجريبية)"}
                </p>
              )}
            </div>
            <Button
              variant="outline"
              onClick={() => setSearchResults(null)}
              className="text-[#ff8c42] border-[#ff8c42] rounded-full hover:bg-[#ff8c42] hover:text-white"
            >
              بحث جديد
            </Button>
          </div>

          {/* Flights */}
          {activeTab === "flights" && searchResults.data && searchResults.data.length > 0 && (() => {
            const fmtTime = (t: string) =>
              new Date(t).toLocaleTimeString(language === "ar" ? "ar-SA" : "en-US", { hour: "2-digit", minute: "2-digit" })

            const allItems = searchResults.data.map((flight: any, index: number) => {
              const segments = flight.itineraries[0].segments
              return {
                flight,
                index,
                price: Number.parseFloat(flight.price.total),
                dur: durationToMinutes(flight.itineraries[0].duration),
                stops: segments.length - 1,
                carriers: Array.from(new Set(segments.map((s: any) => s.carrierCode))) as string[],
                hasBag: (flight.baggage?.checked ?? 0) > 0,
                refundable: Boolean(flight.refundable),
              }
            })

            const priceMax = Math.ceil(Math.max(...allItems.map((x: any) => x.price)))
            const priceMin = Math.floor(Math.min(...allItems.map((x: any) => x.price)))
            const allAirlines = Array.from(new Set(allItems.flatMap((x: any) => x.carriers))) as string[]
            const effectiveMax = filters.maxPrice ?? priceMax

            const filtered = allItems.filter((x: any) => {
              if (x.price > effectiveMax) return false
              if (filters.stops === "0" && x.stops !== 0) return false
              if (filters.stops === "1" && x.stops !== 1) return false
              if (filters.stops === "2" && x.stops < 2) return false
              if (filters.baggageOnly && !x.hasBag) return false
              if (filters.refundableOnly && !x.refundable) return false
              if (filters.airlines.length && !x.carriers.some((c: string) => filters.airlines.includes(c))) return false
              return true
            })

            const minPrice = filtered.length ? Math.min(...filtered.map((x: any) => x.price)) : 0
            const minDur = filtered.length ? Math.min(...filtered.map((x: any) => x.dur)) : 0
            const sorted = [...filtered].sort((a: any, b: any) => {
              if (sortBy === "fastest") return a.dur - b.dur
              if (sortBy === "nonstop") return a.stops - b.stops || a.price - b.price
              return a.price - b.price
            })

            const sortTabs: { key: typeof sortBy; label: string; icon: any }[] = [
              { key: "cheapest", label: "الأرخص", icon: TrendingDown },
              { key: "fastest", label: "الأسرع", icon: Zap },
              { key: "nonstop", label: "المباشرة أولاً", icon: Plane },
            ]
            const stopOptions: { key: typeof filters.stops; label: string }[] = [
              { key: "all", label: "الكل" },
              { key: "0", label: "مباشر" },
              { key: "1", label: "توقف واحد" },
              { key: "2", label: "توقفان+" },
            ]
            const toggleAirline = (code: string) =>
              setFilters((f) => ({
                ...f,
                airlines: f.airlines.includes(code) ? f.airlines.filter((c) => c !== code) : [...f.airlines, code],
              }))

            return (
              <div className="grid lg:grid-cols-[260px_1fr] gap-6 items-start">
                {/* Filters sidebar */}
                <aside className="bg-white rounded-2xl border border-slate-100 shadow-card p-5 space-y-6 lg:sticky lg:top-20">
                  <div className="flex items-center justify-between">
                    <h4 className="font-bold text-[#1e3a5f] flex items-center gap-2">
                      <SlidersHorizontal className="w-4 h-4 text-[#ff8c42]" /> تصفية النتائج
                    </h4>
                    <button onClick={resetFilters} className="text-xs text-[#ff8c42] hover:underline flex items-center gap-1">
                      <RotateCcw className="w-3 h-3" /> مسح
                    </button>
                  </div>

                  {/* Price */}
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-slate-700">أقصى سعر</label>
                    <input
                      type="range"
                      min={priceMin}
                      max={priceMax}
                      value={effectiveMax}
                      onChange={(e) => setFilters((f) => ({ ...f, maxPrice: Number(e.target.value) }))}
                      className="w-full accent-[#ff8c42]"
                    />
                    <p className="text-xs text-slate-500">
                      حتى <span className="font-bold text-[#ff8c42]">{formatPrice(String(effectiveMax)).sdg} ج.س</span>
                    </p>
                  </div>

                  {/* Stops */}
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-slate-700">التوقفات</label>
                    <div className="grid grid-cols-2 gap-2">
                      {stopOptions.map((s) => (
                        <button
                          key={s.key}
                          onClick={() => setFilters((f) => ({ ...f, stops: s.key }))}
                          className={`text-xs font-medium py-2 rounded-lg border transition ${
                            filters.stops === s.key
                              ? "border-[#ff8c42] bg-[#ff8c42]/10 text-[#ff7a2e]"
                              : "border-slate-200 text-slate-500 hover:border-slate-300"
                          }`}
                        >
                          {s.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Toggles */}
                  <div className="space-y-2">
                    {[
                      { key: "baggageOnly" as const, label: "أمتعة مسجّلة مشمولة", icon: Luggage },
                      { key: "refundableOnly" as const, label: "قابل للاسترجاع", icon: RefreshCw },
                    ].map((t) => (
                      <button
                        key={t.key}
                        onClick={() => setFilters((f) => ({ ...f, [t.key]: !f[t.key] }))}
                        className="w-full flex items-center gap-2.5 text-sm text-slate-600"
                      >
                        <span
                          className={`w-5 h-5 rounded-md border flex items-center justify-center transition ${
                            filters[t.key] ? "bg-[#ff8c42] border-[#ff8c42]" : "border-slate-300"
                          }`}
                        >
                          {filters[t.key] && <Check className="w-3.5 h-3.5 text-white" />}
                        </span>
                        <t.icon className="w-4 h-4 text-slate-400" />
                        {t.label}
                      </button>
                    ))}
                  </div>

                  {/* Airlines */}
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-slate-700">شركات الطيران</label>
                    <div className="space-y-1.5 max-h-56 overflow-y-auto pl-1">
                      {allAirlines.map((code) => (
                        <button
                          key={code}
                          onClick={() => toggleAirline(code)}
                          className="w-full flex items-center gap-2.5 text-sm text-slate-600"
                        >
                          <span
                            className={`w-5 h-5 rounded-md border flex items-center justify-center transition shrink-0 ${
                              filters.airlines.includes(code) ? "bg-[#ff8c42] border-[#ff8c42]" : "border-slate-300"
                            }`}
                          >
                            {filters.airlines.includes(code) && <Check className="w-3.5 h-3.5 text-white" />}
                          </span>
                          <span className="truncate text-right flex-1">{getAirlineName(code, language)}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                </aside>

                {/* Results list */}
                <div className="space-y-4">
                  {/* Sort tabs */}
                  <div className="inline-flex gap-1 bg-slate-100 p-1 rounded-full">
                    {sortTabs.map((t) => (
                      <button
                        key={t.key}
                        onClick={() => setSortBy(t.key)}
                        className={`flex items-center gap-1.5 px-4 py-2 text-sm font-semibold rounded-full transition-all ${
                          sortBy === t.key ? "bg-white text-[#1e3a5f] shadow-sm" : "text-slate-500 hover:text-slate-700"
                        }`}
                      >
                        <t.icon className="w-4 h-4" /> {t.label}
                      </button>
                    ))}
                  </div>

                  {sorted.length === 0 && (
                    <div className="text-center py-16 bg-white rounded-2xl border border-slate-100">
                      <p className="text-slate-500">لا توجد رحلات مطابقة للفلاتر.</p>
                      <button onClick={resetFilters} className="text-[#ff8c42] text-sm mt-2 hover:underline">
                        مسح الفلاتر
                      </button>
                    </div>
                  )}

                  {sorted.map(({ flight, index, price, dur, stops }: any) => {
                    const prices = formatPrice(flight.price.total)
                    const segments = flight.itineraries[0].segments
                    const first = segments[0]
                    const last = segments[segments.length - 1]
                    const carriers = Array.from(new Set(segments.map((s: any) => s.carrierCode))) as string[]
                    const logoFor = (code: string) =>
                      segments.find((s: any) => s.carrierCode === code)?.logo || getAirlineLogo(code)
                    const airlineNames = carriers.map((c) => getAirlineName(c, language)).join("، ")
                    const stopCities = segments.slice(0, -1).map((s: any) => s.arrival.iataCode)
                    const offset = dayOffset(first.departure.at, last.arrival.at)
                    const isCheapest = price === minPrice
                    const isFastest = dur === minDur

                    return (
                      <Card
                        key={index}
                        className="border border-slate-100 rounded-2xl shadow-card hover:shadow-card-hover transition-all overflow-hidden animate-rise"
                      >
                        <CardContent className="p-0">
                          {(isCheapest || isFastest) && (
                            <div className="flex gap-2 px-5 pt-4">
                              {isCheapest && (
                                <span className="inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-md bg-emerald-500 text-white">
                                  <TrendingDown className="w-3 h-3" /> الأرخص
                                </span>
                              )}
                              {isFastest && (
                                <span className="inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-md bg-[#1e3a5f] text-white">
                                  <Zap className="w-3 h-3" /> الأسرع
                                </span>
                              )}
                            </div>
                          )}

                          <div className="grid lg:grid-cols-[1fr_auto] gap-0">
                            <div className="p-5 md:p-6">
                              <div className="flex items-center gap-3 mb-5">
                                <div className="flex -space-x-2 rtl:space-x-reverse shrink-0">
                                  {carriers.slice(0, 2).map((c) => (
                                    <div
                                      key={c}
                                      className="w-11 h-11 rounded-xl bg-white border border-slate-100 flex items-center justify-center overflow-hidden shadow-sm"
                                    >
                                      <img
                                        src={logoFor(c) || "/placeholder.svg"}
                                        alt={getAirlineName(c, language)}
                                        className="w-8 h-8 object-contain"
                                        onError={(e) => ((e.target as HTMLImageElement).src = "/abstract-airline-logo.png")}
                                      />
                                    </div>
                                  ))}
                                </div>
                                <div className="min-w-0">
                                  <p className="font-bold text-slate-800 leading-tight truncate">{airlineNames}</p>
                                  <p className="text-xs text-slate-400">
                                    {first.flightNumber ? `رحلة ${first.flightNumber}` : `رحلة ${carriers.join("/")}`} · {flight.cabinClass}
                                  </p>
                                </div>
                              </div>

                              <div className="flex items-center gap-4">
                                <div className="text-center min-w-[68px]">
                                  <p className="text-2xl font-extrabold text-[#1e3a5f] tracking-tight">{fmtTime(first.departure.at)}</p>
                                  <p className="text-sm font-semibold text-slate-600 mt-0.5">{first.departure.iataCode}</p>
                                </div>
                                <div className="flex-1 flex flex-col items-center gap-1.5 px-2">
                                  <span className="text-xs font-medium text-slate-400 flex items-center gap-1">
                                    <Clock className="w-3 h-3" /> {formatDuration(flight.itineraries[0].duration)}
                                  </span>
                                  <div className="w-full flight-path" />
                                  <span
                                    className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                                      stops === 0 ? "bg-emerald-50 text-emerald-600" : "badge-soft"
                                    }`}
                                  >
                                    {stops === 0 ? "مباشر" : `${stops} توقف في ${stopCities.join("، ")}`}
                                  </span>
                                </div>
                                <div className="text-center min-w-[68px]">
                                  <p className="text-2xl font-extrabold text-[#1e3a5f] tracking-tight relative inline-block">
                                    {fmtTime(last.arrival.at)}
                                    {offset > 0 && (
                                      <sup className="text-[10px] font-bold text-[#ff8c42] absolute -top-1 -left-4">+{offset}</sup>
                                    )}
                                  </p>
                                  <p className="text-sm font-semibold text-slate-600 mt-0.5">{last.arrival.iataCode}</p>
                                </div>
                              </div>

                              {/* extras row */}
                              <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mt-4 pt-4 border-t border-slate-100 text-xs text-slate-500">
                                <span className="flex items-center gap-1.5">
                                  <Luggage className="w-3.5 h-3.5 text-[#ff8c42]" />
                                  {flight.baggage?.checked > 0 ? `${flight.baggage.checked} حقيبة مسجّلة` : "بدون حقيبة مسجّلة"}
                                </span>
                                <span className="flex items-center gap-1.5">
                                  <Briefcase className="w-3.5 h-3.5 text-[#ff8c42]" /> حقيبة يد
                                </span>
                                <span className={`flex items-center gap-1.5 ${flight.refundable ? "text-emerald-600" : "text-slate-400"}`}>
                                  <RefreshCw className="w-3.5 h-3.5" /> {flight.refundable ? "قابل للاسترجاع" : "غير قابل للاسترجاع"}
                                </span>
                                {flight.emissionsKg && (
                                  <span className="flex items-center gap-1.5">
                                    <Leaf className="w-3.5 h-3.5 text-emerald-500" /> {flight.emissionsKg} كجم CO₂
                                  </span>
                                )}
                              </div>
                            </div>

                            {/* Price + CTA */}
                            <div className="bg-slate-50/70 border-t lg:border-t-0 lg:border-r border-slate-100 p-5 md:p-6 flex flex-col justify-center lg:min-w-[240px]">
                              <div className="text-center lg:text-right mb-3">
                                <p className="text-sm text-slate-400 line-through">${prices.usd}</p>
                                <p className="text-3xl font-extrabold text-[#ff8c42] leading-none">
                                  {prices.sdg} <span className="text-lg font-bold">ج.س</span>
                                </p>
                                <p className="text-xs text-slate-400 mt-1">للشخص الواحد · شامل الضرائب</p>
                              </div>
                              <Button
                                className="w-full bg-[#25D366] hover:bg-[#20BA5A] text-white flex items-center justify-center gap-2 rounded-xl h-11 font-bold shadow-md shadow-green-500/20"
                                onClick={() =>
                                  bookViaWhatsApp({
                                    origin: first.departure.iataCode,
                                    destination: last.arrival.iataCode,
                                    date: new Date(first.departure.at).toLocaleDateString(language === "ar" ? "ar-SA" : "en-US"),
                                    price: prices.sdg,
                                  })
                                }
                              >
                                <MessageCircle className="w-5 h-5" /> احجز عبر واتساب
                              </Button>
                              <button
                                onClick={() => setSelectedFlight(flight)}
                                className="w-full mt-2 text-sm font-semibold text-[#1e3a5f] hover:text-[#ff8c42] flex items-center justify-center gap-1.5 transition"
                              >
                                <Info className="w-4 h-4" /> تفاصيل الرحلة
                              </button>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    )
                  })}
                </div>
              </div>
            )
          })()}

          {/* Hotels */}
          {activeTab === "hotels" && searchResults.data && (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {searchResults.data.map((hotel: any, index: number) => {
                const hotelData = hotel.hotel
                const offer = hotel.offers?.[0]
                const prices = offer?.price ? formatPrice(offer.price.total) : null
                return (
                  <Card key={index} className="border-0 rounded-2xl shadow-card hover:shadow-card-hover transition overflow-hidden group">
                    <div className="relative h-44 overflow-hidden bg-gradient-to-br from-[#1e3a5f] to-[#2c5282]">
                      <div className="absolute inset-0 flex items-center justify-center">
                        <Hotel className="w-14 h-14 text-white/25" />
                      </div>
                      {hotelData.rating && (
                        <div className="absolute top-3 left-3 bg-white/95 text-[#1e3a5f] px-2.5 py-1 rounded-full font-bold text-xs flex items-center gap-1">
                          <Star className="w-3 h-3 text-[#ff8c42] fill-[#ff8c42]" /> {hotelData.rating}
                        </div>
                      )}
                    </div>
                    <CardContent className="p-5">
                      <h4 className="text-lg font-bold text-[#1e3a5f] mb-2 line-clamp-1">{hotelData.name}</h4>
                      <div className="flex items-center gap-1.5 text-sm text-slate-500 mb-4">
                        <MapPin className="w-4 h-4 text-[#ff8c42]" /> <span>{hotelData.cityCode}</span>
                      </div>
                      {prices && (
                        <div className="flex items-end justify-between mb-4">
                          <div>
                            <p className="text-2xl font-extrabold text-[#ff8c42] leading-none">{prices.sdg} <span className="text-sm">ج.س</span></p>
                            <p className="text-xs text-slate-400 mt-1">${prices.usd} · لكل ليلة</p>
                          </div>
                        </div>
                      )}
                      <Button
                        className="w-full bg-[#25D366] hover:bg-[#20BA5A] text-white flex items-center justify-center gap-2 rounded-xl h-11 font-bold"
                        onClick={() =>
                          bookViaWhatsApp({
                            origin: hotelData.name,
                            destination: hotelData.cityCode,
                            date: hotelForm.checkIn,
                            price: prices?.sdg || "السعر عند التواصل",
                          })
                        }
                      >
                        <MessageCircle className="w-5 h-5" /> احجز عبر واتساب
                      </Button>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          )}

          {(!searchResults.data || searchResults.data.length === 0) && (
            <div className="text-center py-16">
              <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-4">
                <Search className="w-7 h-7 text-slate-400" />
              </div>
              <p className="text-slate-500 text-lg">لا توجد نتائج. حاول تعديل معايير البحث.</p>
            </div>
          )}
        </section>
      )}

      {/* ─── Flight details modal ─── */}
      {selectedFlight && (() => {
        const flight = selectedFlight
        const segments = flight.itineraries[0].segments
        const first = segments[0]
        const last = segments[segments.length - 1]
        const prices = formatPrice(flight.price.total)
        const fmtTime = (t: string) =>
          new Date(t).toLocaleTimeString(language === "ar" ? "ar-SA" : "en-US", { hour: "2-digit", minute: "2-digit" })
        const fmtDate = (t: string) =>
          new Date(t).toLocaleDateString(language === "ar" ? "ar-SA" : "en-US", { weekday: "short", day: "numeric", month: "short" })

        return (
          <div
            className="fixed inset-0 z-[100] flex items-end md:items-center justify-center bg-black/50 backdrop-blur-sm p-0 md:p-4 animate-rise"
            onClick={() => setSelectedFlight(null)}
          >
            <div
              className="bg-white w-full md:max-w-2xl md:rounded-3xl rounded-t-3xl max-h-[90vh] overflow-y-auto shadow-float"
              onClick={(e) => e.stopPropagation()}
              dir={language === "ar" ? "rtl" : "ltr"}
            >
              {/* header */}
              <div className="sticky top-0 bg-brand-gradient text-white p-5 flex items-center justify-between z-10">
                <div>
                  <h3 className="text-lg font-bold">تفاصيل الرحلة</h3>
                  <p className="text-sm text-white/70">
                    {first.departure.iataCode} → {last.arrival.iataCode} · {formatDuration(flight.itineraries[0].duration)}
                  </p>
                </div>
                <button onClick={() => setSelectedFlight(null)} className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-5 space-y-4">
                {/* segments */}
                {segments.map((seg: any, i: number) => {
                  const nextSeg = segments[i + 1]
                  const layover = nextSeg
                    ? durationToMinutes(
                        `PT${Math.floor((new Date(nextSeg.departure.at).getTime() - new Date(seg.arrival.at).getTime()) / 60000 / 60)}H${Math.round(((new Date(nextSeg.departure.at).getTime() - new Date(seg.arrival.at).getTime()) / 60000) % 60)}M`,
                      )
                    : 0
                  const layoverStr = nextSeg
                    ? formatDuration(
                        `PT${Math.floor((new Date(nextSeg.departure.at).getTime() - new Date(seg.arrival.at).getTime()) / 60000 / 60)}H${Math.round(((new Date(nextSeg.departure.at).getTime() - new Date(seg.arrival.at).getTime()) / 60000) % 60)}M`,
                      )
                    : ""
                  return (
                    <div key={i}>
                      <div className="flex items-center gap-3 mb-3">
                        <div className="w-10 h-10 rounded-lg bg-slate-50 border border-slate-100 flex items-center justify-center overflow-hidden">
                          <img
                            src={seg.logo || getAirlineLogo(seg.carrierCode)}
                            alt={seg.carrierName}
                            className="w-7 h-7 object-contain"
                            onError={(e) => ((e.target as HTMLImageElement).src = "/abstract-airline-logo.png")}
                          />
                        </div>
                        <div>
                          <p className="font-bold text-slate-800 text-sm">{getAirlineName(seg.carrierCode, language)}</p>
                          <p className="text-xs text-slate-400">
                            {seg.flightNumber || seg.carrierCode}{seg.aircraft ? ` · ${seg.aircraft}` : ""}{seg.cabin ? ` · ${seg.cabin}` : ""}
                          </p>
                        </div>
                      </div>
                      <div className="flex gap-4 pr-2 border-r-2 border-dashed border-slate-200">
                        <div className="flex-1 pb-4 relative">
                          <span className="absolute -right-[9px] top-1 w-3.5 h-3.5 rounded-full bg-[#1e3a5f]" />
                          <p className="text-sm font-bold text-slate-800 pr-4">
                            {fmtTime(seg.departure.at)} · {seg.departure.iataCode}
                          </p>
                          <p className="text-xs text-slate-400 pr-4">{fmtDate(seg.departure.at)}</p>
                        </div>
                      </div>
                      <div className="flex gap-4 pr-2 border-r-2 border-dashed border-slate-200">
                        <div className="flex-1 pb-2 relative">
                          <span className="absolute -right-[9px] top-1 w-3.5 h-3.5 rounded-full bg-[#ff8c42]" />
                          <p className="text-sm font-bold text-slate-800 pr-4">
                            {fmtTime(seg.arrival.at)} · {seg.arrival.iataCode}
                          </p>
                          <p className="text-xs text-slate-400 pr-4">{fmtDate(seg.arrival.at)}</p>
                        </div>
                      </div>
                      {nextSeg && (
                        <div className="my-3 text-center text-xs font-medium text-amber-600 bg-amber-50 rounded-lg py-2">
                          توقّف في {seg.arrival.iataCode} · {layoverStr}
                        </div>
                      )}
                    </div>
                  )
                })}

                {/* fare details */}
                <div className="grid grid-cols-2 gap-3 pt-4 border-t border-slate-100">
                  {[
                    { icon: Luggage, label: "الأمتعة المسجّلة", value: flight.baggage?.checked > 0 ? `${flight.baggage.checked} حقيبة` : "غير مشمولة" },
                    { icon: Briefcase, label: "حقيبة اليد", value: flight.baggage?.carryOn > 0 ? `${flight.baggage.carryOn} حقيبة` : "غير مشمولة" },
                    { icon: RefreshCw, label: "الاسترجاع", value: flight.refundable ? "مسموح" : "غير مسموح" },
                    { icon: RotateCcw, label: "تعديل الحجز", value: flight.changeable ? "مسموح" : "غير مسموح" },
                    { icon: Plane, label: "درجة المقصورة", value: flight.cabinClass },
                    ...(flight.emissionsKg ? [{ icon: Leaf, label: "انبعاثات الكربون", value: `${flight.emissionsKg} كجم` }] : []),
                  ].map((d, i) => (
                    <div key={i} className="flex items-center gap-2.5 bg-slate-50 rounded-xl p-3">
                      <d.icon className="w-4 h-4 text-[#ff8c42] shrink-0" />
                      <div className="min-w-0">
                        <p className="text-[11px] text-slate-400 leading-tight">{d.label}</p>
                        <p className="text-sm font-semibold text-slate-700 truncate">{d.value}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* footer */}
              <div className="sticky bottom-0 bg-white border-t border-slate-100 p-4 flex items-center justify-between gap-4">
                <div>
                  <p className="text-xs text-slate-400">السعر الإجمالي</p>
                  <p className="text-2xl font-extrabold text-[#ff8c42] leading-none">{prices.sdg} <span className="text-sm">ج.س</span></p>
                </div>
                <Button
                  className="bg-[#25D366] hover:bg-[#20BA5A] text-white flex items-center gap-2 rounded-xl h-11 px-6 font-bold"
                  onClick={() =>
                    bookViaWhatsApp({
                      origin: first.departure.iataCode,
                      destination: last.arrival.iataCode,
                      date: new Date(first.departure.at).toLocaleDateString(language === "ar" ? "ar-SA" : "en-US"),
                      price: prices.sdg,
                    })
                  }
                >
                  <MessageCircle className="w-5 h-5" /> احجز عبر واتساب
                </Button>
              </div>
            </div>
          </div>
        )
      })()}

      {/* ─── Popular destinations ─── */}
      <section id="hotels" className="container mx-auto px-4 py-16">
        <div className="text-center mb-10">
          <h3 className="text-3xl font-bold text-[#1e3a5f]">وجهات ننصح بها</h3>
          <p className="text-slate-500 mt-2">أفضل الفنادق في أشهر المدن حول العالم</p>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-5">
          {topHotels.map((hotel, index) => (
            <Card key={index} className="border-0 rounded-2xl shadow-card hover:shadow-card-hover transition overflow-hidden group cursor-pointer">
              <div className="relative h-52 overflow-hidden">
                <img
                  src={hotel.image || "/placeholder.svg"}
                  alt={hotel.hotel}
                  className="w-full h-full object-cover group-hover:scale-110 transition duration-500"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/10 to-transparent" />
                <div className="absolute bottom-3 right-3 left-3 text-white">
                  <h4 className="text-xl font-bold">{hotel.city}</h4>
                  <p className="text-sm text-white/80 line-clamp-1">{hotel.hotel}</p>
                </div>
                <div className="absolute top-3 left-3 bg-[#ff8c42] text-white text-xs font-bold px-2.5 py-1 rounded-full">
                  {hotel.price}
                </div>
              </div>
            </Card>
          ))}
        </div>
      </section>

      {/* ─── Services ─── */}
      <section id="services" className="bg-white py-16 border-y border-slate-100">
        <div className="container mx-auto px-4">
          <div className="text-center mb-10">
            <h3 className="text-3xl font-bold text-[#1e3a5f]">خدماتنا المتميزة</h3>
            <p className="text-slate-500 mt-2">كل ما تحتاجه لرحلة مثالية في مكان واحد</p>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {services.map((s, i) => (
              <Card key={i} className="border border-slate-100 rounded-2xl shadow-card hover:shadow-card-hover transition group">
                <CardContent className="p-8 text-center space-y-4">
                  <div className="w-16 h-16 rounded-2xl bg-[#ff8c42]/10 flex items-center justify-center mx-auto group-hover:bg-[#ff8c42] transition-colors">
                    <s.icon className="w-8 h-8 text-[#ff8c42] group-hover:text-white transition-colors" />
                  </div>
                  <h4 className="text-xl font-bold text-[#1e3a5f]">{s.title}</h4>
                  <p className="text-slate-500 leading-relaxed text-sm">{s.desc}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* ─── CTA banner ─── */}
      <section className="container mx-auto px-4 py-14">
        <div className="bg-brand-gradient rounded-3xl px-6 py-12 md:px-14 text-center text-white shadow-float relative overflow-hidden">
          <div className="absolute -top-10 -left-10 w-40 h-40 rounded-full bg-[#ff8c42]/20 blur-3xl" />
          <h3 className="text-2xl md:text-3xl font-bold mb-3 relative">جاهز لرحلتك القادمة؟</h3>
          <p className="text-white/75 mb-6 relative max-w-lg mx-auto">فريقنا متاح على مدار الساعة لمساعدتك في حجز أفضل العروض عبر واتساب.</p>
          <a
            href={`https://wa.me/${WHATSAPP_NUMBER}`}
            target="_blank"
            rel="noopener noreferrer"
            className="relative inline-flex items-center gap-2 bg-[#25D366] hover:bg-[#20BA5A] text-white font-bold px-8 py-3 rounded-full transition shadow-lg shadow-green-500/25"
          >
            <MessageCircle className="w-5 h-5" /> تواصل معنا الآن
          </a>
        </div>
      </section>

      {/* ─── Contact ─── */}
      <section id="contact" className="bg-brand-gradient text-white py-16">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold">تواصل معنا مباشرة</h2>
            <p className="text-white/70 mt-2">نحن هنا لخدمتك في أي وقت</p>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 max-w-6xl mx-auto">
            {[
              { icon: Phone, title: "اتصل بنا", value: "+249 114 610 204", href: `tel:+${PHONE_NUMBER}`, color: "text-[#ff8c42]" },
              { icon: MessageCircle, title: "واتساب", value: "+249 960 278 594", href: `https://wa.me/${WHATSAPP_NUMBER}`, color: "text-[#25D366]" },
              { icon: Mail, title: "البريد الإلكتروني", value: "hsn46475@gmail.com", href: "mailto:hsn46475@gmail.com", color: "text-[#ff8c42]" },
              { icon: MapPin, title: "الموقع", value: "الخرطوم، السودان", href: null, color: "text-[#ff8c42]" },
            ].map((c, i) => (
              <div key={i} className="glass rounded-2xl p-6 text-center space-y-3 hover:bg-white/15 transition">
                <c.icon className={`w-11 h-11 mx-auto ${c.color}`} />
                <h3 className="text-base font-bold">{c.title}</h3>
                {c.href ? (
                  <a href={c.href} target="_blank" rel="noopener noreferrer" className="block text-sm hover:text-[#ff8c42] transition break-all" dir="ltr">
                    {c.value}
                  </a>
                ) : (
                  <p className="text-sm text-white/85">{c.value}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Footer ─── */}
      <footer className="bg-[#0e2038] text-white py-12">
        <div className="container mx-auto px-4">
          <div className="grid md:grid-cols-4 gap-8 mb-8">
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-[#ff8c42] flex items-center justify-center">
                  <Plane className="w-4 h-4 text-white -rotate-45" />
                </div>
                <h4 className="text-xl font-bold"><span className="text-white">Travel</span><span className="text-[#ff8c42]">Hub</span></h4>
              </div>
              <p className="text-white/60 text-sm leading-relaxed">
                وجهتك الموثوقة لاستكشاف العالم. أفضل أسعار الطيران والفنادق وخدمات التأشيرات.
              </p>
            </div>
            <div className="space-y-3">
              <h5 className="font-bold mb-3">خدماتنا</h5>
              <ul className="space-y-2 text-sm text-white/60">
                {["حجز الطيران", "حجز الفنادق", "استخراج التأشيرات", "برامج سياحية"].map((s) => (
                  <li key={s} className="flex items-center gap-1.5 hover:text-[#ff8c42] transition cursor-pointer">
                    <ChevronLeft className="w-3 h-3 text-[#ff8c42]" /> {s}
                  </li>
                ))}
              </ul>
            </div>
            <div className="space-y-3">
              <h5 className="font-bold mb-3">معلومات التواصل</h5>
              <ul className="space-y-2 text-sm text-white/60">
                <li dir="ltr" className="text-right">هاتف: +249 114 610 204</li>
                <li dir="ltr" className="text-right">واتساب: +249 960 278 594</li>
                <li className="break-all">hsn46475@gmail.com</li>
              </ul>
            </div>
            <div className="space-y-3">
              <h5 className="font-bold mb-3">ساعات العمل</h5>
              <ul className="space-y-2 text-sm text-white/60">
                <li className="flex items-center gap-2"><Clock className="w-4 h-4 text-[#ff8c42]" /> متوفرون على مدار الأسبوع</li>
                <li>24 ساعة في اليوم</li>
                <li className="text-white/40 text-xs mt-2">الخرطوم، السودان</li>
              </ul>
            </div>
          </div>
          <div className="border-t border-white/10 pt-6 text-center">
            <p className="text-white/50 text-sm">© Travel Hub 2025. جميع الحقوق محفوظة</p>
          </div>
        </div>
      </footer>
    </div>
  )
}
