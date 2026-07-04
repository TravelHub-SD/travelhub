/**
 * lib/flightService.ts
 * ─────────────────────────────────────────────────────────────────
 * تكامل رسمي مع Duffel Flights API.
 *
 * يرجّع النتائج بنفس شكل بيانات Amadeus اللي الواجهة (app/page.tsx)
 * بتتوقّعها، عشان ما نحتاج نغيّر أي حاجة في العرض:
 *
 *   { data: [ { id, price, numberOfBookableSeats, itineraries: [
 *       { duration, segments: [ { departure, arrival, carrierCode } ] }
 *   ] } ] }
 *
 * الإعداد:
 *   1. سجّل في https://duffel.com واطلع Access Token (Test mode).
 *   2. حطّه في .env.local :  DUFFEL_API_KEY=duffel_test_xxx
 *
 * بدون توكن → يرجّع بيانات تجريبية (mock) عشان تشوف الفلو شغّال فوراً.
 */

const DUFFEL_API_URL = "https://api.duffel.com/air/offer_requests?return_offers=true"
const DUFFEL_VERSION = "v2"

// ─── الأنواع (بشكل Amadeus المتوافق مع الواجهة) ──────────────────────────────

export interface FlightSegment {
  departure: { iataCode: string; at: string }
  arrival: { iataCode: string; at: string }
  carrierCode: string
  carrierName: string
}

export interface FlightItinerary {
  duration: string
  segments: FlightSegment[]
}

export interface Flight {
  id: string
  price: { total: string; currency: string }
  numberOfBookableSeats: number | null
  itineraries: FlightItinerary[]
}

export interface SearchParams {
  origin: string // كود IATA، مثال "DXB"
  destination: string // كود IATA، مثال "LHR"
  departureDate: string // YYYY-MM-DD
  adults?: number
}

export interface FlightSearchResponse {
  data: Flight[]
  meta: { source: "duffel" | "mock"; currency: string }
}

// ─── تحويل عرض Duffel إلى شكل الواجهة ────────────────────────────────────────

function mapDuffelOffer(offer: any): Flight {
  const itineraries: FlightItinerary[] = (offer.slices ?? []).map((slice: any) => ({
    duration: slice.duration ?? "",
    segments: (slice.segments ?? []).map((seg: any) => ({
      departure: { iataCode: seg.origin?.iata_code ?? "", at: seg.departing_at ?? "" },
      arrival: { iataCode: seg.destination?.iata_code ?? "", at: seg.arriving_at ?? "" },
      carrierCode: seg.marketing_carrier?.iata_code ?? offer.owner?.iata_code ?? "",
      carrierName: seg.marketing_carrier?.name ?? offer.owner?.name ?? "طيران",
    })),
  }))

  return {
    id: offer.id,
    price: { total: offer.total_amount, currency: offer.total_currency },
    numberOfBookableSeats: null,
    itineraries,
  }
}

// ─── بيانات تجريبية (لمّا ما يكون في توكن) ───────────────────────────────────

function mockFlights({ origin, destination, departureDate }: Required<SearchParams>): FlightSearchResponse {
  const base = departureDate ? new Date(`${departureDate}T00:00:00Z`) : new Date()
  const at = (h: number, m = 0) => {
    const d = new Date(base)
    d.setUTCHours(h, m)
    return d.toISOString()
  }

  const data: Flight[] = [
    {
      id: "mock_1",
      price: { total: "312.40", currency: "USD" },
      numberOfBookableSeats: 6,
      itineraries: [
        {
          duration: "PT7H15M",
          segments: [
            {
              departure: { iataCode: origin, at: at(9, 30) },
              arrival: { iataCode: destination, at: at(16, 45) },
              carrierCode: "EK",
              carrierName: "Emirates (تجريبي)",
            },
          ],
        },
      ],
    },
    {
      id: "mock_2",
      price: { total: "268.90", currency: "USD" },
      numberOfBookableSeats: 3,
      itineraries: [
        {
          duration: "PT9H40M",
          segments: [
            {
              departure: { iataCode: origin, at: at(2, 10) },
              arrival: { iataCode: "IST", at: at(6, 0) },
              carrierCode: "TK",
              carrierName: "Turkish Airlines (تجريبي)",
            },
            {
              departure: { iataCode: "IST", at: at(8, 20) },
              arrival: { iataCode: destination, at: at(11, 50) },
              carrierCode: "TK",
              carrierName: "Turkish Airlines (تجريبي)",
            },
          ],
        },
      ],
    },
    {
      id: "mock_3",
      price: { total: "401.00", currency: "USD" },
      numberOfBookableSeats: 9,
      itineraries: [
        {
          duration: "PT6H55M",
          segments: [
            {
              departure: { iataCode: origin, at: at(14, 0) },
              arrival: { iataCode: destination, at: at(20, 55) },
              carrierCode: "QR",
              carrierName: "Qatar Airways (تجريبي)",
            },
          ],
        },
      ],
    },
  ]

  return { data, meta: { source: "mock", currency: "USD" } }
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

  const token = process.env.DUFFEL_API_KEY

  // بدون توكن → وضع تجريبي عشان تشوف الفلو شغّال فوراً
  if (!token) {
    return mockFlights({ origin, destination, departureDate, adults })
  }

  const passengers = Array.from({ length: adults }, () => ({ type: "adult" }))

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
        slices: [{ origin, destination, departure_date: departureDate }],
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

  const data = offers
    .map(mapDuffelOffer)
    .sort((a, b) => Number.parseFloat(a.price.total) - Number.parseFloat(b.price.total))
    .slice(0, 10)

  const currency = data[0]?.price.currency ?? "USD"
  return { data, meta: { source: "duffel", currency } }
}
