"use client"

/**
 * رسوم التحليلات — SVG مكتوب باليد، بلا مكتبة رسوم.
 *
 * مواصفات ثابتة: أعمدة ≤٢٤ بكسل بطرفٍ مدوّر ٤ وقاعدة مستقيمة، فجوة ٢ بكسل
 * بلون السطح بين المتلاصقات، شبكةٌ شعرية خافتة، رقمٌ على الأعلى وحده لا على
 * كل عمود، وتلميحٌ عند المرور أو اللمس أو التركيز بلوحة المفاتيح. وكل رقم
 * في التلميح موجودٌ أيضاً في «عرض كجدول» — التلميح يُضيف ولا يحجب.
 *
 * الزمن يجري يساراً→يميناً (dir=ltr داخل الرسم) كما في Excel الذي تُفتح فيه
 * الملفات المصدّرة؛ العناوين والتلميحات عربية.
 */

import { useEffect, useId, useRef, useState } from "react"
import type React from "react"
import { T } from "@/components/approvals/ui"

const SURFACE = "#0E1A28"
const GRID = "#1C2B3D"
const BASELINE = "#2A3B50"
const AXIS_INK = "#7D8EA3"
export const ACCENT = "#EF790F"
const ACCENT_HI = "#F7A04B"

function useWidth<E extends HTMLElement>(): [React.RefObject<E | null>, number] {
  const ref = useRef<E>(null)
  const [w, setW] = useState(0)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const ro = new ResizeObserver(([e]) => setW(Math.floor(e.contentRect.width)))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  return [ref, w]
}

/** سلّم محاور نظيف: 0، 50، 100، 150 — لا 0، 37، 74. */
function niceTicks(max: number, count = 4): number[] {
  if (max <= 0) return [0, 1]
  const raw = max / count
  const mag = 10 ** Math.floor(Math.log10(raw))
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw)!
  const top = Math.ceil(max / step) * step
  const ticks: number[] = []
  for (let v = 0; v <= top + step / 2; v += step) ticks.push(Number(v.toFixed(6)))
  return ticks
}

/** عمودٌ بطرفٍ علويّ مدوّر وقاعدةٍ مستقيمة. */
function columnPath(x: number, y: number, w: number, h: number, r = 4): string {
  const rr = Math.min(r, h, w / 2)
  return `M${x},${y + h}V${y + rr}Q${x},${y} ${x + rr},${y}H${x + w - rr}Q${x + w},${y} ${x + w},${y + rr}V${y + h}Z`
}

export interface Column {
  key: string
  /** على المحور — قصير */
  axis: string
  /** في التلميح والجدول — كامل */
  label: string
  value: number
  /** أسطرٌ إضافية في التلميح (توزيع الحالات مثلاً) */
  extra?: { label: string; value: string; color?: string }[]
}

