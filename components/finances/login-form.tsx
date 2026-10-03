"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"

const FIELD =
  "h-14 w-full rounded-xl border border-slate-300 bg-white px-4 text-base outline-none focus:border-[#EF790F] focus:ring-2 focus:ring-[#EF790F]/30"

export function FinanceLoginForm({ next }: { next: string }) {
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [busy, setBusy] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError("")
    try {
      const res = await fetch("/api/admin/finances/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(json?.error || "تعذّر تسجيل الدخول")
        return
      }
      router.replace(next)
      router.refresh()
    } catch {
      setError("تعذّر الاتصال — تحقّق من الشبكة")
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} className="w-full max-w-sm space-y-4">
      <div>
        <label htmlFor="email" className="mb-2 block text-sm font-semibold text-[#164563]">
          البريد الإلكتروني
        </label>
        <input
          id="email"
          type="email"
          dir="ltr"
          autoFocus
          autoComplete="username"
          inputMode="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className={FIELD}
        />
      </div>
      <div>
        <label htmlFor="pw" className="mb-2 block text-sm font-semibold text-[#164563]">
          كلمة المرور
        </label>
        <input
          id="pw"
          type="password"
          dir="ltr"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className={FIELD}
        />
      </div>

      {error && (
        <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={busy || !email || !password}
        className="h-14 w-full rounded-xl bg-[#164563] text-lg font-bold text-white transition active:scale-[0.99] disabled:opacity-50"
      >
        {busy ? "جارٍ الدخول…" : "دخول"}
      </button>
    </form>
  )
}
