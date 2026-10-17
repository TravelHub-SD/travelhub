-- ─────────────────────────────────────────────────────────────
-- الموافقات الأمنية: متى صدرت، ومتى سُلّمت — لحساب مدة الإنجاز.
--
-- تملؤها القاعدة نفسها عند تغيّر الحالة، لا المستخدم: لا تُمنح للكتابة
-- (الصلاحيات في security-approvals.sql بالعمود)، فالمدة لا تُجمَّل.
--
-- الطلبات المستوردة من الأداة القديمة لا توقيت لها — الأداة لم تسجّل
-- متى تغيّرت الحالة. تبقى فارغة، ولا تدخل المتوسطات، بدل رقمٍ مخترع.
--
-- يُطبَّق بعد security-approvals.sql.
-- ─────────────────────────────────────────────────────────────

alter table security_approvals
  add column if not exists approved_at  timestamptz,
  add column if not exists delivered_at timestamptz,
  add column if not exists rejected_at  timestamptz;

create or replace function security_approvals_stamp() returns trigger
language plpgsql set search_path = public as $$
begin
  -- سجلٌّ مستورد: حالته وصفٌ لماضٍ لا نعرف توقيته.
  if tg_op = 'INSERT' and new.legacy_id is not null then
    return new;
  end if;
  if tg_op = 'UPDATE' and new.status is not distinct from old.status then
    return new;
  end if;

  if new.status = 'قيد الإجراء' then
    -- رجوعٌ عن نقرة خاطئة: لا موافقة ولا تسليم بعد.
    new.approved_at := null;
    new.delivered_at := null;
    new.rejected_at := null;
  elsif new.status = 'صدرت الموافقة' then
    new.approved_at := coalesce(new.approved_at, now());
    new.delivered_at := null;
    new.rejected_at := null;
  elsif new.status = 'تم التسليم' then
    -- قفزٌ مباشر من «قيد الإجراء» = صدرت وسُلّمت معاً. أما طلبٌ قديم كان
    -- «صدرت» بلا توقيت فيبقى بلا توقيت إصدار، لا يُنسب إليه وقت التسليم.
    if new.approved_at is null and (tg_op = 'INSERT' or old.status = 'قيد الإجراء') then
      new.approved_at := now();
    end if;
    new.delivered_at := coalesce(new.delivered_at, now());
    new.rejected_at := null;
  elsif new.status = 'مرفوضة' then
    new.approved_at := null;
    new.delivered_at := null;
    new.rejected_at := coalesce(new.rejected_at, now());
  end if;
  return new;
end $$;
revoke execute on function security_approvals_stamp() from public, anon, authenticated;

drop trigger if exists security_approvals_stamp on security_approvals;
create trigger security_approvals_stamp
  before insert or update on security_approvals
  for each row execute function security_approvals_stamp();
