"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"

const LINKS = [
  { href: "/dashboard/new", label: "عملية جديدة" },
  { href: "/dashboard", label: "الأرقام" },
  { href: "/dashboard/transactions", label: "السجل" },
  { href: "/dashboard/agents", label: "الوكلاء" },
]

export function DashboardNav() {
  const pathname = usePathname()
  const router = useRouter()

  async function signOut() {
    await fetch("/api/dashboard/login", { method: "DELETE" })
    router.replace("/dashboard/login")
    router.refresh()
  }

  return (
    <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 backdrop-blur">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-2 px-3 py-2">
        <span className="shrink-0 text-sm font-extrabold text-[#164563]">لوحة العمليات</span>
        <button onClick={signOut} className="shrink-0 text-xs font-medium text-slate-400 hover:text-slate-700">
          خروج
        </button>
      </div>

      {/* تمرير أفقي بدل التفاف الروابط: يبقى الشريط سطراً واحداً على الموبايل */}
      <nav className="mx-auto max-w-5xl overflow-x-auto px-3 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <ul className="flex gap-2">
          {LINKS.map((l) => {
            const active = pathname === l.href
            return (
              <li key={l.href}>
                <Link
                  href={l.href}
                  className={`block whitespace-nowrap rounded-full px-4 py-2 text-sm font-semibold transition ${
                    active ? "bg-[#164563] text-white" : "bg-slate-100 text-slate-600 active:bg-slate-200"
                  }`}
                >
                  {l.label}
                </Link>
              </li>
            )
          })}
        </ul>
      </nav>
    </header>
  )
}
