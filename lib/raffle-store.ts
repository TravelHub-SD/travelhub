// تخزين سحب الجوائز: Upstash Redis عبر REST (يُضبط من تكامل Vercel ← Upstash).
// بدون ضبط المتغيّرات يعمل بذاكرة مؤقتة — كافٍ للتجربة المحلية فقط.

const REDIS_URL = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL
const REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN

export interface RaffleEntry {
  name: string
  phone: string // بصيغة 2499XXXXXXXX
  at: string
  wonAt?: string
}

const g = globalThis as any
g.__raffleMem ||= { entries: new Map<string, RaffleEntry>(), winners: [] as RaffleEntry[] }

export const raffleConfigured = Boolean(REDIS_URL && REDIS_TOKEN)

async function redis(cmd: (string | number)[]): Promise<any> {
  const res = await fetch(REDIS_URL as string, {
    method: "POST",
    headers: { Authorization: `Bearer ${REDIS_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify(cmd),
    cache: "no-store",
  })
  if (!res.ok) throw new Error(`redis HTTP ${res.status}`)
  return (await res.json()).result
}

/** إضافة مشاركة — الرقم مفتاح فريد (لا تكرار). */
export async function addEntry(e: RaffleEntry): Promise<{ added: boolean; total: number }> {
  if (!raffleConfigured) {
    const added = !g.__raffleMem.entries.has(e.phone)
    if (added) g.__raffleMem.entries.set(e.phone, e)
    return { added, total: g.__raffleMem.entries.size }
  }
  const added = (await redis(["HSETNX", "raffle:entries", e.phone, JSON.stringify(e)])) === 1
  const total = ((await redis(["HLEN", "raffle:entries"])) as number) || 0
  return { added, total }
}

export async function entryCount(): Promise<number> {
  if (!raffleConfigured) return g.__raffleMem.entries.size
  return ((await redis(["HLEN", "raffle:entries"])) as number) || 0
}

export async function listEntries(): Promise<RaffleEntry[]> {
  if (!raffleConfigured) return [...g.__raffleMem.entries.values()]
  const flat = ((await redis(["HGETALL", "raffle:entries"])) as string[]) || []
  const out: RaffleEntry[] = []
  for (let i = 1; i < flat.length; i += 2) {
    try {
      out.push(JSON.parse(flat[i]))
    } catch {}
  }
  return out
}

export async function listWinners(): Promise<RaffleEntry[]> {
  if (!raffleConfigured) return g.__raffleMem.winners
  const arr = ((await redis(["LRANGE", "raffle:winners", 0, 100])) as string[]) || []
  return arr
    .map((s) => {
      try {
        return JSON.parse(s) as RaffleEntry
      } catch {
        return null
      }
    })
    .filter(Boolean) as RaffleEntry[]
}

/** سحب فائز عشوائي من غير الفائزين سابقاً، وتسجيله. */
export async function drawWinner(): Promise<RaffleEntry | null> {
  const [entries, winners] = await Promise.all([listEntries(), listWinners()])
  const won = new Set(winners.map((w) => w.phone))
  const pool = entries.filter((e) => !won.has(e.phone))
  if (!pool.length) return null
  const winner = { ...pool[Math.floor(Math.random() * pool.length)], wonAt: new Date().toISOString() }
  if (!raffleConfigured) g.__raffleMem.winners.unshift(winner)
  else await redis(["LPUSH", "raffle:winners", JSON.stringify(winner)])
  return winner
}
