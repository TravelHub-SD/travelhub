import { Suspense } from "react"
import { listAgents, listTransactions, type Transaction } from "@/lib/dashboard-store"
import { money } from "@/lib/dashboard-format"
import { TransactionFilters } from "@/components/dashboard/transaction-filters"
import { TransactionsList } from "@/components/dashboard/transactions-list"

export const dynamic = "force-dynamic"

type Params = {
  from?: string
  to?: string
  service_type?: string
  source?: string
  agent_id?: string
}

export default async function TransactionsPage({ searchParams }: { searchParams: Promise<Params> }) {
  const p = await searchParams

  const [agents, result] = await Promise.all([
    listAgents().catch(() => []),
    listTransactions({
      from: p.from || undefined,
      to: p.to || undefined,
      service_type: p.service_type || undefined,
      source: p.source || undefined,
      agent_id: p.agent_id ? Number(p.agent_id) : undefined,
    })
      .then((rows) => ({ rows, error: "" }))
      .catch((e) => ({ rows: [] as Transaction[], error: e instanceof Error ? e.message : String(e) })),
  ])

  const total = result.rows.reduce((s, r) => s + r.net_profit, 0)

  return (
    <div className="space-y-3">
      <div className="flex items-baseline justify-between gap-2">
        <h1 className="text-xl font-extrabold text-[#164563]">سجل العمليات</h1>
        <p className="text-xs text-slate-500">
          {money(result.rows.length)} عملية · صافي{" "}
          <span className="font-bold tabular-nums text-[#164563]">{money(total)}</span>
        </p>
      </div>

      <Suspense fallback={null}>
        <TransactionFilters agents={agents} />
      </Suspense>

      {result.error && (
        <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
          {result.error}
        </p>
      )}

      <TransactionsList rows={result.rows} agents={agents} />
    </div>
  )
}
