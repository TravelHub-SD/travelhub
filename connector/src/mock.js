// بيانات تجريبية للخطوط السودانية — لتجربة الدمج قبل ضبط البوابة الحقيقية.
import { normalizeRow } from "./normalize.js"

export function mockCarrierFlights({ origin, destination, departureDate }) {
  const rows = [
    { carrier: { name: "تاركو", iata: "3T", code: "3tair" },
      row: { airlineIata: "3T", flightNo: "3T112", depCode: origin, depTime: "08:30", arrCode: destination, arrTime: "10:05", price: "185", dateStr: departureDate, aircraft: "Boeing 737-500", checkedBags: 1 } },
    { carrier: { name: "بدر", iata: "J4", code: "badr" },
      row: { airlineIata: "J4", flightNo: "J4205", depCode: origin, depTime: "13:15", arrCode: destination, arrTime: "14:55", price: "162", dateStr: departureDate, aircraft: "Airbus A320", checkedBags: 1, refundable: true } },
    { carrier: { name: "سودانير", iata: "SD", code: "sudanair" },
      row: { airlineIata: "SD", flightNo: "SD140", depCode: origin, depTime: "17:40", arrCode: destination, arrTime: "19:20", price: "150", dateStr: departureDate, aircraft: "Boeing 737-300", checkedBags: 2, changeable: true } },
  ]
  return rows.map(({ row, carrier }) => normalizeRow(row, carrier))
}
