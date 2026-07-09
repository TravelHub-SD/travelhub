/**
 * lib/flightService.ts
 * ─────────────────────────────────────────────────────────────────
 * تكامل رسمي مع Duffel Flights API.
 *
 * يرجّع النتائج بشكل متوافق مع الواجهة (app/page.tsx) ويشمل كل
 * البيانات الغنية: لوغو الشركة، رقم الرحلة، نوع الطائرة، درجة المقصورة،
 * الحقائب، قابلية الاسترجاع/التعديل، وانبعاثات الكربون.
 *
 * الإعداد:
 *   1. سجّل في https://duffel.com واطلع Access Token (Test/Live).
 *   2. حطّه في .env.local :  DUFFEL_API_KEY=duffel_xxx
 *
 * بدون توكن → يرجّع بيانات تجريبية (mock) عشان تشوف الفلو شغّال فوراً.
 */

import { getAirlineName, getAirlineLogo } from "@/lib/airlines"

const DUFFEL_API_URL = "https://api.duffel.com/air/offer_requests?return_offers=true"
const DUFFEL_VERSION = "v2"

// ─── الأنواع ─────────────────────────────────────────────────────────────────

export interface FlightSegment {
  departure: { iataCode: string; at: string }
  arrival: { iataCode: string; at: string }
  carrierCode: string
  carrierName: string
  logo: string
  flightNumber: string | null
  aircraft: string | null
  cabin: string | null
  duration: string | null
}

export interface FlightItinerary {
  duration: string
  segments: FlightSegment[]
}

export interface Flight {
  id: string
  price: { total: string; currency: string }
  numberOfBookableSeats: number | null
  airlineLogo: string
  cabinClass: string
  baggage: { checked: number; carryOn: number }
  refundable: boolean
  changeable: boolean
  emissionsKg: number | null
  itineraries: FlightItinerary[]
}

export interface SearchParams {
  origin: string
  destination: string
  departureDate: string
  adults?: number
}

export interface FlightSearchResponse {
  data: Flight[]
  meta: { source: string; currency: string; warnings?: string[] }
}

// ─── مساعدات التحويل ─────────────────────────────────────────────────────────

const CABIN_AR: Record<string, string> = {
  economy: "الاقتصادية",
  premium_economy: "الاقتصادية المميزة",
  business: "رجال الأعمال",
  first: "الأولى",
}

function extractBaggage(offer: any): { checked: number; carryOn: number } {
  const pax = offer?.slices?.[0]?.segments?.[0]?.passengers?.[0]
  const bags: any[] = pax?.baggages ?? []
  const sum = (type: string) =>
    bags.filter((b) => b.type === type).reduce((s, b) => s + (b.quantity || 0), 0)
  return { checked: sum("checked"), carryOn: sum("carry_on") }
}

function mapDuffelOffer(offer: any): Flight {
  const cabinRaw = offer?.slices?.[0]?.segments?.[0]?.passengers?.[0]?.cabin_class as string | undefined
  const cabinMarketing = offer?.slices?.[0]?.segments?.[0]?.passengers?.[0]?.cabin_class_marketing_name as string | undefined

  const itineraries: FlightItinerary[] = (offer.slices ?? []).map((slice: any) => ({
    duration: slice.duration ?? "",
    segments: (slice.segments ?? []).map((seg: any) => {
      const mc = seg.marketing_carrier ?? {}
      const code = mc.iata_code ?? offer.owner?.iata_code ?? ""
      return {
        departure: { iataCode: seg.origin?.iata_code ?? "", at: seg.departing_at ?? "" },
        arrival: { iataCode: seg.destination?.iata_code ?? "", at: seg.arriving_at ?? "" },
        carrierCode: code,
        carrierName: mc.name ?? offer.owner?.name ?? getAirlineName(code),
        logo: mc.logo_symbol_url ?? getAirlineLogo(code),
        flightNumber: seg.marketing_carrier_flight_number ? `${code}${seg.marketing_carrier_flight_number}` : null,
        aircraft: seg.aircraft?.name ?? null,
        cabin: seg.passengers?.[0]?.cabin_class ? CABIN_AR[seg.passengers[0].cabin_class] ?? null : null,
        duration: seg.duration ?? null,
      }
    }),
  }))

  return {
    id: offer.id,
    price: { total: offer.total_amount, currency: offer.total_currency },
    numberOfBookableSeats: null,
    airlineLogo: offer.owner?.logo_symbol_url ?? getAirlineLogo(offer.owner?.iata_code),
    cabinClass: cabinMarketing ?? (cabinRaw ? CABIN_AR[cabinRaw] ?? cabinRaw : "الاقتصادية"),
    baggage: extractBaggage(offer),
    refundable: Boolean(offer.conditions?.refund_before_departure?.allowed),
    changeable: Boolean(offer.conditions?.change_before_departure?.allowed),
    emissionsKg: offer.total_emissions_kg ? Number(offer.total_emissions_kg) : null,
    itineraries,
  }
}

