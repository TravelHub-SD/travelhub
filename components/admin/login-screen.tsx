import { redirect } from "next/navigation"
import { adminToken } from "@/lib/admin-auth"
import { adminConfigured, hasSectionAccess, safeNext } from "@/lib/admin-session"
import { SECTIONS, type SectionKey } from "@/lib/admin-sections"
import { AdminLoginForm } from "@/components/admin/login-form"

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

  return (
    <main dir="rtl" className="flex min-h-dvh flex-col items-center justify-center bg-[#F5F8FA] p-6">
      <div className="mb-8 text-center">
        <h1 className="text-2xl font-extrabold text-[#164563]">{section.title}</h1>
        <p className="mt-1 text-sm text-slate-500">{section.subtitle}</p>
      </div>

      {adminConfigured ? (
        <AdminLoginForm endpoint={section.authApi} next={target} />
      ) : (
        <p className="max-w-sm rounded-xl bg-amber-50 px-4 py-3 text-center text-sm font-medium text-amber-800">
          أضف <code className="font-mono">SUPABASE_PUBLISHABLE_KEY</code> في متغيّرات البيئة على Vercel ثم أعد النشر.
        </p>
      )}
    </main>
  )
}
