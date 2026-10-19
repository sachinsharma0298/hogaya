-- People records: who reviewed whom and when, the "Approved by Hogaya" notice, forced password change after an operator reset,
-- operator notes, consent wording, and "forgot password" requests. No password is ever stored here: Supabase Auth keeps them (hashed).
alter table public.profiles add column if not exists reviewed_at timestamptz;
alter table public.profiles add column if not exists reviewed_by text not null default '';
alter table public.profiles add column if not exists must_change_password boolean not null default false;
alter table public.profiles add column if not exists approval_seen boolean not null default false;
update public.profiles set approval_seen = true where review = 'approved'; -- the notice is only for approvals from now on

alter table public.pending_pros add column if not exists reviewed_at timestamptz;
alter table public.pending_pros add column if not exists reviewed_by text not null default '';
alter table public.pending_pros add column if not exists consent_text text not null default '';
alter table public.providers add column if not exists consent_text text not null default '';

-- Operator notes about a person (keyed by email, so they also work for a Pro who has not signed in yet).
create table if not exists public.person_notes (
  email text primary key,
  notes text not null default '',
  updated_at timestamptz not null default now()
);
alter table public.person_notes enable row level security;
revoke all on public.person_notes from anon, authenticated;

-- "Forgot password" requests. The operator sets a temporary password; nothing is emailed or texted.
create table if not exists public.password_resets (
  id bigint generated always as identity primary key,
  email text not null,
  identifier text not null, -- what the person typed (email or phone)
  status text not null default 'open' check (status in ('open', 'done')),
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);
create unique index if not exists password_resets_one_open_idx on public.password_resets (lower(email)) where status = 'open';
alter table public.password_resets enable row level security;
revoke all on public.password_resets from anon, authenticated;
