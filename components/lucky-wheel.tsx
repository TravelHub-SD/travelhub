"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Gift, MessageCircle, CheckCircle2, Users, Loader2, Instagram, Music2, Check } from "lucide-react"

interface LuckyWheelProps {
  groupLink: string
  tiktokUrl: string
  instagramUrl: string
}

interface Participant {
  name: string
}

const SEGMENT_COLORS = ["#1e3a5f", "#ff8c42", "#25506f", "#ff7a2e", "#2c5282", "#e8792f"]

export function LuckyWheel({ groupLink, tiktokUrl, instagramUrl }: LuckyWheelProps) {
  // بوابة الشروط
  const [followedTiktok, setFollowedTiktok] = useState(false)
  const [followedInsta, setFollowedInsta] = useState(false)
  const [joinedGroup, setJoinedGroup] = useState(false)
  const allDone = followedTiktok && followedInsta && joinedGroup

  const [names, setNames] = useState<Participant[]>([])
  const [total, setTotal] = useState(0)
  const [name, setName] = useState("")
  const [phone, setPhone] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const [done, setDone] = useState<null | { duplicate: boolean }>(null)
  const [spinning, setSpinning] = useState(false)
  const [angle, setAngle] = useState(0)

  const loadNames = () =>
    fetch("/api/raffle/names")
      .then((r) => r.json())
      .then((d) => {
        if (Array.isArray(d?.names)) setNames(d.names)
        if (typeof d?.total === "number") setTotal(d.total)
      })
      .catch(() => {})

  useEffect(() => {
    loadNames()
    const t = setInterval(loadNames, 15000)
    return () => clearInterval(t)
  }, [])

  // شرائح العجلة: الأسماء الحقيقية أو أسماء توضيحية إن لم يوجد مشاركون بعد
  const segments = useMemo(() => {
    const base = names.length ? names.map((n) => n.name) : ["كن أول مشارك!", "سجّل الآن", "احجز واربح", "🎁", "Travel Hub", "بالتوفيق"]
    return base.slice(0, 16)
  }, [names])

  const spin = () => {
    if (spinning || !segments.length) return
    setSpinning(true)
    const turns = 5 + Math.random() * 3
    setAngle((a) => a + turns * 360)
    setTimeout(() => setSpinning(false), 4200)
  }

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
      setName("")
      setPhone("")
      loadNames()
      spin()
    } catch {
      setError("تعذّر الاتصال — تأكد من الإنترنت")
    } finally {
      setBusy(false)
    }
  }

  const size = 300
  const r = size / 2
  const step = 360 / segments.length

  return (
    <div className="relative overflow-hidden rounded-3xl bg-brand-gradient text-white p-6 md:p-10">
      <div className="absolute -top-12 -right-12 w-44 h-44 rounded-full bg-[#ff8c42]/25 blur-3xl" />
      <div className="absolute -bottom-14 -left-10 w-52 h-52 rounded-full bg-emerald-400/15 blur-3xl" />

      <div className="relative text-center mb-8">
        <div className="inline-flex items-center gap-2 mb-3 bg-white/10 px-3 py-1.5 rounded-full text-sm font-semibold">
          <Gift className="w-4 h-4 text-[#ff8c42]" /> عجلة حظ Travel Hub
        </div>
        <h3 className="text-2xl md:text-3xl font-bold">شارك في السحب على جائزة الشهر 🎁</h3>
        <p className="text-white/75 text-sm mt-2 max-w-lg mx-auto">
          سجّل اسمك ورقمك، شوف اسمك يدخل العجلة مع بقية المشاركين، والفائز يُعلن في قروب الواتساب.
        </p>
      </div>

      <div className="relative grid lg:grid-cols-2 gap-10 items-center">
        {/* العجلة */}
        <div className="flex flex-col items-center">
          <div className="relative" style={{ width: size, height: size }}>
            {/* المؤشّر */}
            <div className="absolute -top-1 left-1/2 -translate-x-1/2 z-10 w-0 h-0 border-l-[12px] border-r-[12px] border-t-[20px] border-l-transparent border-r-transparent border-t-[#ff8c42] drop-shadow" />
            <svg
              width={size}
              height={size}
              viewBox={`0 0 ${size} ${size}`}
              style={{ transform: `rotate(${angle}deg)`, transition: "transform 4s cubic-bezier(0.18,0.9,0.25,1)" }}
              className="drop-shadow-2xl"
            >
              {segments.map((label, i) => {
                const a0 = (i * step - 90) * (Math.PI / 180)
                const a1 = ((i + 1) * step - 90) * (Math.PI / 180)
                const x0 = r + r * Math.cos(a0)
                const y0 = r + r * Math.sin(a0)
                const x1 = r + r * Math.cos(a1)
                const y1 = r + r * Math.sin(a1)
                const mid = (i * step + step / 2 - 90) * (Math.PI / 180)
                const tx = r + r * 0.62 * Math.cos(mid)
                const ty = r + r * 0.62 * Math.sin(mid)
                return (
                  <g key={i}>
                    <path
                      d={`M${r},${r} L${x0},${y0} A${r},${r} 0 0,1 ${x1},${y1} Z`}
                      fill={SEGMENT_COLORS[i % SEGMENT_COLORS.length]}
                      stroke="rgba(255,255,255,0.25)"
                      strokeWidth="1"
                    />
                    <text
                      x={tx}
                      y={ty}
                      fill="#fff"
                      fontSize={segments.length > 10 ? 9 : 11}
                      fontWeight="700"
                      textAnchor="middle"
                      dominantBaseline="middle"
                      transform={`rotate(${i * step + step / 2}, ${tx}, ${ty})`}
                    >
                      {label.length > 12 ? label.slice(0, 11) + "…" : label}
                    </text>
                  </g>
                )
              })}
              <circle cx={r} cy={r} r="26" fill="#fff" />
              <circle cx={r} cy={r} r="26" fill="none" stroke="#ff8c42" strokeWidth="3" />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <span className="text-[#ff8c42] font-extrabold text-xs">HUB</span>
            </div>
          </div>
          <button
            onClick={spin}
            disabled={spinning}
            className="mt-5 px-6 h-11 rounded-full bg-white/10 hover:bg-white/20 text-white text-sm font-bold transition disabled:opacity-60"
          >
            {spinning ? "تدور..." : "لِفّ العجلة 🎡"}
          </button>
          {total > 0 && (
            <p className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-white/85 bg-white/10 px-3 py-1.5 rounded-full">
              <Users className="w-4 h-4 text-[#ff8c42]" /> {total.toLocaleString("en-US")} مشارك في العجلة
            </p>
          )}
        </div>

        {/* الشروط + النموذج */}
        <div>
          {done ? (
            <div className="bg-white/10 rounded-2xl p-6 text-center space-y-3">
              <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto" />
              <p className="font-bold text-lg">{done.duplicate ? "أنت مشارك معنا مسبقاً 👌" : "تم إدخالك العجلة 🎉"}</p>
              <p className="text-white/75 text-sm">اسمك الآن على العجلة — تابع إعلان الفائز في القروب.</p>
              <Button
                onClick={() => window.open(groupLink, "_blank")}
                className="bg-[#25D366] hover:bg-[#20BA5A] text-white rounded-xl h-11 px-6 font-bold w-full flex items-center justify-center gap-2"
              >
                <MessageCircle className="w-5 h-5" /> قروب الواتساب
              </Button>
              <button onClick={() => setDone(null)} className="text-white/60 text-xs hover:text-white/90 underline">
                إدخال مشارك آخر
              </button>
            </div>
          ) : (
            <div className="bg-white/10 rounded-2xl p-5 space-y-4">
              {/* بوابة الشروط */}
              <div>
                <p className="font-bold text-sm mb-2.5">أكمل الشروط للمشاركة:</p>
                <div className="space-y-2">
                  {[
                    { done: followedTiktok, set: setFollowedTiktok, url: tiktokUrl, icon: Music2, label: "تابعنا على تيك توك" },
                    { done: followedInsta, set: setFollowedInsta, url: instagramUrl, icon: Instagram, label: "تابعنا على إنستقرام" },
                    { done: joinedGroup, set: setJoinedGroup, url: groupLink, icon: MessageCircle, label: "انضم لقروب الواتساب" },
                  ].map((c, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => {
                        window.open(c.url, "_blank")
                        c.set(true)
                      }}
                      className={`w-full flex items-center gap-3 rounded-xl p-3 text-sm font-semibold transition text-right ${
                        c.done ? "bg-emerald-500/20 border border-emerald-400/40" : "bg-white/10 hover:bg-white/15 border border-transparent"
                      }`}
                    >
                      <span className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${c.done ? "bg-emerald-500" : "bg-white/20"}`}>
                        {c.done ? <Check className="w-4 h-4 text-white" /> : <c.icon className="w-3.5 h-3.5 text-white" />}
                      </span>
                      <span className="flex-1">{c.label}</span>
                      {!c.done && <span className="text-xs text-white/60">اضغط ↗</span>}
                    </button>
                  ))}
                </div>
              </div>

              {/* النموذج */}
              <form onSubmit={submit} className={`space-y-3 transition ${allDone ? "opacity-100" : "opacity-50 pointer-events-none"}`}>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="الاسم الكامل"
                  required
                  minLength={2}
                  maxLength={60}
                  disabled={!allDone}
                  className="h-12 rounded-xl bg-white border-0 text-slate-800"
                />
                <Input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="رقم الواتساب (09xxxxxxxx)"
                  required
                  inputMode="tel"
                  dir="ltr"
                  disabled={!allDone}
                  className="h-12 rounded-xl bg-white border-0 text-slate-800 text-right"
                />
                {error && <p className="text-sm font-semibold text-amber-300">{error}</p>}
                <Button
                  type="submit"
                  disabled={busy || !allDone}
                  className="w-full h-12 rounded-xl bg-[#ff8c42] hover:bg-[#ff7a2e] text-white font-bold flex items-center justify-center gap-2"
                >
                  {busy ? <Loader2 className="w-5 h-5 animate-spin" /> : <Gift className="w-5 h-5" />}
                  {allDone ? "أدخلني العجلة" : "أكمل الشروط أولاً"}
                </Button>
              </form>
              <p className="text-[11px] text-white/55 text-center">
                بالتسجيل توافق على تواصلنا معك بالعروض عبر واتساب. رقمك لا يُشارك مع أي جهة.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
