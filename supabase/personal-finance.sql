-- ─────────────────────────────────────────────────────────────
-- المنصرفات الشخصية — /admin/finances/personal
--
-- على خلاف لوحة العمليات، هذه البيانات تخصّ شخصاً لا الوكالة. فالحماية
-- هنا ليست «مفتاح الخادم وحده يصل»، بل RLS حقيقي على auth.uid():
-- الصفحة تقرأ وتكتب بجلسة المستخدم نفسه (Supabase Auth)، لا بمفتاح
-- service_role، فقاعدة البيانات هي من يرفض أي صفٍّ ليس لصاحبه — حتى لو
-- أخطأ كود الموقع في فلتر.
--
-- وفوق ذلك قائمة مالكين: حسابٌ في Supabase Auth لا يكفي وحده. لو فُتح
-- التسجيل يوماً، فمن يُنشئ حساباً لا يرى صافي أرباح الوكالة ولا يكتب حرفاً.
--
-- يُطبَّق بعد dashboard-schema.sql وdashboard-protection.sql.
-- ─────────────────────────────────────────────────────────────

-- ── من يملك هذا القسم ────────────────────────────────────────
-- لا تُعدَّل من الموقع إطلاقاً: صفٌّ يُضاف من محرّر SQL لكل مالك.
--   insert into finance_owners (user_id)
--   select id from auth.users where email = '...';
create table if not exists finance_owners (
  user_id    uuid        primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table finance_owners enable row level security;
revoke all on finance_owners from anon, authenticated;

-- SECURITY DEFINER لأن finance_owners نفسها مغلقة أمام authenticated:
-- الدالة تجيب بنعم/لا عن المستدعي وحده، ولا تكشف من غيره في القائمة.
create or replace function is_finance_owner() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from finance_owners where user_id = (select auth.uid()))
$$;

revoke execute on function is_finance_owner() from public, anon;
grant  execute on function is_finance_owner() to authenticated;

-- ── التصنيفات ────────────────────────────────────────────────
create table if not exists expense_categories (
  id         uuid    primary key default gen_random_uuid(),
  name       text    not null unique check (length(btrim(name)) > 0),
  is_default boolean not null default false
);

alter table expense_categories enable row level security;
revoke all on expense_categories from anon, authenticated;
grant  select on expense_categories to authenticated;

drop policy if exists "owners read categories" on expense_categories;
create policy "owners read categories" on expense_categories
  for select to authenticated
  using ((select is_finance_owner()));

insert into expense_categories (name, is_default) values
  ('طعام ومشروبات',   true),
  ('مواصلات وبنزين',  true),
  ('جيم وصحة',        true),
  ('فواتير ومنزل',    true),
  ('نثريات وترفيه',   true)
on conflict (name) do nothing;

-- ── المنصرفات ────────────────────────────────────────────────
create table if not exists personal_expenses (
  id          uuid          primary key default gen_random_uuid(),
  date        date          not null default current_date,
  -- التصنيف لا يُحذف ما دامت عليه بنود: حذفه كان سيُيتّم تاريخ صرفٍ كامل.
  category_id uuid          not null references expense_categories (id) on delete restrict,
  -- بالجنيه السوداني وحده. numeric لا float: المبالغ تُجمع، والفاصلة
  -- العائمة تُراكم كسوراً لا وجود لها في الجيب.
  amount      numeric(14,2) not null check (amount > 0),
  note        text          check (note is null or length(note) <= 500),
  -- الافتراضي من الجلسة نفسها، فالموقع لا يرسل user_id أصلاً ولا يستطيع
  -- انتحال غيره. restrict لا cascade: حذف حساب الدخول بالغلط يجب أن
  -- يفشل، لا أن يأخذ معه سنةً من المنصرفات.
  user_id     uuid          not null default auth.uid() references auth.users (id) on delete restrict,
  created_at  timestamptz   not null default now()
);

create index if not exists personal_expenses_user_date_idx
  on personal_expenses (user_id, date desc, created_at desc);

alter table personal_expenses enable row level security;
revoke all on personal_expenses from anon, authenticated;
grant  select, insert, update, delete on personal_expenses to authenticated;

-- أربع سياسات لا واحدة بـ for all: لكلّ عملية شرطها الصريح، ويُقرأ
-- كلٌّ منها وحده. (select …) حول الدوال يجعلها تُحسب مرة للاستعلام
-- لا مرة لكل صف.
drop policy if exists "own expenses: read"   on personal_expenses;
drop policy if exists "own expenses: insert" on personal_expenses;
drop policy if exists "own expenses: update" on personal_expenses;
drop policy if exists "own expenses: delete" on personal_expenses;

create policy "own expenses: read" on personal_expenses
  for select to authenticated
  using ((select auth.uid()) = user_id and (select is_finance_owner()));

create policy "own expenses: insert" on personal_expenses
  for insert to authenticated
  with check ((select auth.uid()) = user_id and (select is_finance_owner()));

-- with check يمنع نقل بندٍ إلى مستخدم آخر بتعديل user_id.
create policy "own expenses: update" on personal_expenses
  for update to authenticated
  using      ((select auth.uid()) = user_id and (select is_finance_owner()))
  with check ((select auth.uid()) = user_id and (select is_finance_owner()));

create policy "own expenses: delete" on personal_expenses
  for delete to authenticated
  using ((select auth.uid()) = user_id and (select is_finance_owner()));

-- ── صافي أرباح الوكالة للفترة ────────────────────────────────
-- transactions مغلقة أمام authenticated (لا سياسات)، وهذا صحيح: لا نفتح
-- جدول العمليات لجلسة شخصية. الدالة تعيد رقماً واحداً — المجموع — ولمالكٍ
-- فقط، فلا يرى القسم الشخصي أي صفّ من عمليات الوكالة.
create or replace function finance_agency_net_profit(p_from date, p_to date) returns bigint
language plpgsql stable security definer set search_path = public as $$
begin
  if not (select is_finance_owner()) then
    raise exception 'غير مخوّل' using errcode = '42501';
  end if;
  return coalesce((select sum(net_profit) from transactions where date between p_from and p_to), 0)::bigint;
end $$;

revoke execute on function finance_agency_net_profit(date, date) from public, anon;
grant  execute on function finance_agency_net_profit(date, date) to authenticated;

-- ── الحماية من الضياع ────────────────────────────────────────
-- نفس طبقتَي جدول العمليات (انظر dashboard-protection.sql): كل تغيير
-- يُحفظ في dashboard_audit، والحذف الجماعي يُرفض. والنسخة الخارجية تلتقط
-- السجلّ تلقائياً.
drop trigger if exists personal_expenses_audit on personal_expenses;
create trigger personal_expenses_audit
  after insert or update or delete on personal_expenses
  for each row execute function dashboard_audit_row();

drop trigger if exists expense_categories_audit on expense_categories;
create trigger expense_categories_audit
  after insert or update or delete on expense_categories
  for each row execute function dashboard_audit_row();

drop trigger if exists personal_expenses_guard_delete on personal_expenses;
create trigger personal_expenses_guard_delete
  after delete on personal_expenses
  referencing old table as affected
  for each statement execute function dashboard_guard_bulk();

drop trigger if exists personal_expenses_guard_update on personal_expenses;
create trigger personal_expenses_guard_update
  after update on personal_expenses
  referencing old table as affected
  for each statement execute function dashboard_guard_bulk();
