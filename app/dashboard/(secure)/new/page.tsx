import { listAgents, usdRateFor } from "@/lib/dashboard-store"
import { TransactionForm } from "@/components/dashboard/transaction-form"
import { currentMonth } from "@/lib/dashboard-format"

export const dynamic = "force-dynamic"

export default async function NewTransactionPage() {
  const [agents, usd] = await Promise.all([
    listAgents().catch(() => []),
    usdRateFor(currentMonth()).catch(() => ({ rate: null, from: null, exact: false })),
  ])

  return (
    <section>
      <h1 className="mb-4 text-xl font-extrabold text-[#164563]">عملية جديدة</h1>
      <TransactionForm agents={agents} defaultUsdRate={usd.rate} />
    </section>
  )
}
