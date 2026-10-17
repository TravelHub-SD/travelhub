"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { ArrowLeft, Eye, EyeOff, LoaderCircle, Lock, Mail, TriangleAlert } from "lucide-react"

const FIELD =
  "h-14 w-full rounded-xl border border-slate-300 bg-white px-4 text-base outline-none focus:border-[#EF790F] focus:ring-2 focus:ring-[#EF790F]/30"
const DARK_FIELD =
  "h-14 w-full rounded-xl bg-[#07111C] pe-4 ps-11 text-base text-[#EEF2F7] ring-1 ring-white/10 outline-none transition placeholder:text-[#7D8EA3]/60 focus:ring-2 focus:ring-[#EF790F]/70"

// endpoint: مسار دخول القسم — كلٌّ يتحقّق من أهليّته هو قبل أن يعطي الجلسة.
export function AdminLoginForm({ endpoint, next, tone = "light" }: { endpoint: string; next: string; tone?: "light" | "dark" }) {
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [show, setShow] = useState(false)
  const [error, setError] = useState("")
  const [busy, setBusy] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError("")
    try {
      const res = await fetch(endpoint, {
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

  if (tone === "dark") {
    return (
      <form onSubmit={submit} className="space-y-4">
        <div>
          <label htmlFor="email" className="mb-2 block text-xs font-bold text-[#A7B4C3]">
            البريد الإلكتروني
          </label>
          <div className="relative">
            <Mail className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#7D8EA3]" aria-hidden />
            <input
              id="email"
              type="email"
              dir="ltr"
              autoFocus
              autoComplete="username"
              inputMode="email"
              placeholder="name@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={`${DARK_FIELD} text-left`}
            />
          </div>
        </div>
        <div>
          <label htmlFor="pw" className="mb-2 block text-xs font-bold text-[#A7B4C3]">
            كلمة المرور
          </label>
          <div className="relative">
            <Lock className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#7D8EA3]" aria-hidden />
            <input
              id="pw"
              type={show ? "text" : "password"}
              dir="ltr"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={`${DARK_FIELD} pe-12 text-left`}
            />
            <button
              type="button"
              onClick={() => setShow((s) => !s)}
              aria-label={show ? "إخفاء كلمة المرور" : "إظهار كلمة المرور"}
              aria-pressed={show}
              className="absolute left-2 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-lg text-[#7D8EA3] transition hover:text-[#EEF2F7]"
            >
              {show ? <EyeOff className="h-4 w-4" aria-hidden /> : <Eye className="h-4 w-4" aria-hidden />}
            </button>
          </div>
        </div>

        {error && (
          <p role="alert" className="flex items-center gap-2 rounded-xl bg-[#e66767]/15 px-3 py-2.5 text-sm font-bold text-[#FCA5A5] ring-1 ring-[#e66767]/30">
            <TriangleAlert className="h-4 w-4 shrink-0" aria-hidden />
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={busy || !email || !password}
          className="group flex h-14 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-l from-[#F59331] to-[#EF790F] text-lg font-extrabold text-[#07111C] shadow-[0_12px_32px_-12px_rgba(239,121,15,0.8)] transition hover:brightness-110 active:scale-[0.99] disabled:opacity-50"
        >
          {busy ? <LoaderCircle className="h-5 w-5 animate-spin" aria-hidden /> : null}
          {busy ? "جارٍ الدخول…" : "دخول"}
          {!busy && <ArrowLeft className="h-5 w-5 transition group-hover:-translate-x-1" aria-hidden />}
        </button>
      </form>
    )
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
