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
  const resultsRef = useRef<HTMLDivElement>(null)

  const [flightForm, setFlightForm] = useState({ origin: "", destination: "", departureDate: "", adults: "1" })
  const [hotelForm, setHotelForm] = useState({ city: "", checkIn: "", checkOut: "", adults: "1" })

  const handleFlightSearch = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setSearchResults(null)
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
            const items = searchResults.data.map((flight: any, index: number) => ({
              flight,
              index,
              price: Number.parseFloat(flight.price.total),
              dur: durationToMinutes(flight.itineraries[0].duration),
              stops: flight.itineraries[0].segments.length - 1,
            }))
            const minPrice = Math.min(...items.map((x: any) => x.price))
            const minDur = Math.min(...items.map((x: any) => x.dur))
            const sorted = [...items].sort((a: any, b: any) => {
              if (sortBy === "fastest") return a.dur - b.dur
              if (sortBy === "nonstop") return a.stops - b.stops || a.price - b.price
              return a.price - b.price
            })
            const sortTabs: { key: typeof sortBy; label: string; icon: any }[] = [
              { key: "cheapest", label: "الأرخص", icon: TrendingDown },
              { key: "fastest", label: "الأسرع", icon: Zap },
              { key: "nonstop", label: "المباشرة أولاً", icon: Plane },
            ]
            const fmtTime = (t: string) =>
              new Date(t).toLocaleTimeString(language === "ar" ? "ar-SA" : "en-US", { hour: "2-digit", minute: "2-digit" })

            return (
              <div className="space-y-4">
                {/* Sort tabs */}
                <div className="inline-flex gap-1 bg-slate-100 p-1 rounded-full mb-1">
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

                {sorted.map(({ flight, index, price, dur, stops }: any) => {
                  const prices = formatPrice(flight.price.total)
                  const segments = flight.itineraries[0].segments
                  const first = segments[0]
                  const last = segments[segments.length - 1]
                  const carriers = Array.from(new Set(segments.map((s: any) => s.carrierCode))) as string[]
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
                        {/* badges strip */}
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
                          {/* Flight info */}
                          <div className="p-5 md:p-6">
                            <div className="flex items-center gap-3 mb-5">
                              <div className="flex -space-x-2 rtl:space-x-reverse shrink-0">
                                {carriers.slice(0, 2).map((c) => (
                                  <div
                                    key={c}
                                    className="w-11 h-11 rounded-xl bg-white border border-slate-100 flex items-center justify-center overflow-hidden shadow-sm"
                                  >
                                    <img
                                      src={getAirlineLogo(c) || "/placeholder.svg"}
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
                                  رحلة {carriers.join("/")} · اقتصادي
                                </p>
                              </div>
                            </div>

                            {/* Route */}
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
                            <div className="flex items-center gap-4 mt-4 pt-4 border-t border-slate-100 text-xs text-slate-500">
                              <span className="flex items-center gap-1.5">
                                <Briefcase className="w-3.5 h-3.5 text-[#ff8c42]" /> حقيبة يد مشمولة
                              </span>
                              <span className="flex items-center gap-1.5">
                                <Plane className="w-3.5 h-3.5 text-[#ff8c42]" /> {carriers.length > 1 ? "رحلة بشركات متعددة" : "رحلة مباشرة بالشركة"}
                              </span>
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
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  )
                })}
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
