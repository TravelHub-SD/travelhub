import { redirect } from "next/navigation"
import { adminToken } from "@/lib/admin-auth"
import { AdminAuthError, AdminForbiddenError } from "@/lib/admin-rest"
import { listApprovals, type Approval } from "@/lib/approvals-store"
import { SECTIONS } from "@/lib/admin-sections"
import { ApprovalsBoard } from "@/components/approvals/approvals-board"

export const dynamic = "force-dynamic"

export default async function ApprovalsPage() {
  const s = SECTIONS.approvals
  const token = await adminToken()
  if (!token) redirect(`${s.login}?next=${encodeURIComponent(s.home)}`)

  let rows: Approval[] = []
  let failure: "auth" | "forbidden" | null = null
  let error = ""
  try {
    rows = await listApprovals(token)
  } catch (e) {
    if (e instanceof AdminAuthError) failure = "auth"
    else if (e instanceof AdminForbiddenError) failure = "forbidden"
    else error = e instanceof Error ? e.message : String(e)
  }

  // خارج try: redirect يعمل برمي استثناء، وcatch كان سيبتلعه.
  if (failure === "auth") redirect(`${s.login}?next=${encodeURIComponent(s.home)}`)
  if (failure === "forbidden") {
    return (
      <p role="alert" className="rounded-2xl bg-amber-50 p-6 text-center text-sm font-medium text-amber-800">
        {s.denied}.
      </p>
    )
  }
  if (error) {
    return (
      <p role="alert" className="rounded-2xl bg-red-50 p-6 text-center text-sm font-medium text-red-700">
        {error}
      </p>
    )
  }

  return <ApprovalsBoard rows={rows} />
}
