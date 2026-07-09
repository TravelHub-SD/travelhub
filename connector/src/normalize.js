// تحويل بيانات Zenith (TTI) إلى شكل الرحلة المتوافق مع موقع TravelHub
// (نفس واجهة Flight في lib/flightService.ts).
import { config } from "./config.js"

const KIWI_LOGO = (iata) =>
  iata ? `https://images.kiwi.com/airlines/128/${iata.toUpperCase()}.png` : "/abstract-airline-logo.png"

// درجة المقصورة من كود حجز TTI (Y/L/M… اقتصادية، C/J رجال أعمال، F أولى)
function cabinAr(code) {
  const c = (code || "").toUpperCase()
  if (["C", "J", "D", "I", "Z"].includes(c)) return "رجال الأعمال"
  if (["F", "A", "P"].includes(c)) return "الأولى"
  return "الاقتصادية"
}

// يحوّل السعر (بالجنيه السوداني) إلى دولار حسب SDG_PER_USD.
// ملاحظة: الموقع يعرض total×سعر الصرف كجنيه؛ فبضبط SDG_PER_USD = نفس سعر
// الموقع (3650) يظهر السعر بالجنيه مطابقاً لأصله.
function toUsd(amountSDG) {
  const n = Number(String(amountSDG).replace(/[^\d.]/g, "")) || 0
  if (config.sdgPerUsd > 0) return (n / config.sdgPerUsd).toFixed(2)
  return n.toFixed(2)
}

// دقائق بين وقتين ISO → صيغة مدة ISO8601 (PT#H#M)
function durIso(fromIso, toIso) {
  const mins = Math.max(0, Math.round((new Date(toIso) - new Date(fromIso)) / 60000))
  return `PT${Math.floor(mins / 60)}H${mins % 60}M`
}

// ─── المسار التجريبي (mock): صف بأوقات نصية ─────────────────────────────
function toIsoFromTime(dateStr, timeStr, addDay = 0) {
  const [h = "0", m = "0"] = String(timeStr || "").split(":")
  const d = new Date(`${dateStr}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + addDay)
  d.setUTCHours(Number(h), Number(m))
  return d.toISOString()
}

export function normalizeRow(row, carrier) {
  const iata = (row.airlineIata || carrier.iata || "").toUpperCase()
  const arrAddDay = row.arrTime && row.depTime && row.arrTime < row.depTime ? 1 : 0
  const depIso = toIsoFromTime(row.dateStr, row.depTime, 0)
  const arrIso = toIsoFromTime(row.dateStr, row.arrTime, arrAddDay)
  const dur = durIso(depIso, arrIso)
  return {
    id: `tti_${carrier.code}_${row.flightNo || Math.random().toString(36).slice(2)}`,
    price: { total: toUsd(row.price), currency: "USD" },
    numberOfBookableSeats: row.seats ?? null,
    airlineLogo: KIWI_LOGO(iata),
    cabinClass: row.cabin || "الاقتصادية",
    baggage: { checked: row.checkedBags ?? 0, carryOn: row.carryOnBags ?? 1 },
    refundable: Boolean(row.refundable),
    changeable: Boolean(row.changeable),
    emissionsKg: null,
    source: "tti",
    airline: carrier.name,
    itineraries: [
      {
        duration: dur,
        segments: [
          {
            departure: { iataCode: row.depCode, at: depIso },
            arrival: { iataCode: row.arrCode, at: arrIso },
            carrierCode: iata,
            carrierName: carrier.name,
            logo: KIWI_LOGO(iata),
            flightNumber: row.flightNo || null,
            aircraft: row.aircraft || null,
            cabin: row.cabin || "الاقتصادية",
            duration: dur,
          },
        ],
      },
    ],
  }
}

// ─── المسار الحقيقي: من كائن TTIModel.FlightListDisplay.ServerModel ─────────
// يبني قائمة رحلات من الـ JSON المضمّن في صفحة النتائج.
export function flightsFromServerModel(model, carrier) {
  if (!model) return []
  const airports = Object.fromEntries((model.DataReferenceAirports || []).map((a) => [a.DataId, a]))
  const fareRef = Object.fromEntries((model.DataReferenceFareBasis || []).map((f) => [f.DataId, f]))
  const bClass = Object.fromEntries((model.DataReferenceBookingClasses || []).map((b) => [b.DataId, b]))

  const out = []
  for (const summary of model.PricedTripsSummary || []) {
    for (const trip of summary.Trips || []) {
      const segs = trip.Flights || []
      if (!segs.length) continue

      let total = 0
      let ok = true
      let bagKg = 0
      let refundable = false
      let seats = null
      let cabinCode = ""

      const segments = segs.map((seg) => {
        const fares = seg.PassengerTypes?.[0]?.FareBasisList || []
        const cheapest = fares.reduce(
          (min, f) => (!min || f.Amount.TotalAmount < min.Amount.TotalAmount ? f : min),
          null,
        )
        if (!cheapest) {
          ok = false
        } else {
          total += cheapest.Amount.TotalAmount
          bagKg = Math.max(bagKg, cheapest.BagAllowance?.CheckedAllowance?.BagWeight || 0)
          const fb = fareRef[cheapest.DataIdFareBasis]
          if (fb) refundable = refundable || fb.Refundable >= 2
          seats = cheapest.FreeSeatCount ?? seats
          cabinCode = bClass[cheapest.DataIdBookingClass]?.Code || cabinCode
        }

        const depAt = seg.DepartureDate?.DateTime
        const arrAt = seg.ArrivalDate?.DateTime
        const depGmt = seg.DepartureDate?.DateTimeGMT || depAt
        const arrGmt = seg.ArrivalDate?.DateTimeGMT || arrAt
        const airlineIata = seg.FlightDesignator?.AirlineDesignator || carrier.iata
        return {
          departure: { iataCode: airports[seg.DataIdOrigin]?.Code || "", at: depAt },
          arrival: { iataCode: airports[seg.DataIdDestination]?.Code || "", at: arrAt },
          carrierCode: airlineIata,
          carrierName: carrier.name,
          logo: KIWI_LOGO(airlineIata),
          flightNumber: `${airlineIata} ${seg.FlightDesignator?.FlightNumber || ""}`.trim(),
          aircraft: seg.Equipment?.Code || null,
          cabin: null, // يُملأ بعد معرفة cabinCode
          duration: durIso(depGmt, arrGmt),
        }
      })

      if (!ok) continue
      const cabin = cabinAr(cabinCode)
      segments.forEach((s) => (s.cabin = cabin))

      const first = segments[0]
      const last = segments[segments.length - 1]
      out.push({
        id: `tti_${carrier.code}_${first.flightNumber}_${first.departure.at}`,
        price: { total: toUsd(total), currency: "USD" },
        numberOfBookableSeats: seats,
        airlineLogo: KIWI_LOGO(first.carrierCode),
        cabinClass: cabin,
        baggage: { checked: bagKg > 0 ? 1 : 0, carryOn: 1, checkedKg: bagKg },
        refundable,
        changeable: false,
        emissionsKg: null,
        source: "tti",
        airline: carrier.name,
        itineraries: [
          {
            duration: durIso(
              segs[0].DepartureDate?.DateTimeGMT || first.departure.at,
              segs[segs.length - 1].ArrivalDate?.DateTimeGMT || last.arrival.at,
            ),
            segments,
          },
        ],
      })
    }
  }
  return out
}
