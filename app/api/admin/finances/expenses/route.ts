import { type NextRequest, NextResponse } from "next/server"
import { errorResponse, financeToken, NO_SESSION } from "@/lib/finance-auth"
import { createExpense } from "@/lib/finance-store"
import { validateExpense } from "@/lib/finance-validate"

export const dynamic = "force-dynamic"

export async function POST(request: NextRequest) {
  const token = await financeToken()
  if (!token) return NextResponse.json(NO_SESSION, { status: 401 })

  const body = await request.json().catch(() => ({}))
  const parsed = validateExpense(body)
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 })
  try {
    return NextResponse.json({ row: await createExpense(token, parsed.value) }, { status: 201 })
  } catch (e) {
    return errorResponse(e)
  }
}
