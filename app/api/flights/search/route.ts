import { type NextRequest, NextResponse } from "next/server"
import { searchFlights } from "@/lib/flightService"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { origin, destination, departureDate, adults = 1 } = body

    if (!origin || !destination || !departureDate) {
      return NextResponse.json({ error: "يرجى إدخال جميع الحقول المطلوبة" }, { status: 400 })
    }

    console.log("[travelhub] Searching flights:", { origin, destination, departureDate, adults })

    const result = await searchFlights({ origin, destination, departureDate, adults: Number(adults) })

    console.log("[travelhub] Flights found:", result.data.length, "source:", result.meta.source)

    return NextResponse.json(result)
  } catch (error) {
    console.error("[travelhub] Error searching flights:", error)
    const message = error instanceof Error ? error.message : "حدث خطأ أثناء البحث عن الرحلات"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
