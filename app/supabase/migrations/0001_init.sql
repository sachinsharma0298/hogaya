-- Hogaya: initial schema. Run once (npm run db:migrate, or paste into the Supabase SQL editor).
-- All writes come from our server (a privileged database connection). The browser never writes directly.
-- Row-level security (RLS) is the second wall: if someone calls Supabase's public REST API with the anon key,
-- or with a logged-in user's token, they only see what the policies below allow.

create table if not exists public.categories (
  id text primary key,
  label text not null,
  sort int not null default 0
);

-- One profile per Supabase Auth user. role is set by our server only (never by the user).
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  role text not null default 'customer' check (role in ('customer', 'pro', 'operator')),
  name text not null default '',
  phone text not null default '',
  email text not null default '',
  provider_id text,
  created_at timestamptz not null default now()
);
create unique index if not exists profiles_email_idx on public.profiles (lower(email)) where email <> '';

-- Pros onboarded by the operator. No KYC: "Onboarded by Hogaya" plus a recorded AI-call consent.
create table if not exists public.providers (
  id text primary key,
  name text not null,
  category text not null references public.categories (id),
  categories text[] not null default '{}',
  area text not null default '',
  visit_charge text not null default '',
  phone text not null default '',
  email text not null default '',
  consent_ai_call boolean not null default false,
  consent_date text not null default '',
  opt_out boolean not null default false,
  reliability int not null default 80,
  on_time_pct int not null default 80,
  jobs int not null default 0,
  no_shows int not null default 0,
  demo boolean not null default false,
  onboarded_by text not null default '',
  onboarded_at timestamptz,
  created_at timestamptz not null default now()
);

-- The list of phone numbers a LIVE Fo call may ever reach. Managed in the operator console.
create table if not exists public.approved_numbers (
  id bigint generated always as identity primary key,
  phone text not null unique, -- last 10 digits
  kind text not null check (kind in ('pro', 'customer')),
  name text not null default '',
  consent_at timestamptz not null default now(),
  added_by text not null default '',
  note text not null default '',
  created_at timestamptz not null default now()
);

-- Audit log of every AI-call consent we recorded.
create table if not exists public.consents (
  id bigint generated always as identity primary key,
  subject_kind text not null check (subject_kind in ('pro', 'customer')),
  subject_id text not null,
  phone text not null default '',
  consented_at timestamptz not null,
  channel text not null default '',
  recorded_by text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists public.requests (
  id text primary key,
  created_at timestamptz not null default now(),
  customer_id uuid references public.profiles (id),
  category text not null references public.categories (id),
  problem text not null default '',
  sector text not null default '',
  time_window text not null default '',
  notes text,
  state text not null default 'requested',
  prev_state text,
  step text not null default 'matching',
  demo boolean not null default true,
  manual boolean not null default false,
  archived boolean not null default false,
  current_provider_name text,
  matched text[] not null default '{}',
  not_selected text[],
  chosen_provider_id text,
  customer_choice jsonb,
  booking jsonb,
  flags jsonb not null default '[]',
  notifications jsonb not null default '[]',
  ctl jsonb not null default '{}' -- small control flags: awaiting_call, call_approved, skip_rest, customer_declined, screen_confirm_open
);
create index if not exists requests_customer_idx on public.requests (customer_id);
create index if not exists requests_state_idx on public.requests (state) where not archived;

-- Private details of a booking: only the customer and the operator can read these directly.
create table if not exists public.request_private (
  request_id text primary key references public.requests (id) on delete cascade,
  customer_name text not null default '',
  customer_phone text not null default '',
  customer_consent boolean not null default false,
  customer_consent_at timestamptz,
  address text not null default '',
  arrival_code text not null default ''
);

create table if not exists public.calls (
  seq bigint generated always as identity primary key,
  id text not null unique,
  request_id text not null references public.requests (id) on delete cascade,
  kind text not null,
  provider_id text,
  provider_name text,
  status text not null,
  started_at timestamptz not null,
  ended_at timestamptz,
  fo_conversation_id text,
  progress text,
  question text,
  operator_reply text,
  demo boolean not null default false,
  summary_text text,
  json jsonb
);
create index if not exists calls_request_idx on public.calls (request_id);

create table if not exists public.events (
  id bigint generated always as identity primary key,
  request_id text not null references public.requests (id) on delete cascade,
  at timestamptz not null,
  text text not null
);
create index if not exists events_request_idx on public.events (request_id);

create table if not exists public.settings (
  id int primary key default 1 check (id = 1),
  autopilot boolean not null default false,
  simulate_no_reconfirm boolean not null default false
);
insert into public.settings (id) values (1) on conflict do nothing;

-- Fo sign-in tokens. Server only: RLS on, no policy, and no privileges for the browser roles.
create table if not exists public.fo_oauth (
  id int primary key default 1 check (id = 1),
  data jsonb not null default '{}',
  updated_at timestamptz not null default now()
);
insert into public.fo_oauth (id) values (1) on conflict do nothing;

-- ---- Row-level security ---------------------------------------------------------------------------------

create or replace function public.app_role() returns text
  language sql stable security definer set search_path = public as
  $$ select role from public.profiles where id = auth.uid() $$;

create or replace function public.my_provider_id() returns text
  language sql stable security definer set search_path = public as
  $$ select provider_id from public.profiles where id = auth.uid() $$;

alter table public.categories enable row level security;
alter table public.profiles enable row level security;
alter table public.providers enable row level security;
alter table public.approved_numbers enable row level security;
alter table public.consents enable row level security;
alter table public.requests enable row level security;
alter table public.request_private enable row level security;
alter table public.calls enable row level security;
alter table public.events enable row level security;
alter table public.settings enable row level security;
alter table public.fo_oauth enable row level security;

-- Nobody but the server writes. Take write rights away from the browser roles on every table.
revoke insert, update, delete, truncate on all tables in schema public from anon, authenticated;
-- Server-only tables: no read rights either.
revoke all on public.fo_oauth, public.approved_numbers, public.consents from anon, authenticated;
revoke all on public.calls, public.events, public.settings from anon;
revoke all on public.profiles, public.providers, public.requests, public.request_private from anon;

drop policy if exists categories_read on public.categories;
create policy categories_read on public.categories for select using (true);

drop policy if exists profiles_read on public.profiles;
create policy profiles_read on public.profiles for select to authenticated
  using (id = auth.uid() or public.app_role() = 'operator');

drop policy if exists providers_read on public.providers;
create policy providers_read on public.providers for select to authenticated
  using (public.app_role() = 'operator' or id = public.my_provider_id());

drop policy if exists requests_read on public.requests;
create policy requests_read on public.requests for select to authenticated
  using (
    customer_id = auth.uid()
    or public.app_role() = 'operator'
    or (public.app_role() = 'pro' and (chosen_provider_id = public.my_provider_id() or public.my_provider_id() = any (matched)))
  );

drop policy if exists request_private_read on public.request_private;
create policy request_private_read on public.request_private for select to authenticated
  using (
    public.app_role() = 'operator'
    or exists (select 1 from public.requests r where r.id = request_id and r.customer_id = auth.uid())
  );

-- Call records and the timeline contain what people said: operator only.
drop policy if exists calls_read on public.calls;
create policy calls_read on public.calls for select to authenticated using (public.app_role() = 'operator');
drop policy if exists events_read on public.events;
create policy events_read on public.events for select to authenticated using (public.app_role() = 'operator');
drop policy if exists settings_read on public.settings;
create policy settings_read on public.settings for select to authenticated using (public.app_role() = 'operator');
