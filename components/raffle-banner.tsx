"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Gift, MessageCircle, CheckCircle2, Users, Loader2 } from "lucide-react"

interface RaffleBannerProps {
  groupLink: string
}

export function RaffleBanner({ groupLink }: RaffleBannerProps) {
  const [name, setName] = useState("")
  const [phone, setPhone] = useState("")
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState<null | { duplicate: boolean }>(null)
  const [error, setError] = useState("")
  const [total, setTotal] = useState<number | null>(null)

  useEffect(() => {
    fetch("/api/raffle")
      .then((r) => r.json())
      .then((d) => typeof d?.total === "number" && setTotal(d.total))
      .catch(() => {})
  }, [done])

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError("")
    try {
      const res = await fetch("/api/raffle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, phone }),
      })
      const d = await res.json()
      if (!res.ok) {
        setError(d?.error || "تعذّر التسجيل — حاول مرة أخرى")
        return
      }
      setDone({ duplicate: Boolean(d.duplicate) })
    } catch {
      setError("تعذّر الاتصال — تأكد من الإنترنت وحاول مجدداً")
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="relative overflow-hidden rounded-3xl bg-brand-gradient text-white p-6 md:p-10">
      <div className="absolute -top-12 -right-12 w-44 h-44 rounded-full bg-[#ff8c42]/25 blur-3xl" />
      <div className="absolute -bottom-14 -left-10 w-52 h-52 rounded-full bg-emerald-400/15 blur-3xl" />

      <div className="relative grid md:grid-cols-2 gap-8 items-center">
        <div>
          <div className="inline-flex items-center gap-2 mb-3 bg-white/10 px-3 py-1.5 rounded-full text-sm font-semibold">
            <Gift className="w-4 h-4 text-[#ff8c42]" /> سحب Travel Hub
          </div>
          <h3 className="text-2xl md:text-3xl font-bold mb-2">سجّل وادخل السحب على جائزة الشهر 🎁</h3>
          <p className="text-white/75 text-sm max-w-md">
            اكتب اسمك ورقم واتسابك مرة واحدة وادخل السحب — الفائز يُعلن في قروب العروض على واتساب.
          </p>
          {total !== null && total > 0 && (
            <p className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-white/85 bg-white/10 px-3 py-1.5 rounded-full">
              <Users className="w-4 h-4 text-[#ff8c42]" /> {total.toLocaleString("en-US")} مشارك حتى الآن
            </p>
          )}
        </div>

        {done ? (
          <div className="bg-white/10 rounded-2xl p-6 text-center space-y-3">
            <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto" />
            <p className="font-bold text-lg">
              {done.duplicate ? "أنت مسجّل معنا مسبقاً 👌" : "تم تسجيلك في السحب 🎉"}
            </p>
            <p className="text-white/75 text-sm">تابع إعلان الفائز في قروب العروض:</p>
            <Button
              onClick={() => window.open(groupLink, "_blank")}
              className="bg-[#25D366] hover:bg-[#20BA5A] text-white rounded-xl h-11 px-6 font-bold w-full flex items-center justify-center gap-2"
            >
              <MessageCircle className="w-5 h-5" /> انضم لقروب الواتساب
            </Button>
          </div>
        ) : (
          <form onSubmit={submit} className="bg-white/10 rounded-2xl p-5 space-y-3">
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="الاسم الكامل"
              required
              minLength={2}
              maxLength={60}
              className="h-12 rounded-xl bg-white border-0 text-slate-800"
            />
            <Input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="رقم الواتساب (09xxxxxxxx)"
              required
              inputMode="tel"
              dir="ltr"
              className="h-12 rounded-xl bg-white border-0 text-slate-800 text-right"
            />
            {error && <p className="text-sm font-semibold text-amber-300">{error}</p>}
            <Button
              type="submit"
              disabled={busy}
              className="w-full h-12 rounded-xl bg-[#ff8c42] hover:bg-[#ff7a2e] text-white font-bold flex items-center justify-center gap-2"
            >
              {busy ? <Loader2 className="w-5 h-5 animate-spin" /> : <Gift className="w-5 h-5" />}
              {busy ? "جاري التسجيل..." : "سجّلني في السحب"}
            </Button>
            <p className="text-[11px] text-white/55 text-center">
              بالتسجيل توافق على تواصلنا معك بالعروض عبر واتساب. رقمك لا يُشارك مع أي جهة.
            </p>
          </form>
        )}
      </div>
    </div>
  )
}
