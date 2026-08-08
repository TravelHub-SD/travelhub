/**
 * lib/flightService.ts
 * ─────────────────────────────────────────────────────────────────
 * محرّك بحث الرحلات — سوداني بحت عبر موصّل TTI (بدر / تاركو / سودانير).
 * الأسعار بالجنيه السوداني (SDG). لا يوجد بحث دولي.
 *
 * الإعداد:
 *   SUDAN_CONNECTOR_URL = رابط خدمة الموصّل (connector/)
 *   CONNECTOR_API_KEY   = المفتاح المشترك
 *
 * بدون موصّل → بيانات تجريبية سودانية حتى يبقى الفلو قابلاً للعرض.
 */

import { getAirlineName, getAirlineLogo } from "@/lib/airlines"

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
  baggage: { checked: number; carryOn: number; checkedKg?: number }
  refundable: boolean
  changeable: boolean
  emissionsKg: number | null
  source?: string
  airline?: string
  itineraries: FlightItinerary[]
}

export interface SearchParams {
  origin: string
  destination: string
  departureDate: string
  returnDate?: string // عند وجوده: بحث ذهاب وعودة (رحلات كل اتجاه موسومة بـ leg)
  adults?: number
  children?: number
  infants?: number
}

export interface FlightSearchResponse {
  data: Flight[]
  meta: { source: string; currency: string; warnings?: string[] }
}

// ─── موصّل الخطوط السودانية (بوابة TTI) ───────────────────────────────────────

async function fetchSudanFlights(
  p: Required<SearchParams>,
): Promise<{ flights: Flight[]; warnings: string[] }> {
  const url = process.env.SUDAN_CONNECTOR_URL
  if (!url) return { flights: [], warnings: [] }

  const controller = new AbortController()
  // Vercel المجاني يقطع الدالة عند ~٦٠ث، فلا فائدة من تجاوزها. الموصّل يرجّع
  // المتوفّر ضمن مهلة لينة (~٤٨ث) ويكمل باقي الخطوط بالخلفية ويخزّنها للمرّة التالية.
  const timeout = setTimeout(() => controller.abort(), 62000)
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
    return { flights: [], warnings: [`connector: ${e instanceof Error ? e.message : String(e)}`] }
  } finally {
    clearTimeout(timeout)
  }
}

// ─── بيانات تجريبية سودانية (SDG) ─────────────────────────────────────────────

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
    flightNumber: `${code} ${100 + Math.floor(Math.random() * 800)}`,
    aircraft,
    cabin: "الاقتصادية",
    duration,
  }
}

function mockFlights({ origin, destination, departureDate }: Required<SearchParams>): FlightSearchResponse {
  const base = departureDate ? new Date(`${departureDate}T00:00:00Z`) : new Date()
  const at = (h: number, m = 0) => {
    const d = new Date(base)
    d.setUTCHours(h, m)
    return d.toISOString()
  }
  const mk = (
    id: string,
    code: string,
    total: string,
    aircraft: string,
    depH: number,
    arrH: number,
    bagKg: number,
    refundable: boolean,
  ): Flight => ({
    id,
    price: { total, currency: "SDG" },
    numberOfBookableSeats: 9,
    airlineLogo: getAirlineLogo(code),
    cabinClass: "الاقتصادية",
    baggage: { checked: bagKg > 0 ? 1 : 0, carryOn: 1, checkedKg: bagKg },
    refundable,
    changeable: false,
    emissionsKg: null,
    source: "mock",
    airline: getAirlineName(code),
    itineraries: [
      { duration: "PT1H0M", segments: [seg(code, origin, destination, at(depH), at(arrH), aircraft, "PT1H0M")] },
    ],
  })

  const data: Flight[] = [
    mk("mock_sd", "SD", "750000", "Boeing 737-300", 9, 10, 40, true),
    mk("mock_j4", "J4", "1276000", "Boeing 737-800", 13, 14, 30, true),
    mk("mock_3t", "3T", "725000", "Boeing 737-500", 16, 17, 23, false),
  ]
  return { data, meta: { source: "mock", currency: "SDG" } }
}

// ─── الدالة الرئيسية ─────────────────────────────────────────────────────────

export async function searchFlights(params: SearchParams): Promise<FlightSearchResponse> {
  const origin = params.origin?.trim().toUpperCase()
  const destination = params.destination?.trim().toUpperCase()
  const departureDate = params.departureDate?.trim()
  const returnDate = params.returnDate?.trim() || ""
  const adults = Math.max(1, Math.min(9, Number(params.adults) || 1))
  const children = Math.max(0, Math.min(8, Number(params.children) || 0))
  const infants = Math.max(0, Math.min(adults, Number(params.infants) || 0))

  if (!origin || !destination || !departureDate) {
    throw new Error("يرجى إدخال مطار المغادرة والوجهة وتاريخ السفر")
  }

  const p: Required<SearchParams> = { origin, destination, departureDate, returnDate, adults, children, infants }

  // بلا موصّل → بيانات تجريبية سودانية (مع دعم الذهاب والعودة)
  if (!process.env.SUDAN_CONNECTOR_URL) {
    const out = mockFlights(p)
    if (!returnDate) return out
    const back = mockFlights({ ...p, origin: destination, destination: origin, departureDate: returnDate })
    return {
      ...out,
      data: [
        ...out.data.map((f) => ({ ...f, leg: "ذهاب" }) as any),
        ...back.data.map((f) => ({ ...f, leg: "عودة" }) as any),
      ],
    }
  }

  const { flights, warnings } = await fetchSudanFlights(p)
  const data = [...flights].sort(
    (a, b) => Number.parseFloat(a.price.total) - Number.parseFloat(b.price.total),
  )

  return {
    data,
    meta: { source: "tti", currency: "SDG", ...(warnings.length ? { warnings } : {}) },
  }
}
