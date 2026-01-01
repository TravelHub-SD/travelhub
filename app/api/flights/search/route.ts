import { type NextRequest, NextResponse } from "next/server"

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
  try {
    const body = await request.json()
    const { origin, destination, departureDate, adults = 1 } = body

    if (!origin || !destination || !departureDate) {
      return NextResponse.json({ error: "يرجى إدخال جميع الحقول المطلوبة" }, { status: 400 })
    }

    console.log("[v0] Searching flights:", { origin, destination, departureDate, adults })

    const token = await getAmadeusToken()

    const url = `https://test.api.amadeus.com/v2/shopping/flight-offers?originLocationCode=${origin}&destinationLocationCode=${destination}&departureDate=${departureDate}&adults=${adults}&currencyCode=USD&max=10`

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })

    if (!response.ok) {
      console.error("[v0] API Error:", response.status, response.statusText)
      const errorData = await response.json()
      console.error("[v0] Error details:", errorData)
      throw new Error("فشل البحث عن الرحلات")
    }

    const data = await response.json()
    console.log("[v0] Flights found:", data.data?.length || 0)

    return NextResponse.json(data)
  } catch (error) {
    console.error("[v0] Error searching flights:", error)
    return NextResponse.json({ error: "حدث خطأ أثناء البحث عن الرحلات" }, { status: 500 })
  }
}
