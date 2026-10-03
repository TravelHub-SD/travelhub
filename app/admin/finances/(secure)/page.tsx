import { redirect } from "next/navigation"

export default function FinancesIndex() {
  redirect("/admin/finances/personal")
}
