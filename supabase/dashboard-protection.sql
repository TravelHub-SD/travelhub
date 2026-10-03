-- ─────────────────────────────────────────────────────────────
-- حماية بيانات اللوحة من الضياع
--
-- كُتب هذا بعد حادثة حقيقية: أمر `delete from transactions;` بلا شرط
-- شُغِّل على قاعدة الإنتاج، فمحا ٣٥ عملية مسجّلة. لم تكن القاعدة على
-- خطة فيها نسخ احتياطية يملكها المستخدم، فما عادت الصفوف.
--
-- الدرس أن النيّة الحسنة ليست حمايةً. فهنا ثلاث طبقات تعمل في
-- القاعدة نفسها، فتسري على كل من يكتب فيها — الموقع، أو أداة إدارة،
-- أو وكيل ذكاء اصطناعي، أو صاحب القاعدة نفسه:
--
--   ① سجلّ تغييرات لا يُمسّ  — كل إضافة وتعديل وحذف تُحفظ نسختها.
--   ② حاجز العمليات الجماعية — جملة تمسّ أكثر من ٥ صفوف تُرفض.
--   ③ دالة استرجاع            — إرجاع المحذوف باستدعاء واحد.
--
-- ما لا تحميه هذه الطبقات: فقدان مشروع Supabase نفسه. لذلك تبقى
-- النسخة الخارجية اليومية ضرورية — انظر .github/workflows/backup.yml
-- ─────────────────────────────────────────────────────────────

-- ── ① سجلّ التغييرات ─────────────────────────────────────────
-- صفٌّ لكل تغيير، ومعه الصف كاملاً كـ jsonb. نحفظ الصورة **السابقة**
-- في التعديل والحذف، والصورة الجديدة في الإضافة — فيُعاد بناء أي حالة
-- سابقة من هذا الجدول وحده.
create table if not exists dashboard_audit (
  audit_id   bigint generated always as identity primary key,
  table_name text        not null,
  action     text        not null check (action in ('insert', 'update', 'delete')),
  row_key    text        not null,
  row_data   jsonb       not null,
  acted_at   timestamptz not null default now(),
  acted_by   text        not null default current_user
);

create index if not exists dashboard_audit_lookup_idx
  on dashboard_audit (table_name, row_key, audit_id desc);
create index if not exists dashboard_audit_time_idx
  on dashboard_audit (acted_at desc);

alter table dashboard_audit enable row level security;

create or replace function dashboard_audit_row() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  snapshot jsonb;
begin
  -- الحذف والتعديل يحفظان ما كان، لا ما صار: ما كان هو وحده غير القابل
  -- للاستعادة من أي مكان آخر.
  snapshot := case when tg_op = 'INSERT' then to_jsonb(new) else to_jsonb(old) end;

  insert into dashboard_audit (table_name, action, row_key, row_data)
  values (
    tg_table_name,
    lower(tg_op),
    -- transactions و agents مفتاحهما id، و usd_rates مفتاحه month
    coalesce(snapshot->>'id', snapshot->>'month', '?'),
    snapshot
  );
  return null;  -- مشغّل AFTER: القيمة المرجعة مهملة
end $$;

drop trigger if exists transactions_audit on transactions;
create trigger transactions_audit
  after insert or update or delete on transactions
  for each row execute function dashboard_audit_row();

drop trigger if exists agents_audit on agents;
create trigger agents_audit
  after insert or update or delete on agents
  for each row execute function dashboard_audit_row();

drop trigger if exists usd_rates_audit on usd_rates;
create trigger usd_rates_audit
  after insert or update or delete on usd_rates
  for each row execute function dashboard_audit_row();

-- السجلّ نفسه لا يُعدَّل ولا يُحذف منه، وإلا كان حاجزاً يُزال بسطر.
-- للتقليم المتعمَّد بعد سنوات: set local travelhub.audit_prune = 'on';
create or replace function dashboard_audit_immutable() returns trigger
language plpgsql set search_path = public as $$
begin
  if coalesce(current_setting('travelhub.audit_prune', true), 'off') = 'on' then
    return null;
  end if;
  raise exception 'سجلّ التغييرات للقراءة فقط — لا يُعدَّل ولا يُحذف منه';
end $$;

drop trigger if exists dashboard_audit_locked on dashboard_audit;
create trigger dashboard_audit_locked
  before update or delete on dashboard_audit
  for each statement execute function dashboard_audit_immutable();

-- ── ② حاجز العمليات الجماعية ─────────────────────────────────
-- الوكالة تسجّل عملية واحدة في المرة وتصحّح واحدة في المرة. فجملةٌ
-- تمسّ عشرات الصفوف ليست عملاً يومياً، بل غلطةٌ في ٩٩٪ من الحالات —
-- وهي بالضبط شكل الغلطة التي محت البيانات.
--
-- الحاجز على مستوى الجملة لا الصف: يرى عدد الصفوف المتأثّرة كلها
-- ويُجهض الجملة قبل أن تُثبَّت. ولأنه في القاعدة، لا يفرق بين من
-- أطلق الجملة — الموقع أو سطر أوامر أو وكيل.
--
-- للتنفيذ المتعمَّد (تقليم أرشيف، ترحيل):
--   begin;
--   set local travelhub.allow_bulk = 'on';
--   delete from transactions where date < '2024-01-01';
--   commit;
create or replace function dashboard_guard_bulk() returns trigger
language plpgsql set search_path = public as $$
declare
  affected_rows integer;
  cap integer := coalesce(nullif(current_setting('travelhub.bulk_cap', true), '')::integer, 5);
