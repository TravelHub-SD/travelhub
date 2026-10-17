import { redirect } from "next/navigation"
import { ShieldCheck } from "lucide-react"
import { adminToken } from "@/lib/admin-auth"
import { adminConfigured, hasSectionAccess, safeNext } from "@/lib/admin-session"
import { SECTIONS, type SectionKey } from "@/lib/admin-sections"
import { AdminLoginForm } from "@/components/admin/login-form"

const MISSING_KEY = (
  <>
    أضف <code className="font-mono">SUPABASE_PUBLISHABLE_KEY</code> في متغيّرات البيئة على Vercel ثم أعد النشر.
  </>
)

/**
 * صفحة دخول قسمٍ من أقسام /admin — نفس الجلسة، وأهليّة كل قسم على حدة.
 * دالةٌ تُستدعى لا مكوّنٌ يُكتب كوسم: أنواع React هنا لا تقبل مكوّناً
 * غير متزامن داخل JSX، وفي الصفحة نفسها يُنتظر عادياً.
 */
export async function renderAdminLogin(sectionKey: SectionKey, next?: string) {
  const section = SECTIONS[sectionKey]
  const target = safeNext(next, section)

  // جلسةٌ سارية لمن يحقّ له القسم؟ لا داعي لنموذج الدخول.
  const token = await adminToken()
  if (token && (await hasSectionAccess(token, section)) === true) redirect(target)

  if (section.theme === "dark") {
    return (
      <main dir="rtl" className="relative flex min-h-dvh items-center justify-center overflow-hidden bg-[#07111C] p-5 [color-scheme:dark]">
        {/* توهّجان خافتان وشبكةٌ تتلاشى نحو الأطراف — عمقٌ بلا صور */}
        <div aria-hidden className="pointer-events-none absolute -top-40 left-1/2 h-[28rem] w-[28rem] -translate-x-1/2 rounded-full bg-[#164563]/50 blur-[120px]" />
        <div aria-hidden className="pointer-events-none absolute -bottom-40 -left-24 h-80 w-80 rounded-full bg-[#EF790F]/20 blur-[110px]" />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.35] [background-image:linear-gradient(rgba(255,255,255,0.04)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.04)_1px,transparent_1px)] [background-size:44px_44px] [mask-image:radial-gradient(ellipse_at_center,black_30%,transparent_75%)]"
        />

        <div className="relative w-full max-w-sm">
          <div className="mb-8 text-center">
            <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-white p-2 shadow-[0_0_48px_-8px_rgba(239,121,15,0.65)]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/brand-icon.png" alt="Travel Hub" className="h-full w-full object-contain" />
            </span>
            <h1 className="mt-5 text-2xl font-extrabold tracking-tight text-[#EEF2F7]">{section.title}</h1>
            <p className="mt-1.5 text-sm text-[#A7B4C3]">{section.subtitle}</p>
          </div>

          <div className="rounded-3xl bg-[#0E1A28]/85 p-6 shadow-2xl ring-1 ring-white/10 backdrop-blur-xl">
            {adminConfigured ? (
              <AdminLoginForm endpoint={section.authApi} next={target} tone="dark" />
            ) : (
              <p className="rounded-xl bg-[#c98500]/15 px-4 py-3 text-center text-sm font-bold text-[#FCD34D] ring-1 ring-[#c98500]/35">{MISSING_KEY}</p>
            )}
          </div>

          <p className="mt-6 flex items-center justify-center gap-1.5 text-[11px] font-semibold text-[#7D8EA3]">
            <ShieldCheck className="h-3.5 w-3.5" aria-hidden />
            لوحة داخلية لفريق Travel Hub · الدخول للمخوّلين فقط
          </p>
        </div>
      </main>
    )
  }

  return (
    <main dir="rtl" className="flex min-h-dvh flex-col items-center justify-center bg-[#F5F8FA] p-6">
      <div className="mb-8 text-center">
        <h1 className="text-2xl font-extrabold text-[#164563]">{section.title}</h1>
        <p className="mt-1 text-sm text-slate-500">{section.subtitle}</p>
      </div>

      {adminConfigured ? (
        <AdminLoginForm endpoint={section.authApi} next={target} />
      ) : (
        <p className="max-w-sm rounded-xl bg-amber-50 px-4 py-3 text-center text-sm font-medium text-amber-800">{MISSING_KEY}</p>
      )}
    </main>
  )
}
