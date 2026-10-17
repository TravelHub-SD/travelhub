"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { RouterFlush } from "@/components/router-flush"

/**
 * رأس أقسام /admin. links = الأقسام الأخرى التي يحقّ لصاحب الجلسة دخولها،
 * محسوبةً على الخادم — فلا يرى موظفُ الموافقات رابطاً لمالية لا تخصّه.
 */
export function AdminHeader({
  title,
  logoutEndpoint,
  loginPath,
  links = [],
}: {
  title: string
  logoutEndpoint: string
  loginPath: string
  links?: { href: string; label: string }[]
}) {
  const router = useRouter()

  async function signOut() {
    await fetch(logoutEndpoint, { method: "DELETE" })
    router.replace(loginPath)
    router.refresh()
  }

  return (
    <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-3 py-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className="truncate text-sm font-extrabold text-[#164563]">{title}</span>
          {links.map((l) => (
            // بلا جلب مسبق: صفحة القسم الآخر تمرّ بالحارس، والحارس قد يجدّد
            // الجلسة. تجديدان متزامنان (الجلب المسبق والصفحة الحالية) يستعملان
            // نفس رمز التجديد، وSupabase يُبطله بعد أول استعمال — فيُطرد المستخدم.
            <Link
              key={l.href}
              href={l.href}
              prefetch={false}
              className="shrink-0 rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-200"
            >
              {l.label}
            </Link>
          ))}
        </div>
        <button onClick={signOut} className="shrink-0 text-xs font-medium text-slate-400 hover:text-slate-700">
          خروج
        </button>
      </div>
      <RouterFlush />
    </header>
  )
}
