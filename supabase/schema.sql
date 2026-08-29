-- ─────────────────────────────────────────────────────────────
-- جداول TravelHub على Supabase (خزينة البيانات المسبقة)
--
-- الفكرة: الموصّلات تزحف ليلاً وتخزّن هنا، والموقع يقرأ من هنا فوراً
-- بدل انتظار المتصفح — فيصبح أول بحث سريعاً والأيام الخضراء لكل الوجهات.
--
-- نفّذ هذا الملف مرة واحدة: Supabase → SQL Editor → New query → الصق → Run
-- ─────────────────────────────────────────────────────────────

-- ① أيام الإتاحة (الأيام الخضراء) — سطر لكل (مسار + يوم + خط)
create table if not exists availability (
  origin        text not null,
  destination   text not null,
  flight_date   date not null,
  carrier       text not null,
  seats         int  not null default 0,
  updated_at    timestamptz not null default now(),
  primary key (origin, destination, flight_date, carrier)
);
create index if not exists availability_route_date_idx
  on availability (origin, destination, flight_date);

-- ② نتائج البحث المخزّنة — سطر لكل (مسار + تاريخ + تركيبة ركاب + مصدر)
-- المصدر (source) = مجموعة خطوط النسخة التي كتبت السطر، فتكتب كل نسخة
-- موصّل سطرها بلا أن تدهس غيرها، ويدمج الموقعُ الأسطرَ عند القراءة.
create table if not exists flight_cache (
  origin        text not null,
  destination   text not null,
  depart_date   date not null,
  pax_key       text not null default '1-0-0',  -- بالغون-أطفال-رضّع
  source        text not null,
  payload       jsonb not null,                 -- مصفوفة الرحلات المطبّعة
  updated_at    timestamptz not null default now(),
  primary key (origin, destination, depart_date, pax_key, source)
);
create index if not exists flight_cache_lookup_idx
  on flight_cache (origin, destination, depart_date, pax_key);

-- ③ حالة الزحف — لاستئناف العمل من حيث توقّف (ميزانية وقت ثابتة كل ليلة)
create table if not exists crawl_state (
  id          text primary key,
  cursor      jsonb,
  updated_at  timestamptz not null default now()
);

-- ─── الأمان ───────────────────────────────────────────────────
-- نفعّل RLS بلا أي سياسة: المفتاح العام (anon) لا يقرأ ولا يكتب شيئاً.
-- الوصول حصراً عبر مفتاح service_role من الخادم (الموصّل + مسارات الموقع).
alter table availability enable row level security;
alter table flight_cache enable row level security;
alter table crawl_state  enable row level security;
