/**
 * lib/airlines.ts
 * جدول أسماء شركات الطيران حسب كود IATA، مع رابط اللوغو.
 * يُستخدم في كروت عرض الرحلات لإظهار اسم الشركة الحقيقي بدل الكود.
 */

export interface Airline {
  nameAr: string
  nameEn: string
}

export const AIRLINES: Record<string, Airline> = {
  // الخليج والشرق الأوسط
  EK: { nameAr: "طيران الإمارات", nameEn: "Emirates" },
  EY: { nameAr: "الاتحاد للطيران", nameEn: "Etihad Airways" },
  QR: { nameAr: "الخطوط القطرية", nameEn: "Qatar Airways" },
  SV: { nameAr: "الخطوط السعودية", nameEn: "Saudia" },
  XY: { nameAr: "طيران ناس", nameEn: "flynas" },
  F3: { nameAr: "طيران أديل", nameEn: "flyadeal" },
  GF: { nameAr: "طيران الخليج", nameEn: "Gulf Air" },
  WY: { nameAr: "الطيران العماني", nameEn: "Oman Air" },
  KU: { nameAr: "الخطوط الكويتية", nameEn: "Kuwait Airways" },
  RJ: { nameAr: "الملكية الأردنية", nameEn: "Royal Jordanian" },
  ME: { nameAr: "طيران الشرق الأوسط", nameEn: "Middle East Airlines" },
  FZ: { nameAr: "فلاي دبي", nameEn: "flydubai" },
  G9: { nameAr: "العربية للطيران", nameEn: "Air Arabia" },
  J9: { nameAr: "طيران الجزيرة", nameEn: "Jazeera Airways" },
  MS: { nameAr: "مصر للطيران", nameEn: "EgyptAir" },
  SM: { nameAr: "إير القاهرة", nameEn: "Air Cairo" },
  IA: { nameAr: "الخطوط العراقية", nameEn: "Iraqi Airways" },
  RB: { nameAr: "السورية للطيران", nameEn: "Syrian Air" },
  SD: { nameAr: "سودانير", nameEn: "Sudan Airways" },
  // تركيا وأوروبا
  TK: { nameAr: "الخطوط التركية", nameEn: "Turkish Airlines" },
  PC: { nameAr: "بيغاسوس", nameEn: "Pegasus Airlines" },
  LH: { nameAr: "لوفتهانزا", nameEn: "Lufthansa" },
  BA: { nameAr: "الخطوط البريطانية", nameEn: "British Airways" },
  AF: { nameAr: "إير فرانس", nameEn: "Air France" },
  KL: { nameAr: "كي إل إم", nameEn: "KLM" },
  AZ: { nameAr: "آيتا الإيطالية", nameEn: "ITA Airways" },
  IB: { nameAr: "إيبيريا", nameEn: "Iberia" },
  // أفريقيا وآسيا
  ET: { nameAr: "الخطوط الإثيوبية", nameEn: "Ethiopian Airlines" },
  KQ: { nameAr: "الخطوط الكينية", nameEn: "Kenya Airways" },
  QF: { nameAr: "كانتاس", nameEn: "Qantas" },
  SQ: { nameAr: "الخطوط السنغافورية", nameEn: "Singapore Airlines" },
  CX: { nameAr: "كاثي باسيفيك", nameEn: "Cathay Pacific" },
  AI: { nameAr: "الهند للطيران", nameEn: "Air India" },
  // أمريكا
  AA: { nameAr: "أمريكان إيرلاينز", nameEn: "American Airlines" },
  DL: { nameAr: "دلتا", nameEn: "Delta Air Lines" },
  UA: { nameAr: "يونايتد", nameEn: "United Airlines" },
}

/** يرجّع اسم الشركة (عربي/إنجليزي) من كود IATA، مع بديل مناسب لو الكود غير معروف. */
export function getAirlineName(code: string | undefined, lang: "ar" | "en" = "ar"): string {
  if (!code) return lang === "ar" ? "شركة طيران" : "Airline"
  const airline = AIRLINES[code.toUpperCase()]
  if (!airline) return code.toUpperCase()
  return lang === "ar" ? airline.nameAr : airline.nameEn
}

/** رابط لوغو الشركة من مصدر kiwi (يدعم أغلب أكواد IATA). */
export function getAirlineLogo(code: string | undefined): string {
  if (!code) return "/abstract-airline-logo.png"
  return `https://images.kiwi.com/airlines/128/${code.toUpperCase()}.png`
}
