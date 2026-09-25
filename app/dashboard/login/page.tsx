import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { isSignedIn, dashboardConfigured } from "@/lib/dashboard-auth"
import { LoginForm } from "@/components/dashboard/login-form"

export const metadata: Metadata = {
  title: "دخول لوحة العمليات",
  robots: { index: false, follow: false },
}

export const dynamic = "force-dynamic"

export default async function DashboardLoginPage() {
  if (await isSignedIn()) redirect("/dashboard")

  return (
    <main dir="rtl" className="flex min-h-dvh flex-col items-center justify-center bg-[#F5F8FA] p-6">
      <div className="mb-8 text-center">
        <h1 className="text-2xl font-extrabold text-[#164563]">لوحة العمليات</h1>
        <p className="mt-1 text-sm text-slate-500">Travel Hub — تسجيل عمليات الوكالة</p>
      </div>

      {dashboardConfigured ? (
        <LoginForm />
      ) : (
        <p className="max-w-sm rounded-xl bg-amber-50 px-4 py-3 text-center text-sm font-medium text-amber-800">
          أضف <code className="font-mono">DASHBOARD_PASSWORD</code> في متغيّرات البيئة على Vercel ثم أعد النشر.
        </p>
      )}
    </main>
  )
}
