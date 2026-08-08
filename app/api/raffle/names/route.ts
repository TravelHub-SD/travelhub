import { NextResponse } from "next/server"
import { listEntries, entryCount } from "@/lib/raffle-store"

export const dynamic = "force-dynamic"

// أسماء المشاركين للعرض على العجلة — الاسم الأول فقط، بلا أرقام (خصوصية).
export async function GET() {
  try {
    const [entries, total] = await Promise.all([listEntries(), entryCount()])
    // خلط + اقتطاع للعرض؛ نُظهر الاسم الأول فقط
    const names = entries
      .map((e) => ({ name: (e.name || "").trim().split(/\s+/)[0].slice(0, 14) || "مشارك" }))
      .filter((n) => n.name)
      .sort(() => Math.random() - 0.5)
      .slice(0, 16)
    return NextResponse.json({ names, total })
  } catch {
    return NextResponse.json({ names: [], total: 0 })
  }
}
