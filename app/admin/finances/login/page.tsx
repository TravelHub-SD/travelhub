import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { financeToken } from "@/lib/finance-auth"
import { financeConfigured, isFinanceOwner, safeNext } from "@/lib/finance-session"
import { FinanceLoginForm } from "@/components/finances/login-form"

export const metadata: Metadata = {
  title: "دخول — منصرفاتي",
  robots: { index: false, follow: false, nocache: true },
}

export const dynamic = "force-dynamic"

export default async function FinanceLoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const next = safeNext((await searchParams).next)

  // جلسةٌ سارية لمالك؟ لا داعي لنموذج الدخول.
  const token = await financeToken()
  if (token && (await isFinanceOwner(token)) === true) redirect(next)

  return (
    <main dir="rtl" className="flex min-h-dvh flex-col items-center justify-center bg-[#F5F8FA] p-6">
      <div className="mb-8 text-center">
        <h1 className="text-2xl font-extrabold text-[#164563]">منصرفاتي</h1>
        <p className="mt-1 text-sm text-slate-500">قسم شخصي — منفصل عن لوحة العمليات</p>
      </div>

      {financeConfigured ? (
        <FinanceLoginForm next={next} />
      ) : (
        <p className="max-w-sm rounded-xl bg-amber-50 px-4 py-3 text-center text-sm font-medium text-amber-800">
          أضف <code className="font-mono">SUPABASE_PUBLISHABLE_KEY</code> في متغيّرات البيئة على Vercel ثم أعد النشر.
        </p>
      )}
    </main>
  )
}