export function ColumnChart({
  data,
  format,
  ariaLabel,
  height = 200,
  color = ACCENT,
  tableHead = ["الفترة", "القيمة"],
}: {
  data: Column[]
  format: (v: number) => string
  ariaLabel: string
  height?: number
  color?: string
  tableHead?: [string, string]
}) {
  const [box, width] = useWidth<HTMLDivElement>()
  const [active, setActive] = useState<number | null>(null)
  const tipId = useId()

  const max = Math.max(0, ...data.map((d) => d.value))
  const ticks = niceTicks(max)
  const top = ticks[ticks.length - 1] || 1
  const tickLabels = ticks.map(format)
  const left = Math.max(...tickLabels.map((t) => t.length)) * 6.6 + 10
  const m = { top: 18, right: 6, bottom: 26, left }
  const innerW = Math.max(0, width - m.left - m.right)
  const innerH = height - m.top - m.bottom
  const band = data.length ? innerW / data.length : 0
  const barW = Math.max(2, Math.min(24, band - 2))
  const y = (v: number) => m.top + innerH - (v / top) * innerH
  const every = Math.max(1, Math.ceil(data.length / Math.max(1, Math.floor(innerW / 52))))
  const peak = data.reduce((best, d, i) => (d.value > (data[best]?.value ?? -1) ? i : best), 0)

  const a = active !== null ? data[active] : null
  const tipX = active !== null ? m.left + band * active + band / 2 : 0

  return (
    <div>
      <div ref={box} dir="ltr" className="relative" style={{ height }}>
        {width > 0 && (
          <svg width={width} height={height} role="img" aria-label={ariaLabel} className="block select-none">
            {ticks.map((t, i) => (
              <g key={t}>
                <line x1={m.left} x2={width - m.right} y1={y(t)} y2={y(t)} stroke={i === 0 ? BASELINE : GRID} strokeWidth={1} />
                <text x={m.left - 8} y={y(t)} dy="0.32em" textAnchor="end" fontSize={11} fill={AXIS_INK} className="tabular-nums">
                  {tickLabels[i]}
                </text>
              </g>
            ))}

            {data.map((d, i) => {
              const h = Math.max(0, y(0) - y(d.value))
              const x = m.left + band * i + (band - barW) / 2
              const on = active === i
              return (
                <g key={d.key}>
                  {h > 0 && <path d={columnPath(x, y(d.value), barW, h)} fill={on ? ACCENT_HI : color} opacity={active === null || on ? 1 : 0.55} />}
                  {i === peak && d.value > 0 && active === null && (
                    <text x={x + barW / 2} y={y(d.value) - 6} textAnchor="middle" fontSize={11} fontWeight={700} fill="#EEF2F7">
                      {format(d.value)}
                    </text>
                  )}
                  {(data.length - 1 - i) % every === 0 && (
                    // الرسم LTR؛ عنوانٌ عربي («2–3 أيام») يحتاج اتجاهه هو وإلا انقلب
                    <text
                      x={m.left + band * i + band / 2}
                      y={height - 8}
                      textAnchor="middle"
                      fontSize={11}
                      fill={AXIS_INK}
                      direction={/[\u0600-\u06FF]/.test(d.axis) ? "rtl" : "ltr"}
                    >
                      {d.axis}
                    </text>
                  )}
                  {/* منطقة اللمس: عرض الشريحة كاملاً وارتفاع الرسم — أكبر من العمود */}
                  <rect
                    x={m.left + band * i}
                    y={m.top}
                    width={band}
                    height={innerH}
                    fill="transparent"
                    tabIndex={0}
                    aria-label={`${d.label}: ${format(d.value)}`}
                    aria-describedby={on ? tipId : undefined}
                    onPointerEnter={() => setActive(i)}
                    onPointerDown={() => setActive(i)}
                    onPointerLeave={() => setActive(null)}
                    onFocus={() => setActive(i)}
                    onBlur={() => setActive(null)}
                    className="cursor-pointer outline-none"
                  />
                </g>
              )
            })}
          </svg>
        )}

        {a && (
          <div
            id={tipId}
            role="tooltip"
            dir="rtl"
            className="pointer-events-none absolute z-10 min-w-[140px] rounded-xl bg-[#1A2A3E] px-3 py-2 text-xs shadow-2xl ring-1 ring-white/10"
            // بجانب العمود لا فوقه: التلميح لا يغطّي ما يصفه.
            style={tipX > width / 2 ? { right: width - tipX + barW / 2 + 10, top: 0 } : { left: tipX + barW / 2 + 10, top: 0 }}
          >
            <p className="text-base font-extrabold text-[#EEF2F7]">
              <bdi dir="ltr">{format(a.value)}</bdi>
            </p>
            <p className={`mb-1 ${T.muted}`}>{a.label}</p>
            {a.extra?.map((e) => (
              <p key={e.label} className="flex items-center justify-between gap-3">
                <span className={`flex items-center gap-1.5 ${T.sub}`}>
                  {e.color && <span aria-hidden className="h-0.5 w-3 rounded-full" style={{ background: e.color }} />}
                  {e.label}
                </span>
                <bdi dir="ltr" className="font-bold text-[#EEF2F7]">
                  {e.value}
                </bdi>
              </p>
            ))}
          </div>
        )}
      </div>

      <TableView head={tableHead} rows={data.map((d) => [d.label, format(d.value)])} />
    </div>
  )
}

