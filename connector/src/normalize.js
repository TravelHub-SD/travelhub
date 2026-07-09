// تحويل صف نتيجة مكشوط إلى شكل الرحلة المتوافق مع موقع TravelHub
// (نفس واجهة Flight في lib/flightService.ts).
import { config } from "./config.js"

const KIWI_LOGO = (iata) =>
  iata ? `https://images.kiwi.com/airlines/128/${iata.toUpperCase()}.png` : "/abstract-airline-logo.png"

// "08:30" + تاريخ → ISO. لو مرّ المنتصف (وصول قبل مغادرة) نضيف يوماً.
function toIso(dateStr, timeStr, addDay = 0) {
  const [h = "0", m = "0"] = String(timeStr || "").split(":")
  const d = new Date(`${dateStr}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + addDay)
  d.setUTCHours(Number(h), Number(m))
  return d.toISOString()
}

// دقائق بين وقتين → صيغة ISO8601 مدة (PT#H#M)
function durationIso(depIso, arrIso) {
  const mins = Math.max(0, Math.round((new Date(arrIso) - new Date(depIso)) / 60000))
  return `PT${Math.floor(mins / 60)}H${mins % 60}M`
}

// يحوّل السعر إلى دولار لو كانت البوابة تعرض بالجنيه (حسب SDG_PER_USD).
function toUsd(amount) {
  const n = Number(String(amount).replace(/[^\d.]/g, "")) || 0
  if (config.sdgPerUsd > 0) return (n / config.sdgPerUsd).toFixed(2)
  return n.toFixed(2)
}

/**
 * @param {object} row صف مكشوط:
 *   { airlineIata, flightNo, depCode, depTime, arrCode, arrTime, price, dateStr, aircraft?, cabin? }
 * @param {{name,iata}} carrier
 */
export function normalizeRow(row, carrier) {
  const iata = (row.airlineIata || carrier.iata || "").toUpperCase()
  const depAddDay = 0
  const arrAddDay = row.arrTime && row.depTime && row.arrTime < row.depTime ? 1 : 0
  const depIso = toIso(row.dateStr, row.depTime, depAddDay)
  const arrIso = toIso(row.dateStr, row.arrTime, arrAddDay)
  const dur = durationIso(depIso, arrIso)

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
