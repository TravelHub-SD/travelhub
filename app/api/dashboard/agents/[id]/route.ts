import { type NextRequest, NextResponse } from "next/server"
import { isSignedIn } from "@/lib/dashboard-auth"
import { updateAgent } from "@/lib/dashboard-store"

export const dynamic = "force-dynamic"

const DENIED = NextResponse.json({ error: "غير مصرّح" }, { status: 401 })
const msg = (e: unknown) => (e instanceof Error ? e.message : String(e))

type Ctx = { params: Promise<{ id: string }> }

export async function PATCH(request: NextRequest, ctx: Ctx) {
  if (!(await isSignedIn())) return DENIED
  const { id } = await ctx.params
  const n = Number(id)
  if (!Number.isInteger(n) || n < 1) return NextResponse.json({ error: "معرّف غير صحيح" }, { status: 400 })

  const body = await request.json().catch(() => ({}))
  const patch: { name?: string; phone?: string | null; is_active?: boolean } = {}

  if (body?.name !== undefined) {
    const name = String(body.name).trim()
    if (!name) return NextResponse.json({ error: "اسم الوكيل مطلوب" }, { status: 400 })
    patch.name = name
  }
  if (body?.phone !== undefined) patch.phone = String(body.phone).trim() || null
  if (body?.is_active !== undefined) patch.is_active = Boolean(body.is_active)

  if (!Object.keys(patch).length) return NextResponse.json({ error: "لا شيء لتعديله" }, { status: 400 })

  try {
    return NextResponse.json({ row: await updateAgent(n, patch) })
  } catch (e) {
    return NextResponse.json({ error: msg(e) }, { status: 400 })
  }
}