/** كل رقمٍ في الرسم قابلٌ للقراءة بلا مرور ولا لون. */
export function TableView({ head, rows }: { head: string[]; rows: (string | number)[][] }) {
  return (
    <details className="group mt-2">
      <summary className={`cursor-pointer list-none text-[11px] font-bold ${T.muted} hover:text-[#A7B4C3]`}>
        <span className="group-open:hidden">عرض الأرقام كجدول</span>
        <span className="hidden group-open:inline">إخفاء الجدول</span>
      </summary>
      <div className="mt-2 max-h-64 overflow-auto rounded-xl ring-1 ring-white/[0.06]">
        <table className="w-full text-xs">
          <thead className="sticky top-0 bg-[#122236]">
            <tr>
              {head.map((h, i) => (
                <th key={h} className={`px-3 py-2 font-bold ${T.sub} ${i ? "text-left" : "text-right"}`}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} className="border-t border-white/[0.04]">
                {r.map((c, j) => (
                  <td key={j} className={`px-3 py-1.5 ${j ? "text-left font-bold tabular-nums text-[#EEF2F7]" : T.sub}`}>
                    {j ? <bdi dir="ltr">{c}</bdi> : c}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  )
}

export interface Segment {
  key: string
  label: string
  value: number
  color: string
  icon?: React.ReactNode
}

/** جزءٌ من كل: شريطٌ أفقي بفجوات ٢ بكسل، والأرقام في الدليل تحته لا داخله. */
export function StackedBar({ segments, ariaLabel }: { segments: Segment[]; ariaLabel: string }) {
  const total = segments.reduce((s, x) => s + x.value, 0)
  const [hover, setHover] = useState<string | null>(null)
  const pct = (v: number) => (total ? Math.round((v / total) * 100) : 0)
  return (
    <div>
      {/* الفجوة بلون سطح البطاقة: هي ما يفصل الأجزاء، لا حدودٌ مرسومة */}
      <div role="img" aria-label={ariaLabel} className="flex h-4 gap-[2px] overflow-hidden rounded-full" style={{ background: SURFACE }}>
        {total === 0 ? (
          <div className="h-full w-full rounded-full bg-white/[0.05]" />
        ) : (
          segments
            .filter((s) => s.value > 0)
            .map((s) => (
              <div
                key={s.key}
                title={`${s.label}: ${s.value} (${pct(s.value)}%)`}
                onPointerEnter={() => setHover(s.key)}
                onPointerLeave={() => setHover(null)}
                className="h-full transition-opacity"
                style={{ width: `${(s.value / total) * 100}%`, background: s.color, opacity: hover && hover !== s.key ? 0.4 : 1 }}
              />
            ))
        )}
      </div>
      <ul className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-4">
        {segments.map((s) => (
          <li
            key={s.key}
            onPointerEnter={() => setHover(s.key)}
            onPointerLeave={() => setHover(null)}
            className={`transition-opacity ${hover && hover !== s.key ? "opacity-50" : ""}`}
          >
            <p className={`flex items-center gap-1.5 text-xs font-bold ${T.sub}`}>
              <span aria-hidden className="h-2.5 w-2.5 rounded-[3px]" style={{ background: s.color }} />
              {s.icon}
              {s.label}
            </p>
            <p className="mt-0.5 flex items-baseline gap-1.5">
              <span className="text-xl font-extrabold text-[#EEF2F7]">{s.value}</span>
              <span className={`text-xs ${T.muted}`}>
                <bdi dir="ltr">{pct(s.value)}%</bdi>
              </span>
            </p>
          </li>
        ))}
      </ul>
    </div>
  )
}

/** نسبةٌ من حدّ: المسار درجةٌ خافتة من نفس اللون، فتُقرأ الحالة على الشريط كله. */
export function Meter({ value, label }: { value: number; label: string }) {
  const v = Math.max(0, Math.min(1, value))
  return (
    <div role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(v * 100)} aria-label={label} className="h-2 overflow-hidden rounded-full bg-[#EF790F]/20">
      <div className="h-full rounded-full bg-gradient-to-l from-[#F7A04B] to-[#EF790F]" style={{ width: `${v * 100}%` }} />
    </div>
  )
}

/** خطٌّ صغير بلون خافت، والنقطة الأخيرة (الحالية) بالبرتقالي. */
export function Sparkline({ values, ariaLabel }: { values: number[]; ariaLabel: string }) {
  const [box, width] = useWidth<HTMLDivElement>()
  const h = 36
  if (values.length < 2) return <div ref={box} style={{ height: h }} />
  const max = Math.max(...values)
  const min = Math.min(0, ...values)
  const span = max - min || 1
  const x = (i: number) => 4 + (i / (values.length - 1)) * Math.max(0, width - 8)
  const yy = (v: number) => 4 + (1 - (v - min) / span) * (h - 8)
  const pts = values.map((v, i) => `${x(i)},${yy(v)}`).join(" ")
  const last = values.length - 1
  return (
    <div ref={box} dir="ltr" style={{ height: h }}>
      {width > 0 && (
        <svg width={width} height={h} role="img" aria-label={ariaLabel} className="block">
          <polyline points={pts} fill="none" stroke="#3A4D66" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
          <circle cx={x(last)} cy={yy(values[last])} r={4} fill={ACCENT} stroke={SURFACE} strokeWidth={2} />
        </svg>
      )}
    </div>
  )
}
