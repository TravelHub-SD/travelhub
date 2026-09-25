/**
 * lib/dashboard-validate.ts
 * ─────────────────────────────────────────────────────────────
 * تحقّق المدخلات قبل قاعدة البيانات. القيود موجودة في السكيما أيضاً،
 * لكن رسالتها هناك تقنية — هنا نعطي المستخدم جملة يفهمها ويصلح بها.
 */

import { DIRECT_SOURCES, SERVICE_TYPES, SOURCES, type TransactionInput } from "@/lib/dashboard-store"

const SOURCE_VALUES = SOURCES.map((s) => s.value) as readonly string[]

/** عدد صحيح فقط: كل المبالغ بالجنيه بلا كسور. */
function asInt(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null
  const n = typeof v === "number" ? v : Number(String(v).replace(/[,\s]/g, ""))
  return Number.isInteger(n) ? n : null
}

export function validateTransaction(body: any): { ok: true; value: TransactionInput } | { ok: false; error: string } {
  const date = String(body?.date || "").trim()
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return { ok: false, error: "التاريخ مطلوب بصيغة YYYY-MM-DD" }

  const service_type = String(body?.service_type || "").trim()
  if (!(SERVICE_TYPES as readonly string[]).includes(service_type)) {
    return { ok: false, error: "اختر نوع الخدمة" }
  }

  const source = String(body?.source || "").trim()
  if (!SOURCE_VALUES.includes(source)) return { ok: false, error: "اختر مصدر العملية" }

  const quantity = asInt(body?.quantity ?? 1)
  if (quantity === null || quantity < 1) return { ok: false, error: "العدد يجب أن يكون رقماً صحيحاً ١ فأكثر" }

  const net_profit = asInt(body?.net_profit)
  if (net_profit === null) return { ok: false, error: "صافي ربح الوكالة مطلوب (رقم صحيح بلا كسور)" }

  // الوكيل وربحه يتبعان المصدر: مع «وكيل» كلاهما مطلوب، ومع «مباشر»
  // يُصفَّران حتى لا يتسرّب وكيل قديم من فورم لم يُنظَّف عند التبديل.
  // وقناة الاكتساب معكوسها: مطلوبة مع «مباشر»، ممنوعة مع «وكيل».
  let agent_id: number | null = null
  let agent_profit = 0
  let direct_source: string | null = null
  if (source === "وكيل") {
    agent_id = asInt(body?.agent_id)
    if (agent_id === null || agent_id < 1) return { ok: false, error: "اختر الوكيل" }
    const p = asInt(body?.agent_profit ?? 0)
    if (p === null || p < 0) return { ok: false, error: "ربح الوكيل يجب أن يكون رقماً صحيحاً غير سالب" }
    agent_profit = p
  } else {
    const ch = String(body?.direct_source || "").trim()
    if (!(DIRECT_SOURCES as readonly string[]).includes(ch)) {
      return { ok: false, error: "اختر قناة الاكتساب" }
    }
    direct_source = ch
  }

  const rawNote = body?.note
  const note = typeof rawNote === "string" && rawNote.trim() ? rawNote.trim().slice(0, 500) : null

  return {
    ok: true,
    value: { date, service_type, source, agent_id, quantity, agent_profit, net_profit, direct_source, note },
  }
}
