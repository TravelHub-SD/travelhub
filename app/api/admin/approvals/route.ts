import { type NextRequest, NextResponse } from "next/server"
import { adminToken, errorResponse, NO_SESSION } from "@/lib/admin-auth"
import { createApproval } from "@/lib/approvals-store"
import { validateApproval } from "@/lib/approvals-validate"

export const dynamic = "force-dynamic"

export async function POST(request: NextRequest) {
  const token = await adminToken()
  if (!token) return NextResponse.json(NO_SESSION, { status: 401 })

  const parsed = validateApproval(await request.json().catch(() => ({})))
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 })
  try {
    return NextResponse.json({ row: await createApproval(token, parsed.value) }, { status: 201 })
  } catch (e) {
    return errorResponse(e)
  }
}
