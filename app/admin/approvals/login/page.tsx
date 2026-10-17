import type { Metadata, Viewport } from "next"
import { renderAdminLogin } from "@/components/admin/login-screen"

export const metadata: Metadata = {
  title: "دخول — الموافقات الأمنية",
  robots: { index: false, follow: false, nocache: true },
}

export const viewport: Viewport = { themeColor: "#07111C" }

export const dynamic = "force-dynamic"

export default async function ApprovalsLoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  return renderAdminLogin("approvals", (await searchParams).next)
}
