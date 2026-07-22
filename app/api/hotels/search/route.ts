import { type NextRequest, NextResponse } from "next/server"
import { rateLimit, clientIp, tooMany } from "@/lib/rate-limit"

async function getAmadeusToken() {
  const response = await fetch("https://test.api.amadeus.com/v1/security/oauth2/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      client_id: process.env.AMADEUS_CLIENT_ID!,
      client_secret: process.env.AMADEUS_CLIENT_SECRET!,
    }),
  })

  if (!response.ok) {
    throw new Error("فشل في الحصول على رمز المصادقة")
  }

  const data = await response.json()
  return data.access_token
}

export async function POST(request: NextRequest) {
  // حد المعدّل: 15 بحث فنادق بالدقيقة لكل عنوان
  if (!rateLimit(`hs:${clientIp(request.headers)}`, 15, 60_000)) {
    return NextResponse.json(tooMany, { status: 429 })
  }
  try {
    const body = await request.json().catch(() => null)
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "طلب غير صالح" }, { status: 400 })
    }
    // تحقق صارم — يمنع حقن معاملات في رابط المزوّد الخارجي
    const city = String(body.city || "").trim().toUpperCase()
    const checkIn = String(body.checkIn || "").trim()
    const checkOut = String(body.checkOut || "").trim()
    const adults = Math.max(1, Math.min(9, Number(body.adults) || 1))
    const DATE = /^\d{4}-\d{2}-\d{2}$/
    if (!/^[A-Z]{3}$/.test(city) || !DATE.test(checkIn) || !DATE.test(checkOut) || checkOut <= checkIn) {
      return NextResponse.json(
        { error: "يرجى إدخال بيانات صحيحة (كود مدينة مثل JED وتواريخ سليمة)" },
        { status: 400 },
      )
    }

    const token = await getAmadeusToken()

    const qs = new URLSearchParams({
      cityCode: city,
      checkInDate: checkIn,
      checkOutDate: checkOut,
      adults: String(adults),
      currency: "USD",
      ratings: "3,4,5",
      bestRateOnly: "true",
    })
    const url = `https://test.api.amadeus.com/v3/shopping/hotel-offers?${qs}`

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })

    if (!response.ok) {
      console.error("[travelhub] API Error:", response.status, response.statusText)
      const errorData = await response.json()
      console.error("[travelhub] Error details:", errorData)
      throw new Error("فشل البحث عن الفنادق")
    }

    const data = await response.json()
    console.log("[travelhub] Hotels found:", data.data?.length || 0)

    return NextResponse.json(data)
  } catch (error) {
    console.error("[travelhub] Error searching hotels:", error)
    return NextResponse.json({ error: "حدث خطأ أثناء البحث عن الفنادق" }, { status: 500 })
  }
}