// ─── بيانات تجريبية غنية ─────────────────────────────────────────────────────

function seg(
  code: string,
  from: string,
  to: string,
  at: string,
  arr: string,
  aircraft: string,
  duration: string,
): FlightSegment {
  return {
    departure: { iataCode: from, at },
    arrival: { iataCode: to, at: arr },
    carrierCode: code,
    carrierName: getAirlineName(code),
    logo: getAirlineLogo(code),
    flightNumber: `${code}${100 + Math.floor(Math.random() * 800)}`,
    aircraft,
    cabin: "الاقتصادية",
    duration,
  }
}

function mockFlights({ origin, destination, departureDate }: Required<SearchParams>): FlightSearchResponse {
  const base = departureDate ? new Date(`${departureDate}T00:00:00Z`) : new Date()
  const at = (h: number, m = 0, dayPlus = 0) => {
    const d = new Date(base)
    d.setUTCDate(d.getUTCDate() + dayPlus)
    d.setUTCHours(h, m)
    return d.toISOString()
  }

  const data: Flight[] = [
    {
      id: "mock_1",
      price: { total: "312.40", currency: "USD" },
      numberOfBookableSeats: 6,
      airlineLogo: getAirlineLogo("EK"),
      cabinClass: "الاقتصادية",
      baggage: { checked: 2, carryOn: 1 },
      refundable: true,
      changeable: true,
      emissionsKg: 410,
      itineraries: [
        { duration: "PT7H15M", segments: [seg("EK", origin, destination, at(9, 30), at(16, 45), "Boeing 777-300ER", "PT7H15M")] },
      ],
    },
    {
      id: "mock_2",
      price: { total: "268.90", currency: "USD" },
      numberOfBookableSeats: 3,
      airlineLogo: getAirlineLogo("TK"),
      cabinClass: "الاقتصادية",
      baggage: { checked: 1, carryOn: 1 },
      refundable: false,
      changeable: true,
      emissionsKg: 520,
      itineraries: [
        {
          duration: "PT9H40M",
          segments: [
            seg("TK", origin, "IST", at(2, 10), at(6, 0), "Airbus A321neo", "PT3H50M"),
            seg("TK", "IST", destination, at(8, 20), at(11, 50), "Boeing 737-800", "PT3H30M"),
          ],
        },
      ],
    },
    {
      id: "mock_3",
      price: { total: "401.00", currency: "USD" },
      numberOfBookableSeats: 9,
      airlineLogo: getAirlineLogo("QR"),
      cabinClass: "الاقتصادية المميزة",
      baggage: { checked: 2, carryOn: 1 },
      refundable: true,
      changeable: false,
      emissionsKg: 380,
      itineraries: [
        { duration: "PT6H55M", segments: [seg("QR", origin, destination, at(14, 0), at(20, 55), "Airbus A350-900", "PT6H55M")] },
      ],
    },
    {
      id: "mock_4",
      price: { total: "233.50", currency: "USD" },
      numberOfBookableSeats: 4,
      airlineLogo: getAirlineLogo("MS"),
      cabinClass: "الاقتصادية",
      baggage: { checked: 1, carryOn: 1 },
      refundable: false,
      changeable: false,
      emissionsKg: 610,
      itineraries: [
        {
          duration: "PT12H30M",
          segments: [
            seg("MS", origin, "CAI", at(1, 30), at(4, 30), "Boeing 737-800", "PT3H0M"),
            seg("MS", "CAI", destination, at(9, 0), at(18, 0, 0), "Airbus A320", "PT6H0M"),
          ],
        },
      ],
    },
  ]

  return { data, meta: { source: "mock", currency: "USD" } }
}

// ─── Duffel ──────────────────────────────────────────────────────────────────

