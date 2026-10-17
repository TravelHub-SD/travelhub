import { type NextRequest, NextResponse } from "next/server"
import { adminToken, errorResponse, NO_SESSION } from "@/lib/admin-auth"
import { importApprovals, listApprovals } from "@/lib/approvals-store"
import { fromLegacy, MAX_IMPORT } from "@/lib/approvals-validate"

export const dynamic = "force-dynamic"

/**
 * استيراد ملف JSON — من الأداة القديمة أو من «تصدير» هنا.
 *
 * الأداة القديمة كانت **تستبدل** كل السجلات بمحتوى الملف بلا سؤال، وتنهار
 * عند أول سجلٍّ ناقص. هنا: يُضاف الجديد فقط، والموجود (بنفس المعرّف) يُتخطّى،
 * والسجلّ غير الصالح يُرفض وحده مع سببه — ولا يُمسّ شيء موجود.
 */
export async function POST(request: NextRequest) {
  const token = await adminToken()
  if (!token) return NextResponse.json(NO_SESSION, { status: 401 })

  const body = await request.json().catch(() => null)
  const records = Array.isArray(body) ? body : body?.records
  if (!Array.isArray(records)) return NextResponse.json({ error: "الملف ليس قائمة سجلات" }, { status: 400 })
  if (records.length > MAX_IMPORT) {
    return NextResponse.json({ error: `الحدّ ${MAX_IMPORT} سجل في المرة` }, { status: 400 })
  }

  try {
    // الموجود يُعرف بمعرّفه في الأداة القديمة، أو بمعرّفه هنا لملفٍّ صُدِّر من هنا.
    const existing = await listApprovals(token)
    const known = new Set<string>()
    for (const r of existing) {
      known.add(r.id)
      if (r.legacy_id) known.add(r.legacy_id)
    }

    const fresh = []
    const invalid: { index: number; name: string; error: string }[] = []
    let skipped = 0
    for (const [index, raw] of records.entries()) {
      const parsed = fromLegacy(raw)
      if (!parsed.ok) {
        invalid.push({ index, name: String(raw?.fullName ?? raw?.full_name ?? "").slice(0, 60), error: parsed.error })
        continue
      }
      if (known.has(parsed.value.legacy_id)) {
        skipped++
        continue
      }
      known.add(parsed.value.legacy_id) // مكرّرٌ داخل الملف نفسه
      fresh.push(parsed.value)
    }

    const inserted = await importApprovals(token, fresh)
    return NextResponse.json({ inserted, skipped: skipped + (fresh.length - inserted), invalid })
  } catch (e) {
    return errorResponse(e)
  }
}
