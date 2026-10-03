/**
 * lib/finance-format.ts
 * ─────────────────────────────────────────────────────────────
 * حساب المنصرفات وتنسيقها — مشترك بين الخادم والمتصفح.
 *
 * المبالغ numeric(14,2) وتصل أرقاماً عشرية. جمعها كأرقام عائمة يراكم
 * كسوراً لا وجود لها (0.1 + 0.2 = 0.30000000000000004)، فنجمع بالقروش
 * — أعداداً صحيحة — ونقسم على ١٠٠ عند العرض فقط.
 * ─────────────────────────────────────────────────────────────
 */

export const toCents = (amount: number) => Math.round(Number(amount) * 100)
export const fromCents = (cents: number) => cents / 100

/** 15000 → "15,000" ، 15000.5 → "15,000.50" — الكسور تظهر فقط إن وُجدت. */
export function sdg(n: number): string {
  const whole = Math.round((n || 0) * 100) % 100 === 0
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: whole ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(n || 0)
}

export interface CategoryTotal {
  name: string
  cents: number
  count: number
  share: number // من إجمالي المنصرفات، بالمئة
}

export interface MonthSummary {
  incomeCents: number // صافي أرباح الوكالة
  spentCents: number
  surplusCents: number
  // نسبة ما استُهلك من الأرباح. null حين لا أرباح موجبة يُقاس عليها —
  // «٣٠٠٪ من صفر» رقمٌ بلا معنى.
  consumedPct: number | null
  byCategory: CategoryTotal[]
}

export function summarizeMonth(
  income: number,
  expenses: { amount: number; expense_categories?: { name: string } | null }[],
): MonthSummary {
  const incomeCents = toCents(income)
  const map = new Map<string, { cents: number; count: number }>()
  let spentCents = 0
  for (const e of expenses) {
    const c = toCents(e.amount)
    spentCents += c
    const name = e.expense_categories?.name || "بلا تصنيف"
    const cur = map.get(name) || { cents: 0, count: 0 }
    cur.cents += c
    cur.count += 1
    map.set(name, cur)
  }
  const byCategory = [...map.entries()]
    .map(([name, v]) => ({ name, ...v, share: spentCents ? Math.round((v.cents / spentCents) * 100) : 0 }))
    .sort((a, b) => b.cents - a.cents)

  return {
    incomeCents,
    spentCents,
    surplusCents: incomeCents - spentCents,
    consumedPct: incomeCents > 0 ? Math.round((spentCents / incomeCents) * 100) : null,
    byCategory,
  }
}

/**
 * الشهر الجاري بتوقيت الخرطوم. الخادم يعمل بتوقيت UTC، فمن منتصف
 * الليل حتى الثانية صباحاً في أول يوم من الشهر كان سيفتح الصفحة على
 * الشهر الماضي.
 */
export function sudanMonth(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Khartoum", year: "numeric", month: "2-digit" })
    .format(new Date())
    .slice(0, 7)
}
