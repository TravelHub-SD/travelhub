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

import { AdminNotFoundError, userRest, userRestAll, type PgFailure } from "@/lib/admin-rest"

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

const DENIED = "هذا الحساب غير مخوّل لقسم المنصرفات"

/** رسائل قيود المنصرفات — الباقي تتولّاه lib/admin-rest.ts. */
function expenseError(f: PgFailure): string | null {
  if (f.message.includes("personal_expenses_amount_check")) return "المبلغ يجب أن يكون أكبر من صفر"
  if (f.message.includes("personal_expenses_note_check")) return "الملاحظة أطول من ٥٠٠ حرف"
  if (f.code === "23503") return "تصنيف غير معروف"
  if (f.code === "22P02") return "قيمة غير صالحة"
  return null
}

function rest<T>(token: string, path: string, init: RequestInit = {}): Promise<T> {
  return userRest<T>(token, path, init, expenseError, DENIED)
}

const EXPENSE_SELECT = "id,date,category_id,amount,note,created_at,expense_categories(name)"

export async function listCategories(token: string): Promise<ExpenseCategory[]> {
  return rest<ExpenseCategory[]>(token, "expense_categories?select=id,name,is_default&order=name.asc")
}

export async function listExpenses(token: string, from: string, to: string): Promise<Expense[]> {
  return userRestAll<Expense>(
    token,
    `personal_expenses?select=${EXPENSE_SELECT}&date=gte.${from}&date=lte.${to}&order=date.desc,created_at.desc`,
    expenseError,
    DENIED,
  )
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
  if (!rows.length) throw new AdminNotFoundError("البند غير موجود")
  return rows[0]
}

export async function deleteExpense(token: string, id: string): Promise<void> {
  // return=representation لنعرف هل حُذف شيء: RLS يجعل بند غيرك «غير
  // موجود» بصمت، وحذفٌ لم يحدث يجب ألّا يُعرض كنجاح.
  const rows = await rest<{ id: string }[]>(token, `personal_expenses?id=eq.${id}&select=id`, {
    method: "DELETE",
    headers: { Prefer: "return=representation" },
  })
  if (!rows.length) throw new AdminNotFoundError("البند غير موجود")
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
