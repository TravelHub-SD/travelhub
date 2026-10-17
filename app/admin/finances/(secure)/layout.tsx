import type { Metadata } from "next"
import type React from "react"
import { AdminHeader } from "@/components/admin/admin-header"
import { adminToken, otherSections } from "@/lib/admin-auth"
import { SECTIONS } from "@/lib/admin-sections"

export const metadata: Metadata = {
  title: "منصرفاتي",
  robots: { index: false, follow: false, nocache: true },
}

// أرقام شخصية تتغيّر مع كل بند — لا تُخبّأ أبداً.
export const dynamic = "force-dynamic"

// لا حارس هنا عمداً: redirect() في layout لا يمنع رسم الصفحة تحته (اختُبر
// ذلك في لوحة العمليات وسرّب بياناتها). الحارس في proxy.ts، والحكم في
// القاعدة نفسها، والصفحة تتعامل مع رفضها.
export default async function SecureFinanceLayout({ children }: { children: React.ReactNode }) {
  const s = SECTIONS.finances
  const token = await adminToken()
  const links = token ? await otherSections(token, s.key) : []
  return (
    <div dir="rtl" className="min-h-dvh bg-[#F5F8FA] text-slate-800">
      <AdminHeader title={s.title} logoutEndpoint={s.authApi} loginPath={s.login} links={links} />
      <main className="mx-auto max-w-3xl px-3 py-4 pb-24">{children}</main>
    </div>
  )
}
