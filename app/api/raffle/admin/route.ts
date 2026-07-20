import { type NextRequest, NextResponse } from "next/server"
import { timingSafeEqual } from "node:crypto"
import { listEntries, listWinners, drawWinner, raffleConfigured } from "@/lib/raffle-store"
import { rateLimit, clientIp, tooMany } from "@/lib/rate-limit"

export const dynamic = "force-dynamic"

// مقارنة آمنة توقيتياً لمفتاح الإدارة (RAFFLE_ADMIN_KEY في متغيّرات البيئة)
function authorized(request: NextRequest): boolean {
  const expected = process.env.RAFFLE_ADMIN_KEY || ""
  if (!expected) return false
  const provided = request.headers.get("x-admin-key") || ""
  const A = Buffer.from(provided)
  const B = Buffer.from(expected)
  return A.length === B.length && timingSafeEqual(A, B)
}

export async function GET(request: NextRequest) {
  if (!rateLimit(`rfa:${clientIp(request.headers)}`, 20, 60_000)) {
    return NextResponse.json(tooMany, { status: 429 })
  }
  if (!process.env.RAFFLE_ADMIN_KEY) {
    return NextResponse.json({ error: "أضف RAFFLE_ADMIN_KEY في متغيّرات البيئة أولاً" }, { status: 503 })
  }
  if (!authorized(request)) return NextResponse.json({ error: "مفتاح غير صحيح" }, { status: 401 })

  const [entries, winners] = await Promise.all([listEntries(), listWinners()])
  entries.sort((a, b) => (a.at < b.at ? 1 : -1))
  return NextResponse.json({ entries, winners, storage: raffleConfigured ? "redis" : "memory" })
}

export async function POST(request: NextRequest) {
  if (!rateLimit(`rfa:${clientIp(request.headers)}`, 10, 60_000)) {
    return NextResponse.json(tooMany, { status: 429 })
  }
  if (!authorized(request)) return NextResponse.json({ error: "مفتاح غير صحيح" }, { status: 401 })

  const body = await request.json().catch(() => ({}))
  if (body?.action !== "draw") return NextResponse.json({ error: "إجراء غير معروف" }, { status: 400 })

  const winner = await drawWinner()
  if (!winner) return NextResponse.json({ error: "لا مشاركين متبقّين للسحب" }, { status: 400 })
  return NextResponse.json({ winner })
}
