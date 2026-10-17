"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { LogOut } from "lucide-react"
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
  tone = "light",
  email,
}: {
  title: string
  logoutEndpoint: string
  loginPath: string
  links?: { href: string; label: string }[]
  tone?: "light" | "dark"
  email?: string | null
}) {
  const router = useRouter()

  async function signOut() {
    await fetch(logoutEndpoint, { method: "DELETE" })
    router.replace(loginPath)
    router.refresh()
  }

  // بلا جلب مسبق للروابط: صفحة القسم الآخر تمرّ بالحارس، والحارس قد يجدّد
  // الجلسة. تجديدان متزامنان (الجلب المسبق والصفحة الحالية) يستعملان نفس
  // رمز التجديد، وSupabase يُبطله بعد أول استعمال — فيُطرد المستخدم.
  if (tone === "dark") {
    return (
      <header className="sticky top-0 z-30 border-b border-white/[0.06] bg-[#07111C]/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-3 py-2.5">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white p-1 shadow-[0_0_24px_-6px_rgba(239,121,15,0.6)]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/brand-icon.png" alt="" className="h-full w-full object-contain" />
            </span>
            <div className="min-w-0 leading-tight">
              <p className="truncate text-sm font-extrabold text-[#EEF2F7]">{title}</p>
              <p className="text-[11px] font-semibold text-[#7D8EA3]">Travel Hub</p>
            </div>
            {links.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                prefetch={false}
                className="hidden shrink-0 rounded-full bg-white/[0.05] px-3 py-1 text-xs font-bold text-[#A7B4C3] ring-1 ring-white/10 transition hover:text-[#EEF2F7] sm:inline-block"
              >
                {l.label}
              </Link>
            ))}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {email && (
              <span className="hidden items-center gap-2 rounded-full bg-white/[0.04] py-1 pe-3 ps-1 text-xs text-[#A7B4C3] ring-1 ring-white/[0.07] md:flex">
                <span aria-hidden className="flex h-6 w-6 items-center justify-center rounded-full bg-[#EF790F]/20 text-[11px] font-extrabold uppercase text-[#F7A04B]">
                  {email[0]}
                </span>
                <bdi dir="ltr">{email}</bdi>
              </span>
            )}
            <button
              onClick={signOut}
              className="inline-flex h-9 items-center gap-1.5 rounded-xl px-3 text-xs font-bold text-[#A7B4C3] ring-1 ring-white/10 transition hover:bg-white/[0.06] hover:text-[#EEF2F7]"
            >
              <LogOut className="h-4 w-4" aria-hidden />
              خروج
            </button>
          </div>
        </div>
        {links.length > 0 && (
          <nav className="flex gap-2 overflow-x-auto px-3 pb-2 sm:hidden">
            {links.map((l) => (
              <Link key={l.href} href={l.href} prefetch={false} className="shrink-0 rounded-full bg-white/[0.05] px-3 py-1 text-xs font-bold text-[#A7B4C3] ring-1 ring-white/10">
                {l.label}
              </Link>
            ))}
          </nav>
        )}
        <RouterFlush />
      </header>
    )
  }

  return (
    <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-3 py-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className="truncate text-sm font-extrabold text-[#164563]">{title}</span>
          {links.map((l) => (
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
