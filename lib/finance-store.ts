/**
 * lib/finance-store.ts
 * ─────────────────────────────────────────────────────────────
 * قراءة وكتابة المنصرفات الشخصية — **بجلسة المستخدم**، لا بمفتاح الخادم.
 *
 * هذا هو الفرق الجوهري عن lib/dashboard-store.ts: هناك service_role
 * يتجاوز RLS، فالحماية كلها في كود الموقع. هنا كل طلب يحمل JWT صاحبه،
 * فلا يعيد Supabase إلا صفوفه ولا يقبل إلا ما يُكتب باسمه. لا فلتر
 * user_id في أي استعلام هنا — ولا يلزم: نسيانه لا يكشف شيئاً.
 * ─────────────────────────────────────────────────────────────
 */

import { publicKey, supabaseUrl } from "@/lib/finance-session"

export interface ExpenseCategory {
  id: string
  name: string
  is_default: boolean
}

export interface Expense {
  id: string
  date: string
  category_id: string
  amount: number
  note: string | null
  created_at: string
  expense_categories?: { name: string } | null
}

export interface ExpenseInput {
  date: string
  category_id: string
  amount: number
  note: string | null
}

/** الرمز مرفوض (منتهٍ أو مزوّر) — المطلوب دخولٌ جديد. */
export class FinanceAuthError extends Error {}
/** الرمز سليم لكن صاحبه ليس مالكاً — أو RLS رفض الصف. */
export class FinanceForbiddenError extends Error {}
/** البند غير موجود — أو موجود لغيرك، وRLS لا يفرّق بينهما عمداً. */
export class FinanceNotFoundError extends Error {}

async function rest<T>(token: string, path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${supabaseUrl()}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: publicKey(),
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...init.headers,
    },
    cache: "no-store",
  })
  const text = await res.text()
  if (res.status === 401) throw new FinanceAuthError("انتهت الجلسة — سجّل الدخول من جديد")
  if (!res.ok) throw pgError(text, res.status)
  return (text ? JSON.parse(text) : null) as T
}

function pgError(body: string, status: number): Error {
  let message = body
  let code = ""
  try {
    const j = JSON.parse(body)
    message = j.message || body
    code = j.code || ""
  } catch {}
  if (code === "42501" || status === 403) return new FinanceForbiddenError("هذا الحساب غير مخوّل لقسم المنصرفات")
  if (message.includes("personal_expenses_amount_check")) return new Error("المبلغ يجب أن يكون أكبر من صفر")
  if (message.includes("personal_expenses_note_check")) return new Error("الملاحظة أطول من ٥٠٠ حرف")
  if (code === "23503") return new Error("تصنيف غير معروف")
  if (code === "22P02") return new Error("قيمة غير صالحة")
  // حاجز الحذف الجماعي — رسالته عربية أصلاً وتشرح نفسها
  if (message.includes("عملية جماعية مرفوضة")) return new Error(message)
  return new Error(`خطأ من قاعدة البيانات (${status}): ${message.slice(0, 200)}`)
}

// PostgREST في Supabase يقصّ أي ردّ عند ١٠٠٠ صف بصمت. شهرٌ بأكثر من ألف
// بند نادر، لكن مجموعاً ناقصاً بلا أي إشارة أسوأ من أن نحتاط.
const PAGE = 1000

const EXPENSE_SELECT = "id,date,category_id,amount,note,created_at,expense_categories(name)"

export async function listCategories(token: string): Promise<ExpenseCategory[]> {
  return rest<ExpenseCategory[]>(token, "expense_categories?select=id,name,is_default&order=name.asc")
}

export async function listExpenses(token: string, from: string, to: string): Promise<Expense[]> {
  const out: Expense[] = []
  for (let offset = 0; ; offset += PAGE) {
    const page = await rest<Expense[]>(
      token,
      `personal_expenses?select=${EXPENSE_SELECT}&date=gte.${from}&date=lte.${to}` +
        `&order=date.desc,created_at.desc&limit=${PAGE}&offset=${offset}`,
    )
    out.push(...page)
    if (page.length < PAGE) return out
  }
}

// user_id لا يُرسل: القاعدة تملؤه من الجلسة (default auth.uid())، وRLS
// يرفض أي قيمة أخرى. إرساله من هنا كان سيفتح باب الخطأ لا غير.
export async function createExpense(token: string, input: ExpenseInput): Promise<Expense> {
  const rows = await rest<Expense[]>(token, `personal_expenses?select=${EXPENSE_SELECT}`, {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify(input),
  })
  return rows[0]
}

export async function updateExpense(token: string, id: string, input: ExpenseInput): Promise<Expense> {
  const rows = await rest<Expense[]>(token, `personal_expenses?id=eq.${id}&select=${EXPENSE_SELECT}`, {
    method: "PATCH",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify(input),
  })
  if (!rows.length) throw new FinanceNotFoundError("البند غير موجود")
  return rows[0]
}

export async function deleteExpense(token: string, id: string): Promise<void> {
  // return=representation لنعرف هل حُذف شيء: RLS يجعل بند غيرك «غير
  // موجود» بصمت، وحذفٌ لم يحدث يجب ألّا يُعرض كنجاح.
  const rows = await rest<{ id: string }[]>(token, `personal_expenses?id=eq.${id}&select=id`, {
    method: "DELETE",
    headers: { Prefer: "return=representation" },
  })
  if (!rows.length) throw new FinanceNotFoundError("البند غير موجود")
}

/**
 * صافي أرباح الوكالة للفترة — رقمٌ واحد من دالة في القاعدة. الجلسة
 * الشخصية لا ترى صفوف العمليات أصلاً، والدالة ترفض من ليس مالكاً.
 */
export async function agencyNetProfit(token: string, from: string, to: string): Promise<number> {
  const n = await rest<number>(token, "rpc/finance_agency_net_profit", {
    method: "POST",
    body: JSON.stringify({ p_from: from, p_to: to }),
  })
  return Number(n) || 0
}
