import type { Metadata } from "next"
import type React from "react"
import { redirect } from "next/navigation"
import { isSignedIn } from "@/lib/dashboard-auth"
import { DashboardNav } from "@/components/dashboard/nav"

export const metadata: Metadata = {
  title: "لوحة العمليات",
  robots: { index: false, follow: false, nocache: true },
}

// بيانات تشغيلية تتغيّر مع كل عملية — لا تُخبّأ أبداً.
export const dynamic = "force-dynamic"

export default async function SecureDashboardLayout({ children }: { children: React.ReactNode }) {
  // حارسٌ واحد للقسم كلّه: كل صفحة تحته محميّة بحكم موقعها، فلا تُنسى
  // حمايةُ صفحة تُضاف لاحقاً.
  if (!(await isSignedIn())) redirect("/dashboard/login")

  return (
    <div dir="rtl" className="min-h-dvh bg-[#F5F8FA] text-slate-800">
      <DashboardNav />
      <main className="mx-auto max-w-5xl px-3 py-4 pb-24">{children}</main>
    </div>
  )
}
