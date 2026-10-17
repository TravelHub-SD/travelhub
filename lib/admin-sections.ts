/**
 * lib/admin-sections.ts
 * ─────────────────────────────────────────────────────────────
 * أقسام /admin التي تدخلها حسابات Supabase Auth.
 *
 * جلسة واحدة للأقسام كلها: من دخل أحدها دخلها جميعاً بلا كلمة مرور
 * ثانية. أمّا ما يُسمح له به فيقرّره كل قسم بدالته في القاعدة —
 * is_finance_owner للمالية الشخصية، is_approvals_staff للموافقات — ومعها
 * RLS على جداوله. الجلسة تقول «من أنت»، والقاعدة تقول «ماذا ترى».
 * ─────────────────────────────────────────────────────────────
 */

export type SectionKey = "finances" | "approvals"

export interface AdminSection {
  key: SectionKey
  title: string
  subtitle: string
  /** كل صفحات القسم تحته */
  base: string
  /** الصفحة الرئيسية بعد الدخول */
  home: string
  login: string
  /** مسارات الـ API تحته */
  api: string
  authApi: string
  /** دالة القاعدة التي تجيب: هل صاحب الجلسة من أهل هذا القسم؟ */
  accessRpc: string
  denied: string
}

export const SECTIONS: Record<SectionKey, AdminSection> = {
  finances: {
    key: "finances",
    title: "منصرفاتي",
    subtitle: "قسم شخصي — منفصل عن لوحة العمليات",
    base: "/admin/finances",
    home: "/admin/finances/personal",
    login: "/admin/finances/login",
    api: "/api/admin/finances",
    authApi: "/api/admin/finances/auth",
    accessRpc: "is_finance_owner",
    denied: "هذا الحساب غير مخوّل لقسم المنصرفات",
  },
  approvals: {
    key: "approvals",
    title: "الموافقات الأمنية",
    subtitle: "تسجيل الطلبات ومتابعتها وتحصيلها",
    base: "/admin/approvals",
    home: "/admin/approvals",
    login: "/admin/approvals/login",
    api: "/api/admin/approvals",
    authApi: "/api/admin/approvals/auth",
    accessRpc: "is_approvals_staff",
    denied: "هذا الحساب غير مخوّل لإدارة الموافقات",
  },
}

const within = (path: string, prefix: string) => path === prefix || path.startsWith(`${prefix}/`)

/** القسم الذي يخصّه مسار صفحة أو API — أو null إن لم يكن من أقسام /admin. */
export function sectionForPath(path: string): AdminSection | null {
  for (const s of Object.values(SECTIONS)) {
    if (within(path, s.base) || within(path, s.api)) return s
  }
  return null
}
