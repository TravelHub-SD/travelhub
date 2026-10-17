import { loginRoute, logoutRoute } from "@/lib/admin-auth"

export const dynamic = "force-dynamic"

export const POST = loginRoute("finances")
export const DELETE = logoutRoute
