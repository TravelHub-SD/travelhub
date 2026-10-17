import { type NextRequest, NextResponse } from "next/server"
import { adminToken, errorResponse, NO_SESSION } from "@/lib/admin-auth"
import { deleteApproval, updateApproval } from "@/lib/approvals-store"
import { isUuid, validateApproval } from "@/lib/approvals-validate"

export const dynamic = "force-dynamic"

// Next 16: params وعدٌ يجب انتظاره
type Ctx = { params: Promise<{ id: string }> }

// المعرّف يدخل رابط PostgREST كما هو، فنتحقّق أنه uuid قبل أن يصير جزءاً من استعلام.
async function idFrom(ctx: Ctx): Promise<string | null> {
  const { id } = await ctx.params
  return isUuid(id) ? id : null
}

export async function PATCH(request: NextRequest, ctx: Ctx) {
  const token = await adminToken()
  if (!token) return NextResponse.json(NO_SESSION, { status: 401 })
  const id = await idFrom(ctx)
  if (!id) return NextResponse.json({ error: "معرّف غير صحيح" }, { status: 400 })

  const parsed = validateApproval(await request.json().catch(() => ({})))
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 })
  try {
    return NextResponse.json({ row: await updateApproval(token, id, parsed.value) })
  } catch (e) {
    return errorResponse(e)
  }
}

export async function DELETE(_request: NextRequest, ctx: Ctx) {
  const token = await adminToken()
  if (!token) return NextResponse.json(NO_SESSION, { status: 401 })
  const id = await idFrom(ctx)
  if (!id) return NextResponse.json({ error: "معرّف غير صحيح" }, { status: 400 })
  try {
    await deleteApproval(token, id)
    return NextResponse.json({ ok: true })
  } catch (e) {
    return errorResponse(e)
  }
}
