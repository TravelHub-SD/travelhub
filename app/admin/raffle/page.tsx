import type { Metadata } from "next"
import { RaffleAdmin } from "@/components/raffle-admin"

// صفحة إدارة داخلية — لا تُفهرس
export const metadata: Metadata = {
  title: "إدارة السحب",
  robots: { index: false, follow: false },
}

export default function RaffleAdminPage() {
  return (
    <main dir="rtl" className="min-h-screen bg-slate-50 text-slate-800">
      <RaffleAdmin />
    </main>
  )
}
