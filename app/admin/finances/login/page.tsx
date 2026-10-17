import type { Metadata } from "next"
import { renderAdminLogin } from "@/components/admin/login-screen"

export const metadata: Metadata = {
  title: "دخول — منصرفاتي",
  robots: { index: false, follow: false, nocache: true },
}

export const dynamic = "force-dynamic"

export default async function FinanceLoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  return renderAdminLogin("finances", (await searchParams).next)
}
