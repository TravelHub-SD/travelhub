import { type NextRequest, NextResponse } from "next/server"
import { searchFlights } from "@/lib/flightService"
import { rateLimit, clientIp, tooMany } from "@/lib/rate-limit"

// استغلال أقصى نافذة تنفيذ في خطة Vercel المجانية (٦٠ث) — البحث الحي مكلف.
export const maxDuration = 60

const IATA = /^[A-Z]{3}$/
const DATE = /^\d{4}-\d{2}-\d{2}$/

function validDate(s: string): boolean {
  if (!DATE.test(s)) return false
  const d = new Date(`${s}T00:00:00Z`)
  if (Number.isNaN(d.getTime())) return false
  const today = new Date()
  today.setUTCHours(0, 0, 0, 0)
  const max = new Date(today)
  max.setUTCFullYear(max.getUTCFullYear() + 1)
  return d >= today && d <= max
}

export async function POST(request: NextRequest) {
  // حد المعدّل: 10 عمليات بحث بالدقيقة لكل عنوان (البحث الحقيقي مكلف)
  if (!rateLimit(`fs:${clientIp(request.headers)}`, 10, 60_000)) {
    return NextResponse.json(tooMany, { status: 429 })
  }

  try {
    const body = await request.json().catch(() => null)
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "طلب غير صالح" }, { status: 400 })
    }

    const origin = String(body.origin || "").trim().toUpperCase()
    const destination = String(body.destination || "").trim().toUpperCase()
    const departureDate = String(body.departureDate || "").trim()
    const tripType = String(body.tripType || "one-way")
    const returnDateRaw = String(body.returnDate || "").trim()
    // العودة تُعتبر فقط عند اختيار "ذهاب وعودة" وبتاريخ سليم بعد المغادرة
    const returnDate =
      tripType === "round-trip" && returnDateRaw && validDate(returnDateRaw) && returnDateRaw >= departureDate
        ? returnDateRaw
        : ""
    const adults = Math.max(1, Math.min(9, Number(body.adults) || 1))
    const children = Math.max(0, Math.min(8, Number(body.children) || 0))
    const infants = Math.max(0, Math.min(adults, Number(body.infants) || 0))

    if (!IATA.test(origin) || !IATA.test(destination) || origin === destination || !validDate(departureDate)) {
      return NextResponse.json({ error: "يرجى إدخال بيانات بحث صحيحة" }, { status: 400 })
    }
    if (tripType === "round-trip" && returnDateRaw && !returnDate) {
      return NextResponse.json({ error: "تاريخ العودة يجب أن يكون بعد تاريخ المغادرة" }, { status: 400 })
    }

    const result = await searchFlights({ origin, destination, departureDate, returnDate, adults, children, infants })
    return NextResponse.json(result)
  } catch (error) {
    // لا نسرّب تفاصيل داخلية للعميل — التفاصيل في سجلات الخادم فقط
    console.error("[travelhub] flight search error:", error)
    return NextResponse.json({ error: "حدث خطأ أثناء البحث عن الرحلات" }, { status: 500 })
  }
}
