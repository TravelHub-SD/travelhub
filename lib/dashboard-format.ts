/**
 * lib/dashboard-format.ts
 * ─────────────────────────────────────────────────────────────
 * تنسيق مشترك بين الخادم والمتصفح — بلا أي استيراد من node.
 */

/** ١٣٥٠٠٠٠ → "1,350,000" — أرقام لاتينية بفواصل آلاف، بلا كسور. */
export function money(n: number): string {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(Math.round(n || 0))
}

/** "2026-09-18" → "18 سبتمبر 2026" */
export function longDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00`)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString("ar-EG-u-nu-latn", { day: "numeric", month: "long", year: "numeric" })
}

/** "2026-09" → "سبتمبر 2026" */
export function monthLabel(ym: string): string {
  const d = new Date(`${ym}-01T00:00:00`)
  if (Number.isNaN(d.getTime())) return ym
  return d.toLocaleDateString("ar-EG-u-nu-latn", { month: "long", year: "numeric" })
}

/** تاريخ اليوم بتوقيت الجهاز — لا UTC، وإلا سجّلت عملية الليل في يوم الأمس. */
export function todayISO(): string {
  const d = new Date()
  const p = (n: number) => String(n).padStart(2, "0")
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

export function currentMonth(): string {
  return todayISO().slice(0, 7)
}

/** أول وآخر يوم في شهر بصيغة YYYY-MM */
export function monthRange(ym: string): { from: string; to: string; days: number } {
  const [y, m] = ym.split("-").map(Number)
  const days = new Date(y, m, 0).getDate()
  return { from: `${ym}-01`, to: `${ym}-${String(days).padStart(2, "0")}`, days }
}

/** قائمة الأشهر للفلتر: هذا الشهر و١١ قبله. */
export function recentMonths(count = 12): string[] {
  const out: string[] = []
  const d = new Date()
  d.setDate(1)
  for (let i = 0; i < count; i++) {
    out.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`)
    d.setMonth(d.getMonth() - 1)
  }
  return out
}

export const SOURCE_LABEL: Record<string, string> = {
  وكيل: "وكيل",
  مباشر: "عميل مباشر",
}
