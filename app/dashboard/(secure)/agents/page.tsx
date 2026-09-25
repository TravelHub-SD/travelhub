import { listAgents, type Agent } from "@/lib/dashboard-store"
import { AgentsManager } from "@/components/dashboard/agents-manager"

export const dynamic = "force-dynamic"

export default async function AgentsPage() {
  let agents: Agent[] = []
  let error = ""
  try {
    agents = await listAgents()
  } catch (e) {
    error = e instanceof Error ? e.message : String(e)
  }

  return (
    <div className="space-y-3">
      <h1 className="text-xl font-extrabold text-[#164563]">الوكلاء</h1>
      <p className="text-xs text-slate-500">
        الوكيل المعطّل يختفي من فورم العملية الجديدة، وتبقى عملياته السابقة في السجل والتقارير.
      </p>

      {error && (
        <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
          {error}
        </p>
      )}

      <AgentsManager agents={agents} />
    </div>
  )
}
