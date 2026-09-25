-- ─────────────────────────────────────────────────────────────
-- داشبورد تسجيل عمليات الوكالة (Travel Hub)
--
-- القيود هنا ليست تزييناً: نفس تحقّقات الفورم مكتوبة في قاعدة
-- البيانات، فلا يدخل صفٌّ خاطئ حتى لو نودي الـ API مباشرةً أو
-- تغيّرت الواجهة لاحقاً.
-- ─────────────────────────────────────────────────────────────

-- ── الوكلاء ──────────────────────────────────────────────────
create table if not exists agents (
  id         bigint generated always as identity primary key,
  name       text        not null check (length(btrim(name)) > 0),
  phone      text,
  is_active  boolean     not null default true,
  created_at timestamptz not null default now()
);

-- ── العمليات ─────────────────────────────────────────────────
create table if not exists transactions (
  id           bigint generated always as identity primary key,
  date         date        not null default current_date,
  service_type text        not null,
  source       text        not null,
  -- الوكيل لا يُحذف ما دامت له عمليات: التعطيل يخفيه من الفورم
  -- ويُبقي تاريخه في التقارير.
  agent_id     bigint      references agents(id) on delete restrict,
  quantity     integer     not null default 1 check (quantity > 0),
  agent_profit bigint      not null default 0 check (agent_profit >= 0),
  -- بلا قيد إشارة: العملية الملغاة أو المرتجعة قد تُسجَّل بصافٍ سالب.
  net_profit   bigint      not null,
  note         text,
  created_at   timestamptz not null default now(),

  constraint transactions_service_type_valid check (
    service_type in (
      'تذكرة داخلية', 'تذكرة دولية', 'موافقة أمنية',
      'تأشيرة عمرة', 'زيارة عائلية', 'أخرى'
    )
  ),
  constraint transactions_source_valid check (source in ('وكيل', 'مباشر')),

  -- الوكيل مطلوب مع مصدر "وكيل" وممنوع مع "مباشر"، وربح الوكيل
  -- لا معنى له بلا وكيل.
  constraint transactions_agent_matches_source check (
    (source = 'وكيل'  and agent_id is not null) or
    (source = 'مباشر' and agent_id is null and agent_profit = 0)
  )
);

-- فهارس للاستعلامات الثلاثة التي تستعملها الصفحات:
-- شهرٌ من العمليات، سجلٌّ مفلتر بالوكيل، وتجميعٌ حسب نوع الخدمة.
create index if not exists transactions_date_idx     on transactions (date desc, id desc);
create index if not exists transactions_agent_idx    on transactions (agent_id) where agent_id is not null;
create index if not exists transactions_service_idx  on transactions (service_type);

-- ── الحماية ──────────────────────────────────────────────────
-- RLS مفعّل بلا سياسات: لا يصل الجدولين إلا مفتاح service_role
-- من الخادم. مفاتيح المتصفح العامة لا ترى شيئاً.
alter table agents       enable row level security;
alter table transactions enable row level security;
