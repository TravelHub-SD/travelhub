import { listAgents } from "@/lib/dashboard-store"
import { TransactionForm } from "@/components/dashboard/transaction-form"

export const dynamic = "force-dynamic"

export default async function NewTransactionPage() {
  const agents = await listAgents().catch(() => [])

  return (
    <section>
      <h1 className="mb-4 text-xl font-extrabold text-[#164563]">عملية جديدة</h1>
      <TransactionForm agents={agents} />
    </section>
  )
}
