"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Gift, RefreshCw, Download, Trophy, Loader2, Lock } from "lucide-react"

interface Entry {
  name: string
  phone: string
  at: string
  wonAt?: string
}

export function RaffleAdmin() {
  const [key, setKey] = useState("")
  const [authed, setAuthed] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const [entries, setEntries] = useState<Entry[]>([])
  const [winners, setWinners] = useState<Entry[]>([])
  const [storage, setStorage] = useState("")
  const [justWon, setJustWon] = useState<Entry | null>(null)

  const load = async (k = key) => {
    setBusy(true)
    setError("")
    try {
      const res = await fetch("/api/raffle/admin", { headers: { "x-admin-key": k } })
      const d = await res.json()
      if (!res.ok) {
        setError(d?.error || "فشل التحميل")
        setAuthed(false)
        return
      }
      setEntries(d.entries || [])
      setWinners(d.winners || [])
      setStorage(d.storage || "")
      setAuthed(true)
    } catch {
      setError("تعذّر الاتصال")
    } finally {
      setBusy(false)
    }
  }

  const draw = async () => {
    if (!confirm("سحب فائز عشوائي الآن؟")) return
    setBusy(true)
    setJustWon(null)
    try {
      const res = await fetch("/api/raffle/admin", {
        method: "POST",
        headers: { "x-admin-key": key, "Content-Type": "application/json" },
        body: JSON.stringify({ action: "draw" }),
      })
      const d = await res.json()
      if (!res.ok) {
        setError(d?.error || "فشل السحب")
        return
      }
      setJustWon(d.winner)
      await load()
    } finally {
      setBusy(false)
    }
  }

  const exportCsv = () => {
    const rows = [["الاسم", "الرقم", "تاريخ التسجيل"], ...entries.map((e) => [e.name, `+${e.phone}`, e.at])]
    const csv = "﻿" + rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n")
    const a = document.createElement("a")
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }))
    a.download = `raffle-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
  }

  const fmt = (iso: string) => new Date(iso).toLocaleString("ar-SA", { dateStyle: "medium", timeStyle: "short" })

  if (!authed) {
    return (
      <div className="max-w-sm mx-auto mt-24 bg-white rounded-3xl shadow-card border border-slate-100 p-8 text-center space-y-4">
        <Lock className="w-10 h-10 text-[#ff8c42] mx-auto" />
        <h1 className="text-xl font-bold text-[#1e3a5f]">إدارة السحب</h1>
        <Input
          type="password"
          value={key}
          onChange={(e) => setKey(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && load()}
          placeholder="مفتاح الإدارة"
          className="h-12 rounded-xl text-center"
        />
        {error && <p className="text-sm font-semibold text-red-500">{error}</p>}
        <Button onClick={() => load()} disabled={busy || !key} className="w-full h-12 rounded-xl bg-[#1e3a5f] text-white font-bold">
          {busy ? <Loader2 className="w-5 h-5 animate-spin" /> : "دخول"}
        </Button>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto p-4 md:p-8 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-[#1e3a5f] flex items-center gap-2">
          <Gift className="w-6 h-6 text-[#ff8c42]" /> إدارة سحب Travel Hub
        </h1>
        <div className="flex items-center gap-2">
          <Button onClick={() => load()} disabled={busy} variant="outline" className="rounded-xl gap-1.5">
            <RefreshCw className={`w-4 h-4 ${busy ? "animate-spin" : ""}`} /> تحديث
          </Button>
          <Button onClick={exportCsv} disabled={!entries.length} variant="outline" className="rounded-xl gap-1.5">
            <Download className="w-4 h-4" /> CSV
          </Button>
          <Button onClick={draw} disabled={busy || !entries.length} className="rounded-xl bg-[#ff8c42] hover:bg-[#ff7a2e] text-white font-bold gap-1.5">
            <Trophy className="w-4 h-4" /> اسحب فائزاً
          </Button>
        </div>
      </div>

      {storage === "memory" && (
        <p className="text-sm bg-amber-50 border border-amber-200 text-amber-800 rounded-xl p-3">
          ⚠️ التخزين مؤقت (بلا قاعدة بيانات) — أضف تكامل Upstash Redis في Vercel ليُحفظ المشاركون دائماً.
        </p>
      )}

      {justWon && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-5 text-center">
          <Trophy className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
          <p className="font-bold text-emerald-800 text-lg">
            🎉 الفائز: {justWon.name} — <span dir="ltr">+{justWon.phone}</span>
          </p>
          <p className="text-sm text-emerald-700 mt-1">أعلنه في قروب الواتساب وتواصل معه لتسليم الجائزة</p>
        </div>
      )}

      {winners.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-card p-5">
          <h2 className="font-bold text-[#1e3a5f] mb-3">الفائزون السابقون ({winners.length})</h2>
          <div className="space-y-1.5 text-sm">
            {winners.map((w, i) => (
              <p key={i} className="text-slate-600">
                🏆 {w.name} — <span dir="ltr">+{w.phone}</span>
                {w.wonAt && <span className="text-slate-400"> · {fmt(w.wonAt)}</span>}
              </p>
            ))}
          </div>
        </div>
      )}

      <div className="bg-white rounded-2xl border border-slate-100 shadow-card overflow-hidden">
        <div className="p-5 border-b border-slate-100 font-bold text-[#1e3a5f]">المشاركون ({entries.length})</div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-500">
              <tr>
                <th className="text-right px-5 py-2.5 font-semibold">#</th>
                <th className="text-right px-5 py-2.5 font-semibold">الاسم</th>
                <th className="text-right px-5 py-2.5 font-semibold">الرقم</th>
                <th className="text-right px-5 py-2.5 font-semibold">التاريخ</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((e, i) => (
                <tr key={e.phone} className="border-t border-slate-50">
                  <td className="px-5 py-2.5 text-slate-400">{i + 1}</td>
                  <td className="px-5 py-2.5 font-medium text-slate-700">{e.name}</td>
                  <td className="px-5 py-2.5" dir="ltr">
                    +{e.phone}
                  </td>
                  <td className="px-5 py-2.5 text-slate-500">{fmt(e.at)}</td>
                </tr>
              ))}
              {!entries.length && (
                <tr>
                  <td colSpan={4} className="px-5 py-10 text-center text-slate-400">
                    لا مشاركين بعد
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
