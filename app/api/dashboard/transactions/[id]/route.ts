import { type NextRequest, NextResponse } from "next/server"
import { isSignedIn } from "@/lib/dashboard-auth"
import { deleteTransaction, updateTransaction } from "@/lib/dashboard-store"
import { validateTransaction } from "@/lib/dashboard-validate"

export const dynamic = "force-dynamic"

const DENIED = NextResponse.json({ error: "غير مصرّح" }, { status: 401 })
const msg = (e: unknown) => (e instanceof Error ? e.message : String(e))

// Next 16: params وعدٌ يجب انتظاره
type Ctx = { params: Promise<{ id: string }> }

async function idFrom(ctx: Ctx): Promise<number | null> {
  const { id } = await ctx.params
  const n = Number(id)
  return Number.isInteger(n) && n > 0 ? n : null
}

export async function PATCH(request: NextRequest, ctx: Ctx) {
  if (!(await isSignedIn())) return DENIED
  const id = await idFrom(ctx)
  if (!id) return NextResponse.json({ error: "معرّف غير صحيح" }, { status: 400 })

  const body = await request.json().catch(() => ({}))
  const parsed = validateTransaction(body)
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 })
  try {
    return NextResponse.json({ row: await updateTransaction(id, parsed.value) })
  } catch (e) {
    return NextResponse.json({ error: msg(e) }, { status: 400 })
  }
}

export async function DELETE(_request: NextRequest, ctx: Ctx) {
  if (!(await isSignedIn())) return DENIED
  const id = await idFrom(ctx)
  if (!id) return NextResponse.json({ error: "معرّف غير صحيح" }, { status: 400 })
  try {
    await deleteTransaction(id)
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: msg(e) }, { status: 400 })
  }
}
