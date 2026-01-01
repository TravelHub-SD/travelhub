"use client"

import type React from "react"
import { useRef } from "react"
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
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useState } from "react"
import { AirportSelect } from "@/components/airport-select"

const EXCHANGE_RATE = 3650 // سعر الدولار مقابل الجنيه السوداني
const PHONE_NUMBER = "249114610204" // رقم الاتصال
const WHATSAPP_NUMBER = "249960278594" // رقم الواتساب

const formatPrice = (usdPrice: string) => {
  const price = Number.parseFloat(usdPrice)
  const sdgPrice = Math.round(price * EXCHANGE_RATE)
  return {
    usd: price.toFixed(2),
    sdg: sdgPrice.toLocaleString("ar-SA"),
  }
}

const bookViaWhatsApp = (flightDetails: any) => {
  const message = `مرحباً، أريد حجز رحلة من ${flightDetails.origin} إلى ${flightDetails.destination} بتاريخ ${flightDetails.date} بسعر ${flightDetails.price} جنيه`
  const whatsappUrl = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`
  window.open(whatsappUrl, "_blank")
}

export default function Home() {
  const [activeTab, setActiveTab] = useState<"flights" | "hotels" | "activities">("flights")
  const [tripType, setTripType] = useState<"one-way" | "round-trip" | "multi-city">("round-trip")
  const [language, setLanguage] = useState<"ar" | "en">("ar")
  const [origin, setOrigin] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [searchResults, setSearchResults] = useState<any>(null)
  const resultsRef = useRef<HTMLDivElement>(null)

  const [flightForm, setFlightForm] = useState({
    origin: "",
    destination: "",
    departureDate: "",
    adults: "1",
  })

  const [hotelForm, setHotelForm] = useState({
    city: "",
    checkIn: "",
    checkOut: "",
    adults: "1",
  })

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
      setTimeout(() => {
        resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })
      }, 300)
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
      setTimeout(() => {
        resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })
      }, 300)
    } catch (error) {
      console.error("Search error:", error)
      alert("حدث خطأ أثناء البحث عن الفنادق")
    } finally {
      setIsLoading(false)
    }
  }

  const topHotels = [
    { city: "القاهرة", hotel: "Ramses Hilton", image: "/cairo-hotel.jpg" },
    { city: "دبي", hotel: "Atlantis The Royal", image: "/dubai-hotel.jpg" },
    { city: "إسطنبول", hotel: "DoubleTree by Hilton", image: "/istanbul-hotel.jpg" },
    { city: "لندن", hotel: "Royal Lancaster London", image: "/london-hotel.jpg" },
  ]

  return (
    <div className="min-h-screen bg-gray-50" dir={language === "ar" ? "rtl" : "ltr"}>
      {/* Header */}
      <header className="bg-[#1e3a5f] shadow-md">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold">
            <span className="text-white">Travel</span>
            <span className="text-[#ff8c42]">Hub</span>
          </h1>
          <div className="flex items-center gap-3">
            <Button
              size="sm"
              variant="outline"
              onClick={() => setLanguage(language === "ar" ? "en" : "ar")}
              className="bg-[#1e3a5f] text-white border-[#1e3a5f] hover:bg-[#ff8c42] hover:border-[#ff8c42] transition-all"
            >
              <Globe className="w-5 h-5 mr-1" />
              {language === "ar" ? "English" : "العربية"}
            </Button>
          </div>
        </div>
      </header>

      {/* Hero Section with Booking */}
      <section
        className="relative bg-[#1e3a5f] text-white py-20 overflow-hidden"
        style={{
          backgroundImage: "url('/airplane-flying-in-blue-sky.jpg')",
          backgroundSize: "cover",
          backgroundPosition: "center",
          backgroundBlendMode: "overlay",
        }}
      >
        <div className="absolute inset-0 bg-[#1e3a5f]/85"></div>
        <div className="container mx-auto px-4 relative z-10">
          <div className="max-w-4xl mx-auto space-y-8">
            <div className="text-center space-y-4">
              <h2 className="text-4xl md:text-5xl font-bold text-balance">احجز رحلتك القادمة!</h2>
              <p className="text-lg text-white/90 text-balance">اختر من بين أكثر من 1.5 مليون فندق و 450+ شركة طيران</p>
            </div>

            <Card className="border-0 shadow-2xl">
              <CardContent className="p-6">
                <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                  <TabsList className="grid w-full grid-cols-3 mb-6 bg-gray-100">
                    <TabsTrigger
                      value="flights"
                      className="data-[state=active]:bg-[#ff8c42] data-[state=active]:text-white"
                    >
                      <Plane className="w-4 h-4 ml-2" />
                      رحلات طيران
                    </TabsTrigger>
                    <TabsTrigger
                      value="hotels"
                      className="data-[state=active]:bg-[#ff8c42] data-[state=active]:text-white"
                    >
                      <Hotel className="w-4 h-4 ml-2" />
                      فنادق
                    </TabsTrigger>
                    <TabsTrigger
                      value="activities"
                      className="data-[state=active]:bg-[#ff8c42] data-[state=active]:text-white"
                    >
                      <MapPin className="w-4 h-4 ml-2" />
                      أنشطة
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="flights" className="space-y-4">
                    <form onSubmit={handleFlightSearch}>
                      <div className="flex flex-wrap gap-2 mb-4">
                        <Button
                          variant="outline"
                          size="sm"
                          className="border-[#ff8c42] text-[#ff8c42] hover:bg-[#ff8c42] hover:text-white bg-transparent"
                        >
                          ذهاب فقط
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="border-gray-300 hover:border-[#ff8c42] hover:text-[#ff8c42] bg-transparent"
                        >
                          ذهاب وعودة
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="border-gray-300 hover:border-[#ff8c42] hover:text-[#ff8c42] bg-transparent"
                        >
                          متعدد المدن
                        </Button>
                      </div>

                      <div className="grid md:grid-cols-3 gap-4">
                        <AirportSelect
                          value={flightForm.origin}
                          onChange={(code) => setFlightForm({ ...flightForm, origin: code })}
                          placeholder="ابحث عن المطار (مثال: الرياض، جدة)"
                          label="من (المغادرة)"
                        />
                        <AirportSelect
                          value={flightForm.destination}
                          onChange={(code) => setFlightForm({ ...flightForm, destination: code })}
                          placeholder="ابحث عن المطار (مثال: دبي، القاهرة)"
                          label="إلى (الوجهة)"
                        />
                        <div className="space-y-2">
                          <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
                            <Calendar className="w-4 h-4" />
                            تاريخ المغادرة
                          </label>
                          <Input
                            type="date"
                            className="h-12"
                            value={flightForm.departureDate}
                            onChange={(e) => setFlightForm({ ...flightForm, departureDate: e.target.value })}
                            required
                          />
                        </div>
                      </div>
                      <div className="grid md:grid-cols-2 gap-4 mt-4">
                        <div className="space-y-2">
                          <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
                            <Users className="w-4 h-4" />
                            عدد المسافرين
                          </label>
                          <Input
                            type="number"
                            min="1"
                            placeholder="1 بالغ"
                            className="h-12"
                            value={flightForm.adults}
                            onChange={(e) => setFlightForm({ ...flightForm, adults: e.target.value })}
                          />
                        </div>
                        <div className="flex items-end">
                          <Button
                            type="submit"
                            className="w-full bg-[#ff8c42] hover:bg-[#ff7a2e] text-white h-12"
                            disabled={isLoading}
                          >
                            {isLoading ? (
                              "جاري البحث..."
                            ) : (
                              <>
                                <Search className="ml-2" />
                                بحث عن رحلات
                              </>
                            )}
                          </Button>
                        </div>
                      </div>
                    </form>
                  </TabsContent>

                  <TabsContent value="hotels" className="space-y-4">
                    <form onSubmit={handleHotelSearch}>
                      <div className="grid md:grid-cols-3 gap-4">
                        <div className="space-y-2">
                          <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
                            <MapPin className="w-4 h-4" />
                            المدينة أو الفندق
                          </label>
                          <Input
                            placeholder="مثال: Dubai أو London"
                            className="h-12"
                            value={hotelForm.city}
                            onChange={(e) => setHotelForm({ ...hotelForm, city: e.target.value })}
                            required
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
                            <Calendar className="w-4 h-4" />
                            تاريخ الوصول
                          </label>
                          <Input
                            type="date"
                            className="h-12"
                            value={hotelForm.checkIn}
                            onChange={(e) => setHotelForm({ ...hotelForm, checkIn: e.target.value })}
                            required
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
                            <Calendar className="w-4 h-4" />
                            تاريخ المغادرة
                          </label>
                          <Input
                            type="date"
                            className="h-12"
                            value={hotelForm.checkOut}
                            onChange={(e) => setHotelForm({ ...hotelForm, checkOut: e.target.value })}
                            required
                          />
                        </div>
                      </div>
                      <Button
                        type="submit"
                        className="w-full bg-[#ff8c42] hover:bg-[#ff7a2e] text-white h-12 mt-4"
                        disabled={isLoading}
                      >
                        {isLoading ? (
                          "جاري البحث..."
                        ) : (
                          <>
                            <Search className="ml-2" />
                            بحث عن فنادق
                          </>
                        )}
                      </Button>
                    </form>
                  </TabsContent>

                  <TabsContent value="activities" className="space-y-4">
                    <div className="grid md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
                          <MapPin className="w-4 h-4" />
                          الوجهة
                        </label>
                        <Input placeholder="اختر المدينة" className="h-12" />
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
                          <Calendar className="w-4 h-4" />
                          التاريخ
                        </label>
                        <Input type="date" className="h-12" />
                      </div>
                    </div>
                    <Button className="w-full bg-[#ff8c42] hover:bg-[#ff7a2e] text-white h-12">
                      <Search className="ml-2" />
                      استكشف الأنشطة
                    </Button>
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Loading Indicator */}
      {isLoading && (
        <section className="container mx-auto px-4 py-12">
          <Card className="border-0 shadow-lg">
            <CardContent className="p-12 text-center">
              <div className="relative w-32 h-32 mx-auto mb-6">
                <svg
                  className="absolute inset-0 w-full h-full animate-spin-slow"
                  viewBox="0 0 100 100"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    d="M50 10 Q 70 30, 50 50 Q 30 70, 50 90 Q 70 70, 50 50 Q 30 30, 50 10"
                    stroke="#ff8c42"
                    strokeWidth="2"
                    fill="none"
                    strokeDasharray="5,5"
                    opacity="0.3"
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center animate-fly-around">
                  <Plane className="w-12 h-12 text-[#ff8c42]" />
                </div>
              </div>
              <h3 className="text-2xl font-bold text-[#1e3a5f] mb-2">جاري البحث...</h3>
              <p className="text-gray-600">نبحث عن أفضل العروض لك</p>
            </CardContent>
          </Card>
        </section>
      )}

      {/* Search Results Section */}
      {searchResults && (
        <section ref={resultsRef} className="container mx-auto px-4 py-8 scroll-mt-24">
          <Card className="border-0 shadow-lg">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-2xl font-bold text-[#1e3a5f]">
                  {activeTab === "flights" ? "نتائج البحث عن الرحلات" : "نتائج البحث عن الفنادق"}
                </h3>
                <Button
                  variant="outline"
                  onClick={() => setSearchResults(null)}
                  className="text-[#ff8c42] border-[#ff8c42]"
                >
                  بحث جديد
                </Button>
              </div>

              {activeTab === "flights" && searchResults.data && (
                <div className="space-y-4">
                  {searchResults.data.map((flight: any, index: number) => {
                    const prices = formatPrice(flight.price.total)
                    const carrierCode = flight.itineraries[0].segments[0].carrierCode
                    const carrierName = flight.itineraries[0].segments[0].carrierCode

                    return (
                      <Card key={index} className="border border-gray-200 hover:shadow-md transition">
                        <CardContent className="p-6">
                          <div className="grid md:grid-cols-4 gap-4 items-center">
                            <div className="space-y-2">
                              <div className="flex items-center gap-2 mb-2">
                                <img
                                  src={`https://images.kiwi.com/airlines/64/${carrierCode}.png`}
                                  alt={carrierName}
                                  className="w-8 h-8 object-contain"
                                  onError={(e) => {
                                    const target = e.target as HTMLImageElement
                                    target.src = "/abstract-airline-logo.png"
                                  }}
                                />
                                <span className="text-xs font-medium text-gray-600">{carrierName}</span>
                              </div>
                              <p className="text-sm text-gray-500">المغادرة</p>
                              <p className="text-2xl font-bold text-[#1e3a5f]">
                                {new Date(flight.itineraries[0].segments[0].departure.at).toLocaleTimeString(
                                  language === "ar" ? "ar-SA" : "en-US",
                                  {
                                    hour: "2-digit",
                                    minute: "2-digit",
                                  },
                                )}
                              </p>
                              <p className="text-sm font-medium">
                                {flight.itineraries[0].segments[0].departure.iataCode}
                              </p>
                            </div>

                            <div className="text-center">
                              <Plane className="w-6 h-6 mx-auto text-[#ff8c42] mb-2" />
                              <p className="text-sm text-gray-500">
                                {flight.itineraries[0].segments.length > 1
                                  ? `${flight.itineraries[0].segments.length - 1} توقف`
                                  : "مباشر"}
                              </p>
                              <p className="text-xs text-gray-400">
                                {flight.itineraries[0].duration.replace("PT", "")}
                              </p>
                            </div>

                            <div className="space-y-2">
                              <p className="text-sm text-gray-500">الوصول</p>
                              <p className="text-2xl font-bold text-[#1e3a5f]">
                                {new Date(
                                  flight.itineraries[0].segments[flight.itineraries[0].segments.length - 1].arrival.at,
                                ).toLocaleTimeString(language === "ar" ? "ar-SA" : "en-US", {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })}
                              </p>
                              <p className="text-sm font-medium">
                                {
                                  flight.itineraries[0].segments[flight.itineraries[0].segments.length - 1].arrival
                                    .iataCode
                                }
                              </p>
                            </div>

                            <div className="text-center md:text-left space-y-2">
                              <div className="space-y-1">
                                <p className="text-xl font-bold text-gray-600">${prices.usd}</p>
                                <p className="text-3xl font-bold text-[#ff8c42]">{prices.sdg} جنيه</p>
                                <p className="text-xs text-gray-500">للشخص الواحد</p>
                              </div>
                              <Button
                                className="w-full bg-[#25D366] hover:bg-[#20BA5A] text-white flex items-center justify-center gap-2"
                                onClick={() =>
                                  bookViaWhatsApp({
                                    origin: flight.itineraries[0].segments[0].departure.iataCode,
                                    destination:
                                      flight.itineraries[0].segments[flight.itineraries[0].segments.length - 1].arrival
                                        .iataCode,
                                    date: new Date(flight.itineraries[0].segments[0].departure.at).toLocaleDateString(
                                      language === "ar" ? "ar-SA" : "en-US",
                                    ),
                                    price: prices.sdg,
                                  })
                                }
                              >
                                <MessageCircle className="w-5 h-5 animate-pulse" />
                                احجز عبر واتساب
                              </Button>
                            </div>
                          </div>

                          <div className="mt-4 pt-4 border-t border-gray-200 flex items-center gap-4 text-sm text-gray-600">
                            <span>المقاعد المتاحة: {flight.numberOfBookableSeats}</span>
                          </div>
                        </CardContent>
                      </Card>
                    )
                  })}
                </div>
              )}

              {activeTab === "hotels" && searchResults.data && (
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {searchResults.data.map((hotel: any, index: number) => {
                    const hotelData = hotel.hotel
                    const offer = hotel.offers?.[0]
                    const prices = offer?.price ? formatPrice(offer.price.total) : null

                    return (
                      <Card key={index} className="border-0 shadow-lg hover:shadow-xl transition overflow-hidden group">
                        <div className="relative h-48 overflow-hidden bg-gradient-to-br from-[#1e3a5f] to-[#2c5282]">
                          <div className="absolute inset-0 flex items-center justify-center">
                            <Hotel className="w-16 h-16 text-white/30" />
                          </div>
                          {hotelData.rating && (
                            <div className="absolute top-4 right-4 bg-[#ff8c42] text-white px-3 py-1 rounded-full font-bold text-sm">
                              {hotelData.rating} ⭐
                            </div>
                          )}
                        </div>
                        <CardContent className="p-5">
                          <h4 className="text-lg font-bold text-[#1e3a5f] mb-2 line-clamp-2">{hotelData.name}</h4>
                          <div className="flex items-center gap-2 text-sm text-gray-600 mb-3">
                            <MapPin className="w-4 h-4" />
                            <span>{hotelData.cityCode}</span>
                          </div>

                          {prices && (
                            <div className="bg-gray-50 rounded-lg p-3 mb-3">
                              <div className="flex justify-between items-center">
                                <div>
                                  <p className="text-sm text-gray-600">${prices.usd}</p>
                                  <p className="text-xl font-bold text-[#ff8c42]">{prices.sdg} جنيه</p>
                                  <p className="text-xs text-gray-500">لكل ليلة</p>
                                </div>
                              </div>
                            </div>
                          )}

                          <Button
                            className="w-full bg-[#25D366] hover:bg-[#20BA5A] text-white flex items-center justify-center gap-2"
                            onClick={() =>
                              bookViaWhatsApp({
                                origin: hotelData.name,
                                destination: hotelData.cityCode,
                                date: hotelForm.checkIn,
                                price: prices?.sdg || "السعر عند التواصل",
                              })
                            }
                          >
                            <MessageCircle className="w-5 h-5 animate-pulse" />
                            احجز عبر واتساب
                          </Button>
                        </CardContent>
                      </Card>
                    )
                  })}
                </div>
              )}

              {(!searchResults.data || searchResults.data.length === 0) && (
                <div className="text-center py-12">
                  <p className="text-gray-500 text-lg">لا توجد نتائج. حاول تعديل معايير البحث.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </section>
      )}

      {/* Top Hotels Section */}
      <section id="hotels" className="container mx-auto px-4 py-16">
        <h3 className="text-3xl font-bold text-center text-[#1e3a5f] mb-4">فنادق مميزة</h3>
        <div className="w-24 h-1 bg-[#ff8c42] mx-auto mb-12"></div>

        <div className="grid md:grid-cols-4 gap-6">
          {topHotels.map((hotel, index) => (
            <Card
              key={index}
              className="border-0 shadow-lg hover:shadow-xl transition overflow-hidden group cursor-pointer"
            >
              <div className="relative h-48 overflow-hidden">
                <img
                  src={hotel.image || "/placeholder.svg"}
                  alt={hotel.hotel}
                  className="w-full h-full object-cover group-hover:scale-110 transition duration-300"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent"></div>
                <div className="absolute bottom-4 right-4 text-white">
                  <h4 className="text-xl font-bold">{hotel.city}</h4>
                </div>
              </div>
              <CardContent className="p-4">
                <p className="text-gray-700 font-medium">{hotel.hotel}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* Services Section */}
      <section id="services" className="bg-white py-16">
        <div className="container mx-auto px-4">
          <h3 className="text-3xl font-bold text-center text-[#1e3a5f] mb-4">خدماتنا المتميزة</h3>
          <div className="w-24 h-1 bg-[#ff8c42] mx-auto mb-12"></div>

          <div className="grid md:grid-cols-3 gap-8">
            <Card className="border-0 shadow-lg hover:shadow-xl transition">
              <CardContent className="p-8 text-center space-y-4">
                <div className="w-20 h-20 bg-[#ff8c42] rounded-lg flex items-center justify-center mx-auto">
                  <Plane className="w-10 h-10 text-white" />
                </div>
                <h4 className="text-2xl font-bold text-[#1e3a5f]">حجز طيران</h4>
                <p className="text-gray-600 leading-relaxed">
                  رحلات دولية ومحلية بأفضل الأسعار التنافسية مع جميع الخطوط العالمية
                </p>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-lg hover:shadow-xl transition">
              <CardContent className="p-8 text-center space-y-4">
                <div className="w-20 h-20 bg-[#ff8c42] rounded-lg flex items-center justify-center mx-auto">
                  <Hotel className="w-10 h-10 text-white" />
                </div>
                <h4 className="text-2xl font-bold text-[#1e3a5f]">فنادق ومنتجعات</h4>
                <p className="text-gray-600 leading-relaxed">
                  تأكيد فوري لحجوزات الفنادق في أكثر من 180 دولة حول العالم
                </p>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-lg hover:shadow-xl transition">
              <CardContent className="p-8 text-center space-y-4">
                <div className="w-20 h-20 bg-[#ff8c42] rounded-lg flex items-center justify-center mx-auto">
                  <FileText className="w-10 h-10 text-white" />
                </div>
                <h4 className="text-2xl font-bold text-[#1e3a5f]">استخراج التأشيرات</h4>
                <p className="text-gray-600 leading-relaxed">
                  نسهل عليك إجراءات الحصول على تأشيرات السفر والزيارة لمختلف الوجهات
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Contact Section */}
      <section className="py-20 bg-[#1e3a5f] text-white">
        <div className="container mx-auto px-4">
          <h2 className="text-4xl font-bold text-center mb-16">تواصل معنا مباشرة</h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-7xl mx-auto">
            <Card className="bg-white/10 border-0 backdrop-blur hover:bg-white/20 transition">
              <CardContent className="p-8 text-center space-y-4">
                <Phone className="w-14 h-14 mx-auto text-[#ff8c42]" />
                <h3 className="text-xl font-bold">اتصل بنا</h3>
                <a href={`tel:+${PHONE_NUMBER}`} className="block text-lg hover:text-[#ff8c42] transition" dir="ltr">
                  +249 114 610 204
                </a>
              </CardContent>
            </Card>

            <Card className="bg-white/10 border-0 backdrop-blur hover:bg-white/20 transition">
              <CardContent className="p-8 text-center space-y-4">
                <MessageCircle className="w-14 h-14 mx-auto text-[#25D366] animate-pulse" />
                <h3 className="text-xl font-bold">واتساب</h3>
                <a
                  href={`https://wa.me/${WHATSAPP_NUMBER}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block text-lg hover:text-[#25D366] transition"
                  dir="ltr"
                >
                  +249 960 278 594
                </a>
              </CardContent>
            </Card>

            <Card className="bg-white/10 border-0 backdrop-blur hover:bg-white/20 transition">
              <CardContent className="p-8 text-center space-y-4">
                <Mail className="w-14 h-14 mx-auto text-[#ff8c42]" />
                <h3 className="text-xl font-bold">البريد الإلكتروني</h3>
                <a href="mailto:hsn46475@gmail.com" className="block text-lg hover:text-[#ff8c42] transition break-all">
                  hsn46475@gmail.com
                </a>
              </CardContent>
            </Card>

            <Card className="bg-white/10 border-0 backdrop-blur hover:bg-white/20 transition">
              <CardContent className="p-8 text-center space-y-4">
                <MapPin className="w-14 h-14 mx-auto text-[#ff8c42]" />
                <h3 className="text-xl font-bold">الموقع</h3>
                <p className="text-lg">الخرطوم، السودان</p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-[#1a2f47] text-white py-12">
        <div className="container mx-auto px-4">
          <div className="grid md:grid-cols-4 gap-8 mb-8">
            <div className="space-y-4">
              <h4 className="text-xl font-bold text-[#ff8c42]">TravelHub</h4>
              <p className="text-white/80 text-sm">وجهتكم الموثوقة لاستكشاف العالم</p>
              <p className="text-white/60 text-xs">نقدم لكم أفضل أسعار حجز الطيران، الفنادق، وجميع خدمات التأشيرات</p>
            </div>

            <div className="space-y-3">
              <h5 className="font-bold text-white mb-3">خدماتنا</h5>
              <ul className="space-y-2 text-sm text-white/80">
                <li>حجز الطيران</li>
                <li>حجز الفنادق</li>
                <li>استخراج التأشيرات</li>
                <li>برامج سياحية</li>
              </ul>
            </div>

            <div className="space-y-3">
              <h5 className="font-bold text-white mb-3">معلومات التواصل</h5>
              <ul className="space-y-2 text-sm text-white/80">
                <li dir="ltr">هاتف: +249 114 610 204</li>
                <li dir="ltr">واتساب: +249 960 278 594</li>
                <li className="text-xs break-all">hsn46475@gmail.com</li>
              </ul>
            </div>

            <div className="space-y-3">
              <h5 className="font-bold text-white mb-3">ساعات العمل</h5>
              <ul className="space-y-2 text-sm text-white/80">
                <li>متوفرون على مدار الأسبوع</li>
                <li>24 ساعة في اليوم</li>
                <li className="text-xs text-white/60 mt-2">الخرطوم، السودان</li>
              </ul>
            </div>
          </div>

          <div className="border-t border-white/20 pt-6 text-center space-y-2">
            <p className="text-white/60 text-sm">© Travel Hub 2025. جميع الحقوق محفوظة</p>
          </div>
        </div>
      </footer>
    </div>
  )
}
