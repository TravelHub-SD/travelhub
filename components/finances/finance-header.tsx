"use client"

import { useRouter } from "next/navigation"

export function FinanceHeader() {
  const router = useRouter()

  async function signOut() {
    await fetch("/api/admin/finances/auth", { method: "DELETE" })
    router.replace("/admin/finances/login")
    router.refresh()
  }

  return (
    <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 backdrop-blur">
      <div className="mx-auto flex max-w-3xl items-center justify-between gap-2 px-3 py-3">
        <span className="text-sm font-extrabold text-[#164563]">منصرفاتي</span>
        <button onClick={signOut} className="text-xs font-medium text-slate-400 hover:text-slate-700">
          خروج
        </button>
      </div>
    </header>
  )
}
