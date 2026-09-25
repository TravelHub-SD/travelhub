import { type NextRequest, NextResponse } from "next/server"
import { isSignedIn } from "@/lib/dashboard-auth"
import { createAgent, listAgents } from "@/lib/dashboard-store"

export const dynamic = "force-dynamic"

const DENIED = NextResponse.json({ error: "غير مصرّح" }, { status: 401 })
const msg = (e: unknown) => (e instanceof Error ? e.message : String(e))

export async function GET(request: NextRequest) {
  if (!(await isSignedIn())) return DENIED
  try {
    const activeOnly = request.nextUrl.searchParams.get("active") === "1"
    return NextResponse.json({ rows: await listAgents(activeOnly) })
  } catch (e) {
    return NextResponse.json({ error: msg(e) }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  if (!(await isSignedIn())) return DENIED
  const body = await request.json().catch(() => ({}))
  const name = String(body?.name || "").trim()
  if (!name) return NextResponse.json({ error: "اسم الوكيل مطلوب" }, { status: 400 })
  try {
    return NextResponse.json({ row: await createAgent(name, body?.phone ?? null) }, { status: 201 })
  } catch (e) {
    return NextResponse.json({ error: msg(e) }, { status: 400 })
  }
}
