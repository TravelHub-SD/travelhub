import { type NextRequest, NextResponse } from "next/server"
import { fetchFlightAvailability } from "@/lib/flightService"

// قراءة تقويم التوفّر من الموصّل تدير متصفحاً على البوابة وقد تستغرق دقيقة
// في أول طلب (بعدها تأتي من الكاش) — نرفع مهلة الدالة إلى الحد الأقصى.
export const maxDuration = 60

export async function GET(request: NextRequest) {
  const origin = request.nextUrl.searchParams.get("origin") ?? ""
  const destination = request.nextUrl.searchParams.get("destination") ?? ""

  if (!origin || !destination) {
    return NextResponse.json({ error: "يرجى تحديد مطار المغادرة والوجهة" }, { status: 400 })
  }

  try {
    const result = await fetchFlightAvailability(origin, destination)
    return NextResponse.json(result)
  } catch (error) {
    console.error("[travelhub] Error fetching availability:", error)
    const message = error instanceof Error ? error.message : "تعذّر جلب أيام الرحلات"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
