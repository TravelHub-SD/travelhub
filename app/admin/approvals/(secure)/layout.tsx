import type { Metadata, Viewport } from "next"
import type React from "react"
import { AdminHeader } from "@/components/admin/admin-header"
import { adminToken, otherSections } from "@/lib/admin-auth"
import { tokenEmail } from "@/lib/admin-session"
import { SECTIONS } from "@/lib/admin-sections"

export const metadata: Metadata = {
  title: "الموافقات الأمنية",
  robots: { index: false, follow: false, nocache: true },
}

// شريط المتصفح على الهاتف بلون الصفحة الداكن، لا أبيض فوقها.
export const viewport: Viewport = { themeColor: "#07111C" }

// بيانات عملاء تتغيّر مع كل طلب — لا تُخبّأ أبداً.
export const dynamic = "force-dynamic"

// لا حارس هنا عمداً: redirect() في layout لا يمنع رسم الصفحة تحته. الحارس
// في proxy.ts، والحكم في القاعدة نفسها، والصفحة تتعامل مع رفضها.
export default async function SecureApprovalsLayout({ children }: { children: React.ReactNode }) {
  const s = SECTIONS.approvals
  const token = await adminToken()
  const links = token ? await otherSections(token, s.key) : []
  return (
    // color-scheme: dark — حقول النظام وأشرطة التمرير داكنة أيضاً.
    <div dir="rtl" className="min-h-dvh bg-[#07111C] text-[#EEF2F7] [color-scheme:dark]">
      <div aria-hidden className="pointer-events-none fixed inset-x-0 top-0 h-80 bg-[radial-gradient(ellipse_at_top,rgba(22,69,99,0.45),transparent_70%)]" />
      <AdminHeader title={s.title} logoutEndpoint={s.authApi} loginPath={s.login} links={links} tone="dark" email={token ? tokenEmail(token) : null} />
      <main className="relative mx-auto max-w-6xl px-3 py-5 pb-28">{children}</main>
    </div>
  )
}