begin
  if coalesce(current_setting('travelhub.allow_bulk', true), 'off') = 'on' then
    return null;
  end if;

  select count(*) into affected_rows from affected;

  if affected_rows > cap then
    raise exception
      'عملية جماعية مرفوضة: الجملة تمسّ % صفاً من %، والحدّ %. إن كان هذا مقصوداً: set local travelhub.allow_bulk = ''on''; داخل transaction.',
      affected_rows, tg_table_name, cap;
  end if;
  return null;
end $$;

drop trigger if exists transactions_guard_delete on transactions;
create trigger transactions_guard_delete
  after delete on transactions
  referencing old table as affected
  for each statement execute function dashboard_guard_bulk();

drop trigger if exists transactions_guard_update on transactions;
create trigger transactions_guard_update
  after update on transactions
  referencing old table as affected
  for each statement execute function dashboard_guard_bulk();

drop trigger if exists agents_guard_delete on agents;
create trigger agents_guard_delete
  after delete on agents
  referencing old table as affected
  for each statement execute function dashboard_guard_bulk();

drop trigger if exists agents_guard_update on agents;
create trigger agents_guard_update
  after update on agents
  referencing old table as affected
  for each statement execute function dashboard_guard_bulk();

-- ── ③ الاسترجاع ──────────────────────────────────────────────
-- حمايةٌ لا يُعرف كيف يُستعمل منها شيء ليست حماية. فالاسترجاع
-- استدعاءٌ واحد يرجّع كل ما حُذف بعد لحظةٍ معيّنة:
--
--   select dashboard_restore_transactions('2026-09-27 21:00+00');
--
-- يُبقي المعرّفات الأصلية (overriding system value) فلا تتبدّل الإشارات
-- إليها، ويتجاهل صفّاً موجوداً أصلاً فتكرار الاستدعاء بلا ضرر.
create or replace function dashboard_restore_transactions(since timestamptz)
returns integer
language plpgsql security definer set search_path = public as $$
declare
  restored integer;
begin
  with latest as (
    -- آخر صورة محفوظة لكل صفّ محذوف: الصفّ قد يكون عُدِّل قبل حذفه
    select distinct on (row_key) row_data
    from dashboard_audit
    where table_name = 'transactions' and action = 'delete' and acted_at >= since
    order by row_key, audit_id desc
  ), missing as (
    select row_data from latest l
    where not exists (
      select 1 from transactions t where t.id = (l.row_data->>'id')::bigint
    )
  )
  insert into transactions (
    id, date, service_type, source, agent_id, quantity,
    agent_profit, net_profit, direct_source, usd_rate, note, created_at
  )
  overriding system value
  select (row_data->>'id')::bigint,
         (row_data->>'date')::date,
         row_data->>'service_type',
         row_data->>'source',
         nullif(row_data->>'agent_id', '')::bigint,
         (row_data->>'quantity')::integer,
         (row_data->>'agent_profit')::bigint,
         (row_data->>'net_profit')::bigint,
         row_data->>'direct_source',
         nullif(row_data->>'usd_rate', '')::bigint,
         row_data->>'note',
         (row_data->>'created_at')::timestamptz
  from missing;

  get diagnostics restored = row_count;

  -- المتتالية تتخلّف عن المعرّفات المرجَعة، فأول إضافة بعد الاسترجاع
  -- تصطدم بمفتاح مكرّر. نقدّمها الآن.
  perform setval(
    pg_get_serial_sequence('transactions', 'id'),
    greatest(coalesce((select max(id) from transactions), 1), 1)
  );

  return restored;
end $$;

-- ── ④ من يستدعي هذه الدوال ───────────────────────────────────
-- كل دالة في public تُعرض تلقائياً على /rest/v1/rpc/<اسمها>، وSupabase
-- يمنح EXECUTE على الدوال الجديدة لـ anon وauthenticated افتراضياً. ودالة
-- الاسترجاع SECURITY DEFINER تكتب في transactions بصلاحيات مالكها —
-- فكان أي حامل للمفتاح العام يستطيع استدعاءها وإرجاع عملياتٍ حُذفت
-- عمداً. كُشف ذلك بفاحص الأمان في Supabase بعد أسبوع من إضافتها.
--
-- الاسترجاع عملٌ إداري يُشغَّل من محرّر SQL، فلا يحتاج أيّاً من الدورين.
-- ودوال المشغّلات لا تحتاج EXECUTE لتعمل: الصلاحية تُفحص عند إنشاء
-- المشغّل لا عند إطلاقه، فسحبها يُغلق الباب دون أن يوقف السجلّ والحاجز.
revoke execute on function dashboard_restore_transactions(timestamptz) from public, anon, authenticated;
revoke execute on function dashboard_audit_row()       from public, anon, authenticated;
revoke execute on function dashboard_audit_immutable() from public, anon, authenticated;
revoke execute on function dashboard_guard_bulk()      from public, anon, authenticated;
