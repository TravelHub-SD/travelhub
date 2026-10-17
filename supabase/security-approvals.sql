-- ─────────────────────────────────────────────────────────────
-- الموافقات الأمنية — /admin/approvals
--
-- كانت في ملف HTML يحفظ في localStorage: بيانات تعيش في متصفح واحد،
-- تضيع بمسح بياناته، ولا تُرى من جهاز آخر. هنا تصير جدولاً في القاعدة
-- بنفس حماية بقيّة اللوحات: سجلّ تغييرات، وحاجز حذف جماعي، ونسخة خارجية.
--
-- الأمان كقسم المنصرفات: الصفحة تقرأ وتكتب بجلسة المستخدم (Supabase
-- Auth)، وRLS يقرّر. لكن البيانات هنا **للفريق** لا لشخص: كل من في
-- approvals_staff يرى كل الطلبات ويعدّلها — موظفٌ يسجّل طلباً يراه صاحب
-- الوكالة. المالية الشخصية تبقى في قسمها ولا يراها هذا الجدول.
--
-- فيه بيانات شخصية لعملاء (أسماء، أرقام جوازات وهواتف): لا يصل الجدول
-- anon إطلاقاً، ولا أي حساب خارج القائمة.
--
-- يُطبَّق بعد dashboard-protection.sql (يستعمل دوال السجلّ والحاجز).
-- ─────────────────────────────────────────────────────────────

-- ── من يدير الموافقات ────────────────────────────────────────
-- صفٌّ لكل حساب، من محرّر SQL:
--   insert into approvals_staff (user_id)
--   select id from auth.users where email = '...';
create table if not exists approvals_staff (
  user_id    uuid        primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table approvals_staff enable row level security;
revoke all on approvals_staff from anon, authenticated;

create or replace function is_approvals_staff() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from approvals_staff where user_id = (select auth.uid()))
$$;

revoke execute on function is_approvals_staff() from public, anon;
grant  execute on function is_approvals_staff() to authenticated;

-- ── الطلبات ──────────────────────────────────────────────────
create table if not exists security_approvals (
  id           uuid          primary key default gen_random_uuid(),
  full_name    text          not null check (length(btrim(full_name)) between 2 and 200),
  -- لا قيد صيغة: البيانات الحالية تستعمل أرقاماً تسلسلية لا أرقام جوازات،
  -- ورفضها كان سيمنع نقلها. ولا تفرّد: المسافر نفسه قد يتقدّم مرّتين.
  passport_no  text          not null check (length(btrim(passport_no)) between 1 and 30),
  phone        text          check (phone is null or length(phone) <= 30),
  -- نصٌّ حر لا مرجع لجدول agents: الجهات هنا («تايغر»، «تيك توك»،
  -- «كوك») ليست وكلاء اللوحة، وبعضها قناةٌ لا شخص.
  agent        text          not null default 'مباشر' check (length(btrim(agent)) between 1 and 100),
  apply_date   date          not null,
  status       text          not null default 'قيد الإجراء',
  approval_ref text          check (approval_ref is null or length(approval_ref) <= 60),
  -- بالدولار. numeric لا float: المبالغ تُجمع.
  sale_price   numeric(12,2) not null default 0 check (sale_price >= 0),
  cost_price   numeric(12,2) not null default 0 check (cost_price >= 0),
  paid_amount  numeric(12,2) not null default 0 check (paid_amount >= 0),
  notes        text          check (notes is null or length(notes) <= 1000),
  -- معرّف السجلّ في الأداة القديمة: يجعل الاستيراد آمناً للتكرار —
  -- نفس الملف مرتين لا يكرّر طلباً.
  legacy_id    text          unique,
  -- من أنشأ الطلب، من الجلسة نفسها. لا يُمنح عمودٌ للكتابة أصلاً (انظر
  -- الصلاحيات تحت)، فلا يمكن انتحال غيرك لا عند الإضافة ولا بالتعديل.
  created_by   uuid          default auth.uid() references auth.users (id) on delete set null,
  created_at   timestamptz   not null default now(),
  updated_at   timestamptz   not null default now(),

  constraint security_approvals_status_valid check (
    status in ('قيد الإجراء', 'صدرت الموافقة', 'تم التسليم', 'مرفوضة')
  ),
  -- المدفوع لا يتجاوز السعر. الأداة القديمة قبلته فظهر «متبقٍّ» سالب
  -- ينقص من مجموع المتبقي عند العملاء بصمت.
  constraint security_approvals_paid_within_price check (paid_amount <= sale_price)
);

-- الربح والمتبقي لا يُخزَّنان: الأداة القديمة خزّنتهما مع السعر فتخلّفا
-- عنه عند تغيير الحالة السريع. يُحسبان عند العرض من السعر والتكلفة
-- والمدفوع، فلا يختلفان عنها أبداً.

create index if not exists security_approvals_date_idx
  on security_approvals (apply_date desc, created_at desc);

create or replace function security_approvals_touch() returns trigger
language plpgsql set search_path = public as $$
begin
  new.updated_at := now();
  return new;
end $$;
revoke execute on function security_approvals_touch() from public, anon, authenticated;

drop trigger if exists security_approvals_touch on security_approvals;
create trigger security_approvals_touch
  before update on security_approvals
  for each row execute function security_approvals_touch();

-- ── الصلاحيات ────────────────────────────────────────────────
-- على مستوى العمود: الإضافة والتعديل لأعمدة البيانات وحدها. id
-- وcreated_by وcreated_at وupdated_at تملؤها القاعدة ولا يكتبها أحد.
-- legacy_id يُكتب عند الإضافة (الاستيراد) ولا يُعدَّل بعدها.
alter table security_approvals enable row level security;
revoke all on security_approvals from anon, authenticated;
grant select, delete on security_approvals to authenticated;
grant insert (full_name, passport_no, phone, agent, apply_date, status, approval_ref,
              sale_price, cost_price, paid_amount, notes, legacy_id)
  on security_approvals to authenticated;
grant update (full_name, passport_no, phone, agent, apply_date, status, approval_ref,
              sale_price, cost_price, paid_amount, notes)
  on security_approvals to authenticated;

drop policy if exists "staff: read"   on security_approvals;
drop policy if exists "staff: insert" on security_approvals;
drop policy if exists "staff: update" on security_approvals;
drop policy if exists "staff: delete" on security_approvals;

create policy "staff: read" on security_approvals
  for select to authenticated using ((select is_approvals_staff()));
create policy "staff: insert" on security_approvals
  for insert to authenticated with check ((select is_approvals_staff()));
create policy "staff: update" on security_approvals
  for update to authenticated
  using ((select is_approvals_staff())) with check ((select is_approvals_staff()));
create policy "staff: delete" on security_approvals
  for delete to authenticated using ((select is_approvals_staff()));

-- ── الحماية من الضياع ────────────────────────────────────────
drop trigger if exists security_approvals_audit on security_approvals;
create trigger security_approvals_audit
  after insert or update or delete on security_approvals
  for each row execute function dashboard_audit_row();

drop trigger if exists security_approvals_guard_delete on security_approvals;
create trigger security_approvals_guard_delete
  after delete on security_approvals
  referencing old table as affected
  for each statement execute function dashboard_guard_bulk();

drop trigger if exists security_approvals_guard_update on security_approvals;
create trigger security_approvals_guard_update
  after update on security_approvals
  referencing old table as affected
  for each statement execute function dashboard_guard_bulk();
