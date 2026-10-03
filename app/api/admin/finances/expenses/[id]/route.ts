import { type NextRequest, NextResponse } from "next/server"
import { errorResponse, financeToken, NO_SESSION } from "@/lib/finance-auth"
import { deleteExpense, updateExpense } from "@/lib/finance-store"
import { isUuid, validateExpense } from "@/lib/finance-validate"

export const dynamic = "force-dynamic"

// Next 16: params وعدٌ يجب انتظاره
type Ctx = { params: Promise<{ id: string }> }

// المعرّف يدخل رابط PostgREST كما هو، فنتحقّق أنه uuid فعلاً قبل أن
// يصير جزءاً من استعلام.
async function idFrom(ctx: Ctx): Promise<string | null> {
  const { id } = await ctx.params
  return isUuid(id) ? id : null
}

export async function PATCH(request: NextRequest, ctx: Ctx) {
  const token = await financeToken()
  if (!token) return NextResponse.json(NO_SESSION, { status: 401 })
  const id = await idFrom(ctx)
  if (!id) return NextResponse.json({ error: "معرّف غير صحيح" }, { status: 400 })

  const body = await request.json().catch(() => ({}))
  const parsed = validateExpense(body)
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 })
  try {
    return NextResponse.json({ row: await updateExpense(token, id, parsed.value) })
  } catch (e) {
    return errorResponse(e)
  }
}

export async function DELETE(_request: NextRequest, ctx: Ctx) {
  const token = await financeToken()
  if (!token) return NextResponse.json(NO_SESSION, { status: 401 })
  const id = await idFrom(ctx)
  if (!id) return NextResponse.json({ error: "معرّف غير صحيح" }, { status: 400 })
  try {
    await deleteExpense(token, id)
    return NextResponse.json({ ok: true })
  } catch (e) {
    return errorResponse(e)
  }
}
