/**
 * lib/dashboard-store.ts
 * ─────────────────────────────────────────────────────────────
 * قراءة وكتابة جدولَي الداشبورد في Supabase عبر PostgREST.
 * خادم فقط — يستعمل مفتاح service_role الذي لا يصل المتصفح أبداً.
 */

const URL_BASE = (process.env.SUPABASE_URL || "").replace(/\/$/, "")
const KEY = process.env.SUPABASE_SERVICE_KEY || ""

export const storeReady = Boolean(URL_BASE && KEY)

// ─── الثوابت المشتركة بين الفورم وقاعدة البيانات ─────────────────────────────
// نفس القيم مكتوبة كقيود check في السكيما، فلا تتفرّق النسختان.
export const SERVICE_TYPES = [
  "تذكرة داخلية",
  "تذكرة دولية",
  "موافقة أمنية",
  "تأشيرة عمرة",
  "زيارة عائلية",
  "أخرى",
] as const

export const SOURCES = [
  { value: "وكيل", label: "وكيل" },
  { value: "مباشر", label: "عميل مباشر للوكالة" },
] as const

// قنوات اكتساب العميل المباشر — تُقابل قيد transactions_direct_source_valid.
export const DIRECT_SOURCES = ["معرفة شخصية", "إحالة من عميل", "الموقع", "إعلان", "أخرى"] as const

export type DirectSource = (typeof DIRECT_SOURCES)[number]
export type ServiceType = (typeof SERVICE_TYPES)[number]
export type Source = (typeof SOURCES)[number]["value"]

export interface Agent {
  id: number
  name: string
  phone: string | null
  is_active: boolean
  created_at: string
}

export interface Transaction {
  id: number
  date: string
  service_type: ServiceType
  source: Source
  agent_id: number | null
  quantity: number
  agent_profit: number
  net_profit: number
  // null في الصفوف المسجّلة قبل إضافة العمود — تُعرض تحت "غير محدد".
  direct_source: DirectSource | null
  note: string | null
  created_at: string
  agents?: { name: string } | null
}

export interface TransactionInput {
  date: string
  service_type: string
  source: string
  agent_id: number | null
  quantity: number
  agent_profit: number
  net_profit: number
  direct_source: string | null
  note: string | null
}

// ─── ناقل PostgREST ─────────────────────────────────────────────────────────

async function rest<T>(path: string, init: RequestInit = {}): Promise<T> {
  if (!storeReady) throw new Error("قاعدة البيانات غير مضبوطة — أضف SUPABASE_URL و SUPABASE_SERVICE_KEY")
  const res = await fetch(`${URL_BASE}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: KEY,
      Authorization: `Bearer ${KEY}`,
      "Content-Type": "application/json",
      ...init.headers,
    },
    cache: "no-store",
  })
  const text = await res.text()
  if (!res.ok) throw new Error(pgError(text, res.status))
  return (text ? JSON.parse(text) : null) as T
}

/**
 * رسائل PostgREST إنجليزية وتقنية. نترجم انتهاكات القيود التي يمكن أن
 * يتسبّب فيها المستخدم إلى جملة عربية مفهومة، ونُبقي الباقي كما هو
 * لأن إخفاءه يُصعّب التشخيص.
 */
function pgError(body: string, status: number): string {
  let message = body
  try {
    const j = JSON.parse(body)
    message = j.message || j.error || body
  } catch {}
  if (message.includes("transactions_agent_matches_source")) {
    return "المصدر والوكيل غير متطابقين — اختر وكيلاً مع مصدر «وكيل»، ولا تختر وكيلاً مع «عميل مباشر»"
  }
  if (message.includes("transactions_direct_source_valid")) {
    return "قناة الاكتساب مطلوبة مع «عميل مباشر» وممنوعة مع «وكيل»"
  }
  if (message.includes("transactions_service_type_valid")) return "نوع خدمة غير معروف"
  if (message.includes("transactions_source_valid")) return "مصدر غير معروف"
  if (message.includes("quantity")) return "العدد يجب أن يكون ١ فأكثر"
  if (message.includes("agent_profit")) return "ربح الوكيل لا يمكن أن يكون سالباً"
  if (message.includes("on delete restrict") || message.includes("violates foreign key")) {
    return "لا يمكن حذف وكيل له عمليات مسجّلة — عطّله بدل حذفه"
  }
  return `خطأ من قاعدة البيانات (${status}): ${message.slice(0, 200)}`
}

// ─── الوكلاء ────────────────────────────────────────────────────────────────

export async function listAgents(activeOnly = false): Promise<Agent[]> {
  const filter = activeOnly ? "&is_active=eq.true" : ""
  return rest<Agent[]>(`agents?select=*${filter}&order=is_active.desc,name.asc`)
}

export async function createAgent(name: string, phone: string | null): Promise<Agent> {
  const rows = await rest<Agent[]>("agents", {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({ name: name.trim(), phone: phone?.trim() || null }),
  })
  return rows[0]
}

export async function updateAgent(
  id: number,
  patch: Partial<Pick<Agent, "name" | "phone" | "is_active">>,
): Promise<Agent> {
  const rows = await rest<Agent[]>(`agents?id=eq.${id}`, {
    method: "PATCH",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify(patch),
  })
  if (!rows.length) throw new Error("الوكيل غير موجود")
  return rows[0]
}

// ─── العمليات ───────────────────────────────────────────────────────────────

export interface TransactionFilters {
  from?: string
  to?: string
  service_type?: string
  source?: string
  direct_source?: string
  agent_id?: number
  limit?: number
}

export async function listTransactions(f: TransactionFilters = {}): Promise<Transaction[]> {
  const q = [`select=*,agents(name)`, `order=date.desc,id.desc`, `limit=${f.limit ?? 500}`]
  if (f.from) q.push(`date=gte.${f.from}`)
  if (f.to) q.push(`date=lte.${f.to}`)
  if (f.service_type) q.push(`service_type=eq.${encodeURIComponent(f.service_type)}`)
  if (f.source) q.push(`source=eq.${encodeURIComponent(f.source)}`)
  if (f.direct_source) q.push(`direct_source=eq.${encodeURIComponent(f.direct_source)}`)
  if (f.agent_id) q.push(`agent_id=eq.${f.agent_id}`)
  return rest<Transaction[]>(`transactions?${q.join("&")}`)
}

export async function createTransaction(input: TransactionInput): Promise<Transaction> {
  const rows = await rest<Transaction[]>("transactions", {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify(input),
  })
  return rows[0]
}

export async function updateTransaction(id: number, input: TransactionInput): Promise<Transaction> {
  const rows = await rest<Transaction[]>(`transactions?id=eq.${id}`, {
    method: "PATCH",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify(input),
  })
  if (!rows.length) throw new Error("العملية غير موجودة")
  return rows[0]
}

export async function deleteTransaction(id: number): Promise<void> {
  await rest<null>(`transactions?id=eq.${id}`, { method: "DELETE" })
}