async function fetchDuffelFlights(p: Required<SearchParams>): Promise<Flight[]> {
  const token = process.env.DUFFEL_API_KEY
  if (!token) return []

  const passengers = Array.from({ length: p.adults }, () => ({ type: "adult" }))

  const response = await fetch(DUFFEL_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Duffel-Version": DUFFEL_VERSION,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      data: {
        slices: [{ origin: p.origin, destination: p.destination, departure_date: p.departureDate }],
        passengers,
        cabin_class: "economy",
      },
    }),
  })

  if (!response.ok) {
    const err = await response.json().catch(() => ({}))
    const detail = err?.errors?.[0]?.message ?? response.statusText
    throw new Error(`فشل البحث في Duffel: ${detail}`)
  }

  const json = await response.json()
  const offers: any[] = json?.data?.offers ?? []
  return offers.map(mapDuffelOffer)
}

// ─── موصّل الخطوط السودانية (بوابة TTI) ───────────────────────────────────────
// يستدعي خدمة الموصّل المستقلة (connector/) التي تكشط بوابة TTI.
// يُضبط عبر SUDAN_CONNECTOR_URL و CONNECTOR_API_KEY.

async function fetchSudanFlights(
  p: Required<SearchParams>,
): Promise<{ flights: Flight[]; warnings: string[] }> {
  const url = process.env.SUDAN_CONNECTOR_URL
  if (!url) return { flights: [], warnings: [] }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 20000)
  try {
    const res = await fetch(`${url.replace(/\/$/, "")}/search`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-connector-key": process.env.CONNECTOR_API_KEY ?? "",
      },
      body: JSON.stringify(p),
      signal: controller.signal,
    })
    if (!res.ok) return { flights: [], warnings: [`connector: HTTP ${res.status}`] }
    const json = await res.json()
    return { flights: (json?.data as Flight[]) ?? [], warnings: json?.meta?.warnings ?? [] }
  } catch (e) {
    // فشل الموصّل يجب ألا يُسقط البحث كلّه — نسجّله كتحذير فقط.
    return { flights: [], warnings: [`connector: ${e instanceof Error ? e.message : String(e)}`] }
  } finally {
    clearTimeout(timeout)
  }
}

// ─── الدالة الرئيسية ─────────────────────────────────────────────────────────

export async function searchFlights(params: SearchParams): Promise<FlightSearchResponse> {
  const origin = params.origin?.trim().toUpperCase()
  const destination = params.destination?.trim().toUpperCase()
  const departureDate = params.departureDate?.trim()
  const adults = Math.max(1, Math.min(9, Number(params.adults) || 1))

  if (!origin || !destination || !departureDate) {
    throw new Error("يرجى إدخال مطار المغادرة والوجهة وتاريخ السفر")
  }

  const p: Required<SearchParams> = { origin, destination, departureDate, adults }

  const hasDuffel = Boolean(process.env.DUFFEL_API_KEY)
  const hasConnector = Boolean(process.env.SUDAN_CONNECTOR_URL)

  // لا مزوّد مضبوط → بيانات تجريبية عشان الفلو يبقى قابلاً للعرض.
  if (!hasDuffel && !hasConnector) {
    return mockFlights({ origin, destination, departureDate, adults })
  }

  const [duffelRes, sudanRes] = await Promise.allSettled([fetchDuffelFlights(p), fetchSudanFlights(p)])

  const data: Flight[] = []
  const sources: string[] = []
  const warnings: string[] = []

  if (duffelRes.status === "fulfilled") {
    if (duffelRes.value.length) sources.push("duffel")
    data.push(...duffelRes.value)
  } else if (hasDuffel) {
    warnings.push(duffelRes.reason instanceof Error ? duffelRes.reason.message : String(duffelRes.reason))
  }

  if (sudanRes.status === "fulfilled") {
    if (sudanRes.value.flights.length) sources.push("tti")
    data.push(...sudanRes.value.flights)
    warnings.push(...sudanRes.value.warnings)
  }

  // كل المزوّدات فشلت ولا نتائج → اعرض الخطأ لو Duffel هو الوحيد المضبوط.
  if (data.length === 0 && hasDuffel && !hasConnector && duffelRes.status === "rejected") {
    throw duffelRes.reason
  }

  data.sort((a, b) => Number.parseFloat(a.price.total) - Number.parseFloat(b.price.total))
  const trimmed = data.slice(0, 30)

  const currency = trimmed[0]?.price.currency ?? "USD"
  return {
    data: trimmed,
    meta: { source: sources.join("+") || "mock", currency, ...(warnings.length ? { warnings } : {}) },
  }
}
