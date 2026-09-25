import { type NextRequest, NextResponse } from "next/server"
import { isSignedIn } from "@/lib/dashboard-auth"
import { createTransaction, listTransactions } from "@/lib/dashboard-store"
import { validateTransaction } from "@/lib/dashboard-validate"

export const dynamic = "force-dynamic"

const DENIED = NextResponse.json({ error: "غير مصرّح" }, { status: 401 })

export async function GET(request: NextRequest) {
  if (!(await isSignedIn())) return DENIED
  const p = request.nextUrl.searchParams
  try {
    const rows = await listTransactions({
      from: p.get("from") || undefined,
      to: p.get("to") || undefined,
      service_type: p.get("service_type") || undefined,
      source: p.get("source") || undefined,
      agent_id: p.get("agent_id") ? Number(p.get("agent_id")) : undefined,
    })
    return NextResponse.json({ rows })
  } catch (e) {
    return NextResponse.json({ error: msg(e) }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  if (!(await isSignedIn())) return DENIED
  const body = await request.json().catch(() => ({}))
  const parsed = validateTransaction(body)
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 })
  try {
    return NextResponse.json({ row: await createTransaction(parsed.value) }, { status: 201 })
  } catch (e) {
    return NextResponse.json({ error: msg(e) }, { status: 400 })
  }
}

const msg = (e: unknown) => (e instanceof Error ? e.message : String(e))
